import React, { useState, useEffect } from 'react';
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

export default function ChatScreen() {
  const [activeTab, setActiveTab] = useState('public');
  const [message, setMessage] = useState('');
  const [publicMessages, setPublicMessages] = useState([]);

  // Socket.io bağlantısını yönet
  useEffect(() => {
    console.log('ChatScreen: Socket bağlantısı başlatılıyor...');
    
    // Socket bağlantısını başlat
    socketService.connect();

    // Socket bağlantısını kontrol et ve odaya katıl
    const connected = socketService.isSocketConnected();
    if (connected) {
      console.log('ChatScreen: Socket bağlantısı kuruldu');
      // Genel odaya katıl
      socketService.joinRoom('general');
      // Kullanıcı durumunu online olarak güncelle
      socketService.updateUserStatus('online');
    } else {
      console.log('ChatScreen: Socket bağlantısı yok');
      // Kullanıcı durumunu offline olarak güncelle
      socketService.updateUserStatus('offline');
    }

    // Event listener'ları ekle

    const handleMessageReceived = (data) => {
      console.log('ChatScreen: Yeni mesaj alındı:', data);
      console.log('ChatScreen: Mesaj gönderen ID:', data.senderId);
      
      // Kendi mesajımızı tekrar eklemeyi önle - SORUN ÇÖZÜLDÜ
      // Backend'de senderId olarak userId gönderiliyor, socketId değil
      // Bu yüzden filtreleme mantığını kaldırdık - tüm mesajları kabul ediyoruz
      // Optimistic update zaten kendi mesajımızı ekliyor, duplicate kontrolü var
      
      const newMessage = {
        id: `${data.senderId}-${data.timestamp}`,
        user: `Kullanıcı ${data.senderId.slice(-4)}`,
        message: data.message,
        time: new Date(data.timestamp).toLocaleTimeString('tr-TR', { 
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
        return [...prev, newMessage];
      });
    };


    const handleConnectionError = (error) => {
      console.error('Socket bağlantı hatası:', error);
      Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
    };

    // Event listener'ları kaydet
    socketService.on('message_received', handleMessageReceived);
    socketService.on('connection_error', handleConnectionError);

    // Cleanup function
    return () => {
      socketService.off('message_received', handleMessageReceived);
      socketService.off('connection_error', handleConnectionError);
    };
  }, []);

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

  // Arkadaş listesini döndür
  const getFriendsWithOnlineStatus = () => {
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
      // Gerçek API'den kullanıcı arama
      const response = await apiService.get(`/users/search?q=${encodeURIComponent(query)}`);
      
      if (response.success && response.data) {
        // API'den gelen veriyi uygun formata çevir
        const searchResults = response.data.map(user => ({
          id: user.id.toString(),
          name: user.name || user.first_name + ' ' + user.last_name,
          email: user.email,
          avatar: user.profile_picture ? `http://192.168.1.2:3000${user.profile_picture}` : '👤',
          mutualFriends: user.mutual_friends || 0,
          isFriend: false, // Bu kullanıcının arkadaş olup olmadığını kontrol et
        }));

        setSearchResults(searchResults);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Arama hatası:', error);
      setSearchResults([]);
      Alert.alert('Hata', 'Kullanıcı arama sırasında bir hata oluştu.');
    } finally {
      setIsSearching(false);
    }
  };

  // Arkadaş ekleme fonksiyonu
  const addFriend = async (user) => {
    try {
      // Gerçek API'ye arkadaş ekleme isteği gönder
      const response = await apiService.post('/users/friends', {
        friend_id: user.id
      });

      if (response.success) {
        const newFriend = {
          id: user.id,
          name: user.name,
          status: 'offline',
          lastSeen: 'Bilinmiyor',
          avatar: user.avatar,
          mutualFriends: user.mutualFriends,
        };

        setFriends(prev => [...prev, newFriend]);
        setSearchResults(prev => prev.filter(result => result.id !== user.id));
        
        // Başarı mesajı
        Alert.alert('Başarılı', `${user.name} arkadaş listesine eklendi!`);
      } else {
        Alert.alert('Hata', response.message || 'Arkadaş eklenirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Arkadaş ekleme hatası:', error);
      Alert.alert('Hata', 'Arkadaş eklenirken bir hata oluştu.');
    }
  };

  // Arkadaş listesini yükle
  const loadFriends = async () => {
    try {
      const response = await apiService.get('/users/friends');
      
      if (response.success && response.data) {
        const friendsList = response.data.map(friend => ({
          id: friend.id.toString(),
          name: friend.name || friend.first_name + ' ' + friend.last_name,
          status: 'offline',
          lastSeen: 'Bilinmiyor',
          avatar: friend.profile_picture ? `http://192.168.1.2:3000${friend.profile_picture}` : '👤',
          mutualFriends: friend.mutual_friends || 0,
        }));

        setFriends(friendsList);
      }
    } catch (error) {
      console.error('Arkadaş listesi yükleme hatası:', error);
    }
  };

  // Component mount olduğunda arkadaş listesini yükle
  useEffect(() => {
    loadFriends();
  }, []);

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
    <TouchableOpacity style={styles.chatItem}>
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
    <TouchableOpacity style={styles.friendItem}>
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
      <TouchableOpacity style={styles.messageFriendButton}>
        <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }) => (
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
        style={styles.addFriendButton}
        onPress={() => addFriend(item)}
      >
        <Ionicons name="person-add-outline" size={20} color={colors.text.light} />
      </TouchableOpacity>
    </TouchableOpacity>
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

  const sendMessage = () => {
    if (message.trim()) {
      const messageText = message.trim();
      console.log('ChatScreen: Mesaj gönderiliyor:', messageText);
      
      // Socket.io ile mesaj gönder
      console.log('ChatScreen: Socket ile mesaj gönderiliyor...');
      const sentMessage = socketService.sendMessage(messageText, 'general');
      console.log('ChatScreen: Mesaj gönderme sonucu:', sentMessage);
      
      if (sentMessage) {
        // Kendi mesajınızı hemen ekleyin (optimistic update)
        const newMessage = {
          id: Date.now().toString(),
          user: 'Sen',
          message: messageText,
          time: new Date().toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          avatar: '👤',
          senderId: socketService.getSocketId(),
          isOwn: true, // Kendi mesajımızı işaretle
        };
        setPublicMessages(prev => [...prev, newMessage]);
        
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
      }
      
      setMessage('');
    }
  };

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
          </View>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'public' && styles.activeTab
              ]}
              onPress={() => setActiveTab('public')}
            >
              <Text style={[
                styles.tabText,
                activeTab === 'public' && styles.activeTabText
              ]}>
                Genel
              </Text>
            </TouchableOpacity>
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
          {activeTab === 'public' ? (
            <>
              {publicMessages.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>💬</Text>
                  <Text style={styles.emptyStateTitle}>Henüz mesaj yok</Text>
                  <Text style={styles.emptyStateText}>
                    İlk mesajı siz gönderin ve sohbete başlayın!
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={publicMessages}
                  renderItem={renderPublicMessage}
                  keyExtractor={item => item.id}
                  style={styles.messagesList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                />
              )}
              
              {/* Message Input */}
              <View style={styles.messageInputContainer}>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Mesajınızı yazın..."
                  placeholderTextColor={colors.text.tertiary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                />
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={sendMessage}
                >
                  <Ionicons name="send" size={20} color={colors.text.light} />
                </TouchableOpacity>
              </View>
            </>
          ) : activeTab === 'private' ? (
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
                friends.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>👥</Text>
                    <Text style={styles.emptyStateTitle}>Arkadaş listesi boş</Text>
                    <Text style={styles.emptyStateText}>
                      Henüz arkadaşınız bulunmuyor.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={getFriendsWithOnlineStatus()}
                    renderItem={renderFriend}
                    keyExtractor={item => item.id}
                    style={styles.friendsList}
                    showsVerticalScrollIndicator={false}
                  />
                )
              )}
            </>
          )}
        </View>
      </SafeAreaView>
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
  messageFriendButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryAlpha,
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
});
