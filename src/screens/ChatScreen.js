import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { 
  scale, 
  verticalScale, 
  scaleFont, 
  getResponsivePadding, 
  isIOS,
  isAndroid,
  isTablet,
  isSmallScreen,
  getBottomSafeArea
} from '../utils/responsive';
import socketService from '../services/socketService';
import apiService from '../services/api';

export default function ChatScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('friends');
  const [message, setMessage] = useState('');
  const [publicMessages, setPublicMessages] = useState([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const flatListRef = useRef(null);

  // Kullanıcı bilgilerini yükle
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const token = await apiService.getStoredToken();
        if (token) {
          apiService.setToken(token);
          const response = await apiService.getProfile();
          if (response.success) {
            setCurrentUser(response.data);
          }
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri yüklenemedi:', error);
      }
    };
    
    loadCurrentUser();
  }, []);

  // Event handler'ları useCallback ile tanımla
  const handleMessageReceived = useCallback((data) => {
    console.log('ChatScreen: Yeni mesaj alındı:', data);
    console.log('ChatScreen: Mesaj gönderen ID:', data.senderId);
    
    // Güvenli string dönüşümü
    const currentUserId = currentUser?.id ? String(currentUser.id) : null;
    const senderId = data.senderId ? String(data.senderId) : null;
    
    console.log('ChatScreen: Current user ID:', currentUserId);
    console.log('ChatScreen: Sender ID:', senderId);
    console.log('ChatScreen: ID comparison:', currentUserId === senderId);
    
    // Kendi mesajımızı filtrele - optimistic update zaten eklenmiş
    if (currentUserId && senderId && currentUserId === senderId) {
      console.log('ChatScreen: Kendi mesajımız (socket\'ten), eklenmiyor - zaten optimistic update ile eklendi');
      return;
    }
    
    const timestamp = data.timestamp || new Date().toISOString();
    const safeSenderId = senderId || 'unknown';
    
    const newMessage = {
      id: `${safeSenderId}-${timestamp}`,
      user: data.senderEmail || `Kullanıcı ${safeSenderId.slice(-4)}`,
      message: data.message || '',
      time: new Date(timestamp).toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      avatar: '👤',
      senderId: data.senderId,
      isOwn: false,
    };
    
    console.log('ChatScreen: Yeni mesaj oluşturuldu:', newMessage);
    
    setPublicMessages(prev => {
      // Duplicate mesajları kontrol et
      const exists = prev.some(msg => msg.id === newMessage.id);
      if (exists) {
        console.log('ChatScreen: Mesaj zaten mevcut, eklenmiyor');
        return prev;
      }
      console.log('ChatScreen: Mesaj listeye ekleniyor');
      const updatedMessages = [...prev, newMessage];
      
      // Yeni mesaj eklendikten sonra en alta scroll et
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      return updatedMessages;
    });
  }, [currentUser]);

  const handleOnlineUsersList = useCallback((users) => {
    console.log('ChatScreen: Online kullanıcı listesi alındı:', users);
    setOnlineUsers(users);
  }, []);

  const handleUserJoined = useCallback((data) => {
    console.log('ChatScreen: Kullanıcı katıldı:', data);
    // Online kullanıcı listesini güncelle
    setOnlineUsers(prev => [...prev, data]);
  }, []);

  const handleUserLeft = useCallback((data) => {
    console.log('ChatScreen: Kullanıcı ayrıldı:', data);
    // Online kullanıcı listesinden çıkar
    setOnlineUsers(prev => prev.filter(user => user.userId !== data.userId));
  }, []);

  const handleConnectionError = useCallback((error) => {
    console.error('Socket bağlantı hatası:', error);
    setIsSocketConnected(false);
    Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
  }, []);

  const handleConnectionStatus = useCallback((data) => {
    console.log('Socket bağlantı durumu:', data);
    setIsSocketConnected(data.connected);
  }, []);

  // Socket.io bağlantısını yönet
  useEffect(() => {
    console.log('ChatScreen: Socket bağlantısı başlatılıyor...');
    
    // Socket bağlantısını başlat
    socketService.connect();

    // Socket bağlantısını kontrol et ve odaya katıl
    const checkConnection = () => {
      const connected = socketService.isSocketConnected();
      if (connected) {
        console.log('ChatScreen: Socket bağlantısı kuruldu');
        setIsSocketConnected(true);
        // Genel odaya katıl
        socketService.joinRoom('general');
        // Kullanıcı durumunu online olarak güncelle
        socketService.updateUserStatus('online');
        // Mesaj geçmişi ayrı useEffect'te yüklenecek
      } else {
        console.log('ChatScreen: Socket bağlantısı yok, tekrar denenecek...');
        setIsSocketConnected(false);
        // Kısa bir süre sonra tekrar kontrol et
        setTimeout(checkConnection, 1000);
      }
    };

    // İlk kontrol
    checkConnection();

    // Event listener'ları kaydet
    socketService.on('message_received', handleMessageReceived);
    socketService.on('connection_error', handleConnectionError);
    socketService.on('connection_status', handleConnectionStatus);
    socketService.on('online_users_list', handleOnlineUsersList);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);

    // Cleanup function
    return () => {
      socketService.off('message_received', handleMessageReceived);
      socketService.off('connection_error', handleConnectionError);
      socketService.off('connection_status', handleConnectionStatus);
      socketService.off('online_users_list', handleOnlineUsersList);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
    };
  }, [handleMessageReceived, handleConnectionError, handleConnectionStatus, handleOnlineUsersList, handleUserJoined, handleUserLeft]);

  // Component unmount olduğunda socket bağlantısını kapat
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const [privateChats, setPrivateChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [showFriendRequests, setShowFriendRequests] = useState(true);
  const [sentRequests, setSentRequests] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  // Mesaj geçmişini yükle
  const loadMessageHistory = async () => {
    try {
      setIsLoading(true);
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('Token bulunamadı, mesaj geçmişi yüklenemiyor');
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.get('/chat/history?room=general&limit=50');
      
      if (response.success && response.data) {
        const formattedMessages = response.data.map(msg => ({
          id: `${msg.senderId}-${msg.timestamp}`,
          user: msg.senderName || `Kullanıcı ${msg.senderId.slice(-4)}`,
          message: msg.message,
          time: new Date(msg.timestamp).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          avatar: '👤',
          senderId: msg.senderId,
          isOwn: currentUser && currentUser.id && msg.senderId === currentUser.id.toString(),
        }));
        
        // Mesajları ters sırada göster (en yeni altta)
        setPublicMessages(formattedMessages.reverse());
        console.log(`${formattedMessages.length} mesaj yüklendi`);
      }
    } catch (error) {
      console.error('Mesaj geçmişi yüklenirken hata:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Arkadaş listesini döndür
  const getFriendsWithOnlineStatus = () => {
    console.log('getFriendsWithOnlineStatus called, friends count:', friends.length);
    return friends;
  };

  // Arkadaş arama fonksiyonu
  const searchUsers = async (query) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        setSearchResults([]);
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.searchUsers(query);
      
      console.log('Search users response:', response);
      
      if (response.success && response.data) {
        // Mevcut arkadaşların ID'lerini al
        const friendIds = friends.map(friend => friend.id);
        
        const users = response.data
          .filter(user => !friendIds.includes(user.id)) // Zaten arkadaş olanları filtrele
          .map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: '👤',
            mutualFriends: user.mutualFriendsCount || 0,
            isFriend: false,
          }));
        setSearchResults(users);
      } else {
        setSearchResults([]);
      }
      
    } catch (error) {
      console.error('Arama hatası:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Arkadaş ekleme fonksiyonu (arkadaşlık isteği gönder)
  const addFriend = async (user) => {
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.addFriend(user.id);
      
      if (response.success) {
        // Gönderilen istekler listesine ekle
        setSentRequests(prev => [...prev, user.id]);
        // Arama sonuçlarından kaldır
        setSearchResults(prev => prev.filter(result => result.id !== user.id));
        Alert.alert('Başarılı', `${user.name} kullanıcısına arkadaşlık isteği gönderildi!`);
      } else {
        // Özel hata mesajları
        if (response.message && response.message.includes('zaten arkadaşlık isteği gönderilmiş')) {
          // Gönderilen istekler listesine ekle
          setSentRequests(prev => [...prev, user.id]);
          Alert.alert('Bilgi', `${user.name} kullanıcısına zaten arkadaşlık isteği gönderilmiş.`);
          // Arama sonuçlarından kaldır
          setSearchResults(prev => prev.filter(result => result.id !== user.id));
        } else if (response.message && response.message.includes('zaten arkadaşınız')) {
          Alert.alert('Bilgi', `${user.name} kullanıcısı zaten arkadaşınız.`);
          // Arama sonuçlarından kaldır
          setSearchResults(prev => prev.filter(result => result.id !== user.id));
        } else {
          Alert.alert('Hata', response.message || 'Arkadaşlık isteği gönderilirken bir hata oluştu.');
        }
      }
      
    } catch (error) {
      console.error('Arkadaş ekleme hatası:', error);
      
      // Hata mesajından özel durumları kontrol et
      if (error.message && error.message.includes('zaten arkadaşlık isteği gönderilmiş')) {
        // Gönderilen istekler listesine ekle
        setSentRequests(prev => [...prev, user.id]);
        Alert.alert('Bilgi', `${user.name} kullanıcısına zaten arkadaşlık isteği gönderilmiş.`);
        // Arama sonuçlarından kaldır
        setSearchResults(prev => prev.filter(result => result.id !== user.id));
      } else if (error.message && error.message.includes('zaten arkadaşınız')) {
        Alert.alert('Bilgi', `${user.name} kullanıcısı zaten arkadaşınız.`);
        // Arama sonuçlarından kaldır
        setSearchResults(prev => prev.filter(result => result.id !== user.id));
      } else {
        Alert.alert('Hata', 'Arkadaşlık isteği gönderilirken bir hata oluştu.');
      }
    }
  };

  // Arkadaş silme fonksiyonu
  const removeFriend = async (friend) => {
    Alert.alert(
      'Arkadaşı Sil',
      `${friend.name} arkadaşınızı silmek istediğinizden emin misiniz?`,
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            setFriends(prev => prev.filter(f => f.id !== friend.id));
            Alert.alert('Başarılı', `${friend.name} arkadaş listesinden kaldırıldı.`);
          },
        },
      ]
    );
  };

  // Profil görüntüleme fonksiyonu
  const viewProfile = (friend) => {
    console.log('=== VIEW PROFILE CALLED ===');
    console.log('Selected friend:', friend);
    setSelectedFriend(friend);
    setShowProfilePopup(true);
  };

  // Arkadaş listesini yükle
  const loadFriends = async () => {
    console.log('=== LOAD FRIENDS CALLED ===');
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token found, setting friends to empty array');
        setFriends([]);
        return;
      }
      
      // Token'dan user ID'yi çıkar
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('Current user ID from token:', payload.userId);
      } catch (e) {
        console.log('Token parse error:', e);
      }
      
      apiService.setToken(token);
      const response = await apiService.getFriends();
      
      console.log('Get friends response:', response);
      
      if (response.success && response.data && response.data.friends) {
        console.log('Arkadaş listesi API yanıtı:', response.data.friends);
        const friends = response.data.friends.map(friend => ({
          id: friend.id,
          name: `${friend.firstName} ${friend.lastName}`,
          email: friend.email,
          status: 'offline',
          lastSeen: 'Bilinmiyor',
          avatar: '👤',
          mutualFriends: 0,
          age: friend.age || 'Bilinmiyor',
          profilePicture: friend.profilePicture || null,
        }));
        console.log('İşlenmiş arkadaş listesi:', friends);
        setFriends(friends);
        console.log('setFriends called with:', friends);
      } else {
        console.log('Arkadaş listesi boş veya hata:', response);
        setFriends([]);
      }
    } catch (error) {
      console.error('Arkadaş listesi yükleme hatası:', error);
      console.error('Error details:', error.message);
      setFriends([]);
    }
  };

  // Özel sohbetleri yükle
  const loadPrivateChats = async () => {
    console.log('=== LOAD PRIVATE CHATS CALLED ===');
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('No token found, setting privateChats to empty array');
        setPrivateChats([]);
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.getPrivateConversations();
      
      console.log('Private conversations API response:', response);
      if (response.success && response.data) {
        const chats = response.data.map(chat => ({
          id: chat.friendId,
          name: chat.friendName,
          lastMessage: chat.lastMessage || 'Henüz mesaj yok',
          time: chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : 'Şimdi',
          unread: chat.unreadCount || 0,
          avatar: '👤',
          profilePicture: chat.profilePicture
        }));
        
        console.log('İşlenmiş özel sohbet listesi:', chats);
        setPrivateChats(chats);
      } else {
        console.log('Özel sohbet listesi boş veya hata:', response);
        setPrivateChats([]);
      }
    } catch (error) {
      console.error('Özel sohbet listesi yükleme hatası:', error);
      setPrivateChats([]);
    }
  };

  // Arkadaşlık isteklerini yükle
  const loadFriendRequests = async () => {
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        setFriendRequests([]);
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.getFriendRequests();
      
      console.log('Get friend requests response:', response);
      
      if (response.success && response.data) {
        const incomingRequests = response.data.incomingRequests || [];
        setFriendRequests(incomingRequests);
      } else {
        setFriendRequests([]);
      }
    } catch (error) {
      console.error('Arkadaşlık istekleri yükleme hatası:', error);
      setFriendRequests([]);
    }
  };

  // Arkadaşlık isteğini kabul et
  const acceptFriendRequest = async (request) => {
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.acceptFriendRequest(request.id);
      
      if (response.success) {
        console.log('Arkadaşlık isteği kabul edildi, arkadaş listesi yeniden yükleniyor...');
        // Arkadaş listesini yeniden yükle
        await loadFriends();
        // İstek listesini güncelle
        setFriendRequests(prev => prev.filter(req => req.id !== request.id));
        Alert.alert('Başarılı', `${request.firstName} ${request.lastName} arkadaş olarak eklendi!`);
      } else {
        Alert.alert('Hata', response.message || 'Arkadaşlık isteği kabul edilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Arkadaşlık isteği kabul etme hatası:', error);
      Alert.alert('Hata', 'Arkadaşlık isteği kabul edilirken bir hata oluştu.');
    }
  };

  // Arkadaşlık isteğini reddet
  const declineFriendRequest = async (request) => {
    try {
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      apiService.setToken(token);
      const response = await apiService.declineFriendRequest(request.id);
      
      if (response.success) {
        // İstek listesini güncelle
        setFriendRequests(prev => prev.filter(req => req.id !== request.id));
        Alert.alert('Başarılı', 'Arkadaşlık isteği reddedildi.');
      } else {
        Alert.alert('Hata', response.message || 'Arkadaşlık isteği reddedilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Arkadaşlık isteği reddetme hatası:', error);
      Alert.alert('Hata', 'Arkadaşlık isteği reddedilirken bir hata oluştu.');
    }
  };

  // Component mount olduğunda arkadaş listesini ve istekleri yükle
  useEffect(() => {
    console.log('=== CHAT SCREEN MOUNTED ===');
    console.log('Component mount - arkadaş listesi yükleniyor...');
    console.log('Current friends state:', friends);
    loadFriends();
    loadFriendRequests();
    loadPrivateChats();
  }, []);

  // Arkadaş listesi değiştiğinde log
  useEffect(() => {
    console.log('Friends state changed:', friends);
  }, [friends]);

  // currentUser yüklendikten sonra mesaj geçmişini yükle
  useEffect(() => {
    if (currentUser && isSocketConnected) {
      loadMessageHistory();
    }
  }, [currentUser, isSocketConnected]);

  // Arama sorgusu değiştiğinde
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const renderPublicMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.isOwn && styles.ownMessageContainer
    ]}>
      <View style={styles.messageHeader}>
        <Text style={styles.avatar}>{item.avatar}</Text>
        <View style={styles.messageInfo}>
          <Text style={[
            styles.userName,
            item.isOwn && styles.ownUserName
          ]}>
            {item.user}
          </Text>
          <Text style={[
            styles.messageTime,
            item.isOwn && styles.ownMessageTime
          ]}>
            {item.time}
          </Text>
        </View>
        {item.isOwn && (
          <View style={styles.messageStatus}>
            <Ionicons 
              name="checkmark-done" 
              size={16} 
              color={colors.success} 
            />
          </View>
        )}
      </View>
      <Text style={[
        styles.messageText,
        item.isOwn && styles.ownMessageText
      ]}>
        {item.message}
      </Text>
    </View>
  );

  const renderPrivateChat = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem}
      onPress={() => {
        console.log('🚀 ChatScreen: Özel sohbet tıklandı:', item);
        navigation.navigate('PrivateChat', { 
          friend: {
            id: item.id,
            name: item.name,
            profilePicture: item.profilePicture
          }
        });
      }}
    >
      <View style={styles.chatAvatar}>
        <Text style={styles.chatAvatarText}>{item.avatar}</Text>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.time}</Text>
        </View>
        <Text style={styles.chatLastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFriend = ({ item }) => (
    <TouchableOpacity 
      style={styles.friendItem}
      onPress={() => viewProfile(item)}
    >
      <View style={styles.friendAvatar}>
        <Text style={styles.friendAvatarText}>{item.avatar}</Text>
        <View style={[
          styles.statusIndicator,
          { backgroundColor: getStatusColor(item.status) }
        ]} />
      </View>
      <View style={styles.friendContent}>
        <View style={styles.friendHeader}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendLastSeen}>{item.lastSeen}</Text>
        </View>
        <Text style={styles.mutualFriends}>
          {item.mutualFriends} ortak arkadaş
        </Text>
      </View>
      <View style={styles.friendActions}>
        <TouchableOpacity 
          style={styles.messageFriendButton}
          onPress={() => {
            Alert.alert('Bilgi', 'Mesaj gönderme özelliği yakında eklenecek.');
          }}
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.removeFriendButton}
          onPress={() => removeFriend(item)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }) => {
    const isRequestSent = sentRequests.includes(item.id);
    
    return (
      <TouchableOpacity style={styles.searchResultItem}>
        <View style={styles.searchResultAvatar}>
          <Text style={styles.searchResultAvatarText}>{item.avatar}</Text>
        </View>
        <View style={styles.searchResultContent}>
          <View style={styles.searchResultHeader}>
            <Text style={styles.searchResultName}>{item.name}</Text>
            <Text style={styles.searchResultEmail}>{item.email}</Text>
          </View>
          <Text style={styles.searchResultMutual}>
            {item.mutualFriends} ortak arkadaş
          </Text>
        </View>
        <TouchableOpacity 
          style={[
            styles.addFriendButton,
            isRequestSent && styles.sentRequestButton
          ]}
          onPress={() => addFriend(item)}
          disabled={isRequestSent}
        >
          <Ionicons 
            name={isRequestSent ? "checkmark" : "person-add-outline"} 
            size={20} 
            color={isRequestSent ? colors.success : colors.text.light} 
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderFriendRequest = ({ item }) => (
    <View style={styles.friendRequestItem}>
      <View style={styles.friendRequestAvatar}>
        <Text style={styles.friendRequestAvatarText}>
          {item.profilePicture ? '👤' : '👤'}
        </Text>
      </View>
      <View style={styles.friendRequestContent}>
        <Text style={styles.friendRequestName}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.friendRequestEmail}>{item.email}</Text>
        <Text style={styles.friendRequestTime}>
          {new Date(item.requestCreatedAt).toLocaleDateString('tr-TR')}
        </Text>
      </View>
      <View style={styles.friendRequestActions}>
        <TouchableOpacity 
          style={styles.acceptButton}
          onPress={() => acceptFriendRequest(item)}
        >
          <Ionicons name="checkmark" size={20} color={colors.text.light} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.declineButton}
          onPress={() => declineFriendRequest(item)}
        >
          <Ionicons name="close" size={20} color={colors.text.light} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'online':
        return colors.success;
      case 'away':
        return colors.warning;
      case 'offline':
        return colors.lightGray;
      default:
        return colors.lightGray;
    }
  };

  const sendMessage = async () => {
    if (message.trim()) {
      const messageText = message.trim();
      console.log('ChatScreen: Mesaj gönderiliyor:', messageText);
      
      // Socket bağlantısını kontrol et
      if (!isSocketConnected) {
        console.log('ChatScreen: Socket bağlantısı yok, mesaj gönderilemiyor');
        Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
        return;
      }
      
      // Kendi mesajınızı hemen ekleyin (optimistic update)
      const newMessage = {
        id: `${currentUser?.id || 'unknown'}-${Date.now()}`,
        user: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Sen',
        message: messageText,
        time: new Date().toLocaleTimeString('tr-TR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        avatar: '👤',
        senderId: currentUser?.id?.toString() || 'unknown',
        isOwn: true, // Kendi mesajımızı işaretle
      };
      setPublicMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        
        // Yeni mesaj eklendikten sonra en alta scroll et
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
        
        return updatedMessages;
      });
      
      // Backend'e mesajı kaydet
      try {
        const token = await apiService.getStoredToken();
        if (token) {
          apiService.setToken(token);
          const response = await apiService.post('/chat/send', {
            message: messageText,
            room: 'general'
          });
          
          if (response.success) {
            console.log('ChatScreen: Mesaj backend\'e kaydedildi');
          }
        }
      } catch (error) {
        console.error('ChatScreen: Backend mesaj kaydetme hatası:', error);
      }
      
      // Socket.io ile mesaj gönder
      console.log('ChatScreen: Socket ile mesaj gönderiliyor...');
      const sentMessage = socketService.sendMessage(messageText, 'general');
      console.log('ChatScreen: Mesaj gönderme sonucu:', sentMessage);
      
      if (sentMessage) {
        // Mesaj gönderimi için aktivite oluştur
        socketService.createActivity(
          'message',
          'Mesaj gönderildi',
          `Genel sohbete mesaj gönderdiniz: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`,
          { messageLength: messageText.length, room: 'general' }
        );
        
        console.log('ChatScreen: Mesaj yerel olarak eklendi');
      } else {
        console.log('ChatScreen: Mesaj gönderilemedi');
        Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
        // Hata durumunda mesajı geri al
        setPublicMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }
      
      setMessage('');
    }
  };

  console.log('=== RENDERING CHAT SCREEN ===');
  console.log('Current state:', {
    friends: friends.length,
    friendRequests: friendRequests.length,
    showSearch,
    searchResults: searchResults.length,
    currentUser: !!currentUser,
    isSocketConnected
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <LinearGradient
          colors={colors.gradients.redBlack}
          style={styles.header}
        >
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Sohbet</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.localChatButton}
                onPress={() => navigation.navigate('LocalChat')}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.text.light} />
                <Text style={styles.localChatButtonText}>Local Chat</Text>
              </TouchableOpacity>
              <View style={styles.connectionStatus}>
                <View style={[
                  styles.connectionIndicator,
                  { backgroundColor: isSocketConnected ? colors.success : colors.warning }
                ]} />
                <Text style={styles.connectionText}>
                  {isSocketConnected ? `Bağlı (${onlineUsers.length} online)` : 'Bağlantı yok'}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'private' && styles.activeTab
              ]}
              onPress={() => setActiveTab('private')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'private' && styles.activeTabText
              ]}>
                Özel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'friends' && styles.activeTab
              ]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'friends' && styles.activeTabText
              ]}>
                Arkadaşlar
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'private' ? (
            privateChats.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>💌</Text>
                <Text style={styles.emptyStateTitle}>Özel mesaj yok</Text>
                <Text style={styles.emptyStateText}>
                  Henüz özel mesajınız bulunmuyor.
                </Text>
              </View>
            ) : (
              <FlatList
                data={privateChats}
                renderItem={renderPrivateChat}
                keyExtractor={item => item.id}
                style={styles.chatsList}
                showsVerticalScrollIndicator={false}
              />
            )
          ) : (
            <>
              {/* Arama Header */}
              <View style={styles.searchHeader}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={colors.text.tertiary} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Arkadaş ara..."
                    placeholderTextColor={colors.text.tertiary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onFocus={() => setShowSearch(true)}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearSearchButton}
                      onPress={() => {
                        setSearchQuery('');
                        setShowSearch(false);
                      }}
                    >
                      <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.addFriendHeaderButton}
                  onPress={() => setShowSearch(!showSearch)}
                >
                  <Ionicons name="person-add" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Arkadaşlık İstekleri */}
              {!showSearch && (
                <View style={styles.friendRequestsSection}>
                  <View style={styles.friendRequestsHeader}>
                    <Text style={styles.friendRequestsTitle}>
                      Arkadaşlık İstekleri ({friendRequests.length})
                    </Text>
                    <TouchableOpacity
                      style={styles.toggleRequestsButton}
                      onPress={() => setShowFriendRequests(!showFriendRequests)}
                    >
                      <Ionicons 
                        name={showFriendRequests ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={colors.primary} 
                      />
                    </TouchableOpacity>
                  </View>
                  {showFriendRequests && (
                    <View>
                      {friendRequests.length > 0 ? (
                        <FlatList
                          data={friendRequests}
                          renderItem={renderFriendRequest}
                          keyExtractor={item => item.id.toString()}
                          style={styles.friendRequestsList}
                          showsVerticalScrollIndicator={false}
                        />
                      ) : (
                        <View style={styles.emptyRequestsContainer}>
                          <Ionicons name="mail-outline" size={48} color={colors.text.secondary} />
                          <Text style={styles.emptyRequestsText}>
                            Henüz arkadaşlık isteğiniz yok
                          </Text>
                          <Text style={styles.emptyRequestsSubtext}>
                            Size gelen arkadaşlık istekleri burada görünecek
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Arama Sonuçları veya Arkadaş Listesi */}
              {showSearch ? (
                <>
                  {isSearching ? (
                    <View style={styles.loadingContainer}>
                      <Text style={styles.loadingText}>Aranıyor...</Text>
                    </View>
                  ) : searchResults.length > 0 ? (
                    <FlatList
                      data={searchResults}
                      renderItem={renderSearchResult}
                      keyExtractor={item => item.id}
                      style={styles.searchResultsList}
                      showsVerticalScrollIndicator={false}
                    />
                  ) : searchQuery.length > 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>🔍</Text>
                      <Text style={styles.emptyStateTitle}>Sonuç bulunamadı</Text>
                      <Text style={styles.emptyStateText}>
                        "{searchQuery}" için arama sonucu bulunamadı.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>👥</Text>
                      <Text style={styles.emptyStateTitle}>Arkadaş ara</Text>
                      <Text style={styles.emptyStateText}>
                        İsim veya email ile arkadaş arayın.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                (() => {
                  console.log('=== RENDERING FRIENDS LIST ===');
                  console.log('Rendering friends list, friends.length:', friends.length);
                  console.log('Friends data:', friends);
                  const friendsData = getFriendsWithOnlineStatus();
                  console.log('getFriendsWithOnlineStatus result:', friendsData);
                  
                  return friends.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateIcon}>👥</Text>
                      <Text style={styles.emptyStateTitle}>Arkadaş listesi boş</Text>
                      <Text style={styles.emptyStateText}>
                        Henüz arkadaşınız bulunmuyor.
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={friendsData}
                      renderItem={renderFriend}
                      keyExtractor={item => item.id}
                      style={styles.friendsList}
                      showsVerticalScrollIndicator={false}
                    />
                  );
                })()
              )}
            </>
          )}
        </View>
      </SafeAreaView>

      {/* Profil Popup */}
      {showProfilePopup && (
        <View style={styles.popupOverlay}>
          <View style={styles.profilePopup}>
            {/* Header */}
            <View style={styles.popupHeader}>
              <Text style={styles.popupTitle}>Profil</Text>
              <TouchableOpacity 
                style={styles.popupCloseButton}
                onPress={() => setShowProfilePopup(false)}
              >
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Profil İçeriği */}
            <View style={styles.popupContent}>
              {/* Profil Fotoğrafı */}
              <View style={styles.popupImageContainer}>
                {selectedFriend?.profilePicture ? (
                  <Image
                    source={{ uri: `http://192.168.1.2:3000${selectedFriend.profilePicture}` }}
                    style={styles.popupProfileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.popupDefaultImage}>
                    <Ionicons name="person" size={50} color={colors.text.secondary} />
                  </View>
                )}
              </View>

              {/* Kullanıcı Bilgileri */}
              <View style={styles.popupInfo}>
                <Text style={styles.popupName}>{selectedFriend?.name}</Text>
                
                {/* Yaş Bilgisi */}
                <View style={styles.popupAgeContainer}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                  <Text style={styles.popupAgeText}>
                    {selectedFriend?.age ? `${selectedFriend.age} yaşında` : 'Yaş bilgisi yok'}
                  </Text>
                </View>


                {/* Durum Bilgisi */}
                <View style={styles.popupStatusContainer}>
                  <View style={[
                    styles.popupStatusIndicator,
                    { backgroundColor: getStatusColor(selectedFriend?.status) }
                  ]} />
                  <Text style={styles.popupStatusText}>
                    {selectedFriend?.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}
                  </Text>
                </View>
              </View>

              {/* Aksiyon Butonları */}
              <View style={styles.popupActions}>
                <TouchableOpacity 
                  style={styles.popupMessageButton}
                  onPress={() => {
                    console.log('🚀 ChatScreen: Mesaj Gönder butonuna tıklandı');
                    console.log('🚀 ChatScreen: selectedFriend:', selectedFriend);
                    setShowProfilePopup(false);
                    console.log('🚀 ChatScreen: PrivateChat ekranına yönlendiriliyor...');
                    navigation.navigate('PrivateChat', { friend: selectedFriend });
                  }}
                >
                  <Ionicons name="chatbubble" size={20} color={colors.text.light} />
                  <Text style={styles.popupButtonText}>Mesaj Gönder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  localChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  localChatButtonText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: colors.text.light,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.light,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.overlayLight,
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.text.light,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messageContainer: {
    backgroundColor: colors.surface,
    marginVertical: 5,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    fontSize: 24,
    marginRight: 10,
  },
  messageInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  messageTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  messageText: {
    fontSize: 16,
    color: colors.text.primary,
    lineHeight: 22,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: Platform.OS === 'ios' ? 15 : 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    minHeight: 60,
  },
  messageInput: {
    flex: 1,
    backgroundColor: colors.darkGray,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginRight: 10,
    maxHeight: 100,
    minHeight: 40,
    fontSize: 16,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow.red,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: colors.lightGray,
    shadowOpacity: 0.1,
  },
  chatsList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  chatAvatar: {
    position: 'relative',
    marginRight: 15,
  },
  chatAvatarText: {
    fontSize: 32,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: colors.text.light,
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  chatTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  chatLastMessage: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  // Friends styles
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  friendAvatar: {
    position: 'relative',
    marginRight: 15,
  },
  friendAvatarText: {
    fontSize: 32,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  friendContent: {
    flex: 1,
  },
  friendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  friendLastSeen: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  mutualFriends: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
  },
  messageFriendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryAlpha,
  },
  removeFriendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.errorAlpha || 'rgba(255, 59, 48, 0.1)',
  },
  emptyRequestsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyRequestsText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyRequestsSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Kendi mesajlarımız için özel stiller
  ownMessageContainer: {
    backgroundColor: colors.primaryAlpha,
    borderColor: colors.primary,
    alignSelf: 'flex-end',
    marginLeft: 50,
  },
  ownUserName: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  ownMessageTime: {
    color: colors.primary,
  },
  ownMessageText: {
    color: colors.text.primary,
    fontWeight: '500',
  },
  // Boş durum stilleri
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Arama stilleri
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkGray,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  clearSearchButton: {
    padding: 5,
  },
  addFriendHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryAlpha,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  searchResultsList: {
    flex: 1,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  searchResultAvatar: {
    marginRight: 15,
  },
  searchResultAvatarText: {
    fontSize: 32,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultHeader: {
    marginBottom: 5,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  searchResultEmail: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  searchResultMutual: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  addFriendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  sentRequestButton: {
    backgroundColor: colors.success || '#4CAF50',
  },
  messageStatus: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Arkadaşlık istekleri stilleri
  friendRequestsSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  friendRequestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  friendRequestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  toggleRequestsButton: {
    padding: 5,
  },
  friendRequestsList: {
    maxHeight: 200,
  },
  friendRequestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  friendRequestAvatar: {
    marginRight: 15,
  },
  friendRequestAvatarText: {
    fontSize: 32,
  },
  friendRequestContent: {
    flex: 1,
  },
  friendRequestName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  friendRequestEmail: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  friendRequestTime: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  friendRequestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    backgroundColor: colors.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: colors.error,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Profil Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModal: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContent: {
    flex: 1,
  },
  profileImageContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  defaultProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 30,
    marginBottom: 30,
  },
  profileName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  ageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  ageText: {
    fontSize: 18,
    color: colors.text.primary,
    marginLeft: 10,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingBottom: 30,
    gap: 15,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 25,
    gap: 8,
    elevation: 5,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 15,
    borderRadius: 25,
    gap: 8,
    elevation: 5,
    shadowColor: colors.success,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  buttonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Popup Stilleri
  popupOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  profilePopup: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 25,
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 15,
    },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 25,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.darkGray,
  },
  popupTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
    letterSpacing: 0.5,
  },
  popupCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryAlpha,
  },
  popupContent: {
    padding: 25,
  },
  popupImageContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  popupProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  popupDefaultImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.darkGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  popupInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  popupName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  popupAgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: colors.darkGray,
    borderRadius: 20,
    gap: 10,
  },
  popupAgeText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  popupStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: colors.darkGray,
    borderRadius: 20,
    gap: 10,
  },
  popupStatusIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  popupStatusText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  popupActions: {
    flexDirection: 'row',
    gap: 0,
  },
  popupMessageButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    gap: 10,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  popupButtonText: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
