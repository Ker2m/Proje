import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
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

export default function PrivateChatScreen({ navigation, route }) {
  console.log('🚀 PrivateChatScreen: Component başlatıldı');
  console.log('🚀 PrivateChatScreen: Route params:', route.params);
  
  const { friend } = route.params;
  console.log('🚀 PrivateChatScreen: Friend data:', friend);
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const flatListRef = useRef(null);

  // messages state değişimini takip et
  useEffect(() => {
    console.log('📥 PrivateChatScreen: Messages state değişti:', messages.length, 'mesaj');
    console.log('📥 PrivateChatScreen: Messages içeriği:', messages);
  }, [messages]);

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

  // Özel mesaj geçmişini yükle
  const loadPrivateMessageHistory = useCallback(async () => {
    console.log('📥 PrivateChatScreen: loadPrivateMessageHistory başlatıldı');
    try {
      setIsLoading(true);
      const token = await apiService.getStoredToken();
      if (!token) {
        console.log('Token bulunamadı, mesaj geçmişi yüklenemiyor');
        return;
      }
      
      apiService.setToken(token);
      console.log('📥 PrivateChatScreen: Mesaj geçmişi yükleniyor, arkadaş ID:', friend.id);
      const response = await apiService.get(`/chat/private/history?friendId=${friend.id}&limit=50`);
      
      console.log('📥 PrivateChatScreen: Mesaj geçmişi API yanıtı:', response);
      if (response.success && response.data) {
        console.log('📥 PrivateChatScreen: Ham mesaj verisi:', response.data);
        const formattedMessages = response.data.map(msg => {
          const isOwn = currentUser && 
                       currentUser.id && 
                       msg.senderId && 
                       String(msg.senderId) === String(currentUser.id);
          
          console.log('📥 PrivateChatScreen: Mesaj işleniyor:', {
            senderId: msg.senderId,
            currentUserId: currentUser?.id,
            isOwn: isOwn,
            message: msg.message
          });
          
          return {
            id: `${msg.senderId}-${msg.timestamp}`,
            user: msg.senderName || `Kullanıcı ${String(msg.senderId || 'unknown').slice(-4)}`,
            message: msg.message,
            time: new Date(msg.timestamp).toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            avatar: '👤',
            senderId: msg.senderId,
            isOwn: isOwn,
          };
        });
        
        console.log('📥 PrivateChatScreen: İşlenmiş mesajlar:', formattedMessages);
        setMessages(formattedMessages.reverse());
        console.log(`📥 PrivateChatScreen: ${formattedMessages.length} özel mesaj yüklendi`);
        console.log('📥 PrivateChatScreen: setMessages çağrıldı, messages state güncellenecek');
      } else {
        console.log('📥 PrivateChatScreen: API yanıtı başarısız veya data yok:', response);
      }
    } catch (error) {
      console.error('Özel mesaj geçmişi yüklenirken hata:', error);
    } finally {
      setIsLoading(false);
      console.log('📥 PrivateChatScreen: loadPrivateMessageHistory tamamlandı');
    }
  }, [currentUser, friend.id]);

  // Sohbeti sil (tüm mesajları temizle)
  const clearChat = () => {
    Alert.alert(
      'Sohbeti Temizle',
      'Tüm mesajları silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              // Backend'den mesajları sil
              const token = await apiService.getStoredToken();
              if (token) {
                apiService.setToken(token);
                console.log('🗑️ PrivateChatScreen: Backend\'den mesajlar siliniyor...');
                const response = await apiService.delete(`/chat/private/clear?friendId=${friend.id}`);
                if (response.success) {
                  console.log('🗑️ PrivateChatScreen: Backend\'den mesajlar silindi');
                } else {
                  console.log('🗑️ PrivateChatScreen: Backend silme hatası:', response.message);
                }
              }
              
              // Frontend'den mesajları temizle
              setMessages([]);
              setShowChatMenu(false);
              console.log('🗑️ PrivateChatScreen: Sohbet temizlendi');
            } catch (error) {
              console.error('🗑️ PrivateChatScreen: Sohbet temizleme hatası:', error);
              // Hata olsa bile frontend'den temizle
              setMessages([]);
              setShowChatMenu(false);
            }
          },
        },
      ]
    );
  };

  // Event handler'ları useCallback ile tanımla
  const handlePrivateMessageReceived = useCallback((data) => {
    console.log('🔔🔔🔔 PrivateChatScreen: YENİ ÖZEL MESAJ ALINDI!', data);
    console.log('🔔 PrivateChatScreen: senderId:', data.senderId, 'friend.id:', friend.id);
    console.log('🔔 PrivateChatScreen: currentUser.id:', currentUser?.id);
    console.log('🔔 PrivateChatScreen: Socket connected:', isSocketConnected);
    
    // currentUser yoksa mesajı işle (kullanıcı bilgileri henüz yüklenmemiş olabilir)
    if (!currentUser || !currentUser.id) {
      console.log('🔔 PrivateChatScreen: Current user yok, mesaj işleniyor');
    } else {
      // Sadece bu arkadaştan gelen mesajları işle
      if (String(data.senderId) !== String(friend.id)) {
        console.log('🔔 PrivateChatScreen: Bu mesaj bu arkadaştan değil, işlenmiyor');
        return;
      }
      
      console.log('🔔 PrivateChatScreen: Mesaj bu arkadaştan, işleniyor');
      
      const currentUserId = String(currentUser.id);
      const senderId = data.senderId ? String(data.senderId) : null;
      
      // Kendi mesajımızı filtrele - optimistic update zaten eklenmiş
      if (currentUserId && senderId && currentUserId === senderId) {
        console.log('🔔 PrivateChatScreen: Kendi mesajımız (socket\'ten), eklenmiyor');
        return;
      }
    }
    
    const timestamp = data.timestamp || new Date().toISOString();
    const safeSenderId = data.senderId ? String(data.senderId) : 'unknown';
    // Mesaj gönderen kişinin bilgilerini belirle
    const isFromCurrentUser = currentUser && currentUser.id && String(data.senderId) === String(currentUser.id);
    const messageUser = isFromCurrentUser ? 
      `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || 'Sen' :
      friend.name || `Kullanıcı ${safeSenderId.slice(-4)}`;
    
    const newMessage = {
      id: `socket-${safeSenderId}-${timestamp}`,
      user: messageUser,
      message: data.message || '',
      time: new Date(timestamp).toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      avatar: '👤',
      senderId: data.senderId,
      isOwn: isFromCurrentUser,
      timestamp: timestamp,
    };
    
    console.log('🔔 PrivateChatScreen: Yeni özel mesaj oluşturuldu:', newMessage);
    
    setMessages(prev => {
      console.log('🔔 PrivateChatScreen: Mevcut mesaj sayısı:', prev.length);
      console.log('🔔 PrivateChatScreen: Yeni mesaj ID:', newMessage.id);
      console.log('🔔 PrivateChatScreen: Yeni mesaj senderId:', newMessage.senderId);
      console.log('🔔 PrivateChatScreen: Yeni mesaj message:', newMessage.message);
      
      // Duplicate mesajları kontrol et - çok güçlü kontrol
      const exists = prev.some(msg => {
        const isSameId = msg.id === newMessage.id;
        const isSameSenderAndMessage = msg.senderId === newMessage.senderId && 
                                      msg.message === newMessage.message;
        const isSameSenderAndTime = msg.senderId === newMessage.senderId && 
                                   Math.abs(new Date(msg.time).getTime() - new Date(newMessage.time).getTime()) < 2000;
        
        console.log('🔔 PrivateChatScreen: Duplicate kontrol:', {
          msgId: msg.id,
          newId: newMessage.id,
          isSameId,
          msgSender: msg.senderId,
          newSender: newMessage.senderId,
          msgMessage: msg.message,
          newMessage: newMessage.message,
          isSameSenderAndMessage,
          isSameSenderAndTime
        });
        
        return isSameId || isSameSenderAndMessage || isSameSenderAndTime;
      });
      
      if (exists) {
        console.log('🔔 PrivateChatScreen: Mesaj zaten mevcut, eklenmiyor');
        return prev;
      }
      
      console.log('🔔 PrivateChatScreen: Mesaj listeye ekleniyor');
      const updatedMessages = [...prev, newMessage];
      console.log('🔔 PrivateChatScreen: Güncellenmiş mesaj sayısı:', updatedMessages.length);
      
      // Yeni mesaj eklendikten sonra en alta scroll et
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      return updatedMessages;
    });
  }, [currentUser, friend]);

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
    console.log('🔌 PrivateChatScreen: Socket bağlantısı başlatılıyor...');
    
    // Socket bağlantısını başlat
    socketService.connect();

    // Socket bağlantısını kontrol et
    const checkConnection = () => {
      const connected = socketService.isSocketConnected();
      if (connected) {
        console.log('🔌 PrivateChatScreen: Socket bağlantısı kuruldu');
        setIsSocketConnected(true);
        // Özel odaya katıl
        const roomName = `private_${Math.min(currentUser?.id || 0, friend.id)}_${Math.max(currentUser?.id || 0, friend.id)}`;
        console.log('🔌 PrivateChatScreen: Özel odaya katılmaya çalışılıyor:', roomName);
        const joinResult = socketService.joinRoom(roomName);
        console.log('🔌 PrivateChatScreen: Özel odaya katılma sonucu:', joinResult);
      } else {
        console.log('🔌 PrivateChatScreen: Socket bağlantısı yok, tekrar denenecek...');
        setIsSocketConnected(false);
        setTimeout(checkConnection, 1000);
      }
    };

    // İlk kontrol
    checkConnection();

    // Event listener'ları kaydet
    console.log('🔌 PrivateChatScreen: Event listener\'lar kaydediliyor...');
    console.log('🔌 PrivateChatScreen: handlePrivateMessageReceived fonksiyonu:', typeof handlePrivateMessageReceived);
    socketService.on('private_message_received', handlePrivateMessageReceived);
    socketService.on('connection_error', handleConnectionError);
    socketService.on('connection_status', handleConnectionStatus);
    console.log('🔌 PrivateChatScreen: Event listener\'lar kaydedildi');
    console.log('🔌 PrivateChatScreen: SocketService listeners:', Object.keys(socketService.listeners));

    // Cleanup function
    return () => {
      console.log('🔌 PrivateChatScreen: Event listener\'lar temizleniyor...');
      socketService.off('private_message_received', handlePrivateMessageReceived);
      socketService.off('connection_error', handleConnectionError);
      socketService.off('connection_status', handleConnectionStatus);
    };
  }, [currentUser, friend]);

  // currentUser yüklendikten sonra mesaj geçmişini yükle
  useEffect(() => {
    console.log('🔄 PrivateChatScreen: useEffect tetiklendi - currentUser:', !!currentUser, 'isSocketConnected:', isSocketConnected);
    if (currentUser && isSocketConnected) {
      console.log('🔄 PrivateChatScreen: Mesaj geçmişi yükleniyor...');
      loadPrivateMessageHistory();
    } else {
      console.log('🔄 PrivateChatScreen: Mesaj geçmişi yüklenemiyor - currentUser:', !!currentUser, 'isSocketConnected:', isSocketConnected);
    }
  }, [currentUser, isSocketConnected, loadPrivateMessageHistory]);

  // Component unmount olduğunda socket bağlantısını kapat
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const sendPrivateMessage = async () => {
    if (message.trim()) {
      const messageText = message.trim();
      console.log('📤 PrivateChatScreen: Özel mesaj gönderiliyor:', messageText);
      
      // Socket bağlantısını kontrol et
      if (!isSocketConnected) {
        console.log('📤 PrivateChatScreen: Socket bağlantısı yok, mesaj gönderilemiyor');
        Alert.alert('Bağlantı Hatası', 'Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
        return;
      }
      
      // Kendi mesajınızı hemen ekleyin (optimistic update)
      const userId = currentUser?.id ? String(currentUser.id) : 'unknown';
      const userName = currentUser ? 
        `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 
        'Sen';
      
      const timestamp = Date.now();
      const newMessage = {
        id: `own-${userId}-${timestamp}`,
        user: userName,
        message: messageText,
        time: new Date(timestamp).toLocaleTimeString('tr-TR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        avatar: '👤',
        senderId: userId,
        isOwn: true,
        timestamp: new Date(timestamp).toISOString(),
      };
      
      console.log('📤 PrivateChatScreen: Optimistic update - mesaj eklendi:', newMessage);
      setMessages(prev => [...prev, newMessage]);
      
      // Backend'e özel mesajı kaydet
      try {
        const token = await apiService.getStoredToken();
        if (token) {
          apiService.setToken(token);
          console.log('📤 PrivateChatScreen: Backend\'e özel mesaj kaydediliyor...');
          console.log('📤 PrivateChatScreen: Mesaj:', messageText, 'Arkadaş ID:', friend.id);
          const response = await apiService.post('/chat/private/send', {
            message: messageText,
            friendId: friend.id
          });
          
          console.log('📤 PrivateChatScreen: Backend yanıtı:', response);
          if (response.success) {
            console.log('📤 PrivateChatScreen: Özel mesaj backend\'e kaydedildi');
          } else {
            console.log('📤 PrivateChatScreen: Backend hata:', response.message);
          }
        } else {
          console.log('📤 PrivateChatScreen: Token bulunamadı');
        }
      } catch (error) {
        console.error('📤 PrivateChatScreen: Backend özel mesaj kaydetme hatası:', error);
      }
      
      // Socket.io ile özel mesaj gönder
      console.log('📤 PrivateChatScreen: Socket ile özel mesaj gönderiliyor...');
      const roomName = `private_${Math.min(currentUser?.id || 0, friend.id)}_${Math.max(currentUser?.id || 0, friend.id)}`;
      console.log('📤 PrivateChatScreen: Socket ile mesaj gönderiliyor - room:', roomName, 'friendId:', friend.id);
      const sentMessage = socketService.sendPrivateMessage(messageText, friend.id, roomName);
      console.log('📤 PrivateChatScreen: Socket gönderim sonucu:', sentMessage);
      
      if (sentMessage) {
        console.log('📤 PrivateChatScreen: Özel mesaj başarıyla gönderildi');
      } else {
        console.log('📤 PrivateChatScreen: Özel mesaj gönderilemedi');
        Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
        // Hata durumunda mesajı geri al
        setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }
      
      setMessage('');
    }
  };

  const renderMessage = ({ item }) => {
    console.log('🎨 PrivateChatScreen: Mesaj render ediliyor:', {
      id: item.id,
      message: item.message,
      isOwn: item.isOwn,
      user: item.user
    });
    return (
      <View style={[
        styles.messageWrapper,
        item.isOwn && styles.ownMessageWrapper
      ]}>
      <View style={[
        styles.messageContainer,
        item.isOwn && styles.ownMessageContainer
      ]}>
        {!item.isOwn && (
          <View style={styles.messageAvatar}>
            <View style={styles.avatarContainer}>
              {friend.profilePicture ? (
                <Image
                  source={{ uri: `http://192.168.1.2:3000${friend.profilePicture}` }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.avatar}>{item.avatar}</Text>
              )}
            </View>
          </View>
        )}
        
        <View style={styles.messageContent}>
          {!item.isOwn && (
            <Text style={styles.userName}>
              {item.user}
            </Text>
          )}
          
          <View style={[
            styles.messageBubble,
            item.isOwn && styles.ownMessageBubble
          ]}>
            <Text style={[
              styles.messageText,
              item.isOwn && styles.ownMessageText
            ]}>
              {item.message}
            </Text>
          </View>
          
          <View style={[
            styles.messageFooter,
            item.isOwn && styles.ownMessageFooter
          ]}>
            <Text style={[
              styles.messageTime,
              item.isOwn && styles.ownMessageTime
            ]}>
              {item.time}
            </Text>
            {item.isOwn && (
              <Ionicons 
                name="checkmark-done" 
                size={14} 
                color={colors.success} 
              />
            )}
          </View>
        </View>
      </View>
    </View>
    );
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
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text.light} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <View style={styles.headerUserInfo}>
                {friend.profilePicture ? (
                  <Image
                    source={{ uri: `http://192.168.1.2:3000${friend.profilePicture}` }}
                    style={styles.headerAvatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.headerDefaultAvatar}>
                    <Ionicons name="person" size={20} color={colors.text.light} />
                  </View>
                )}
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>{friend.name}</Text>
                </View>
              </View>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>💬</Text>
              <Text style={styles.emptyStateTitle}>Henüz mesaj yok</Text>
              <Text style={styles.emptyStateText}>
                {friend.name} ile sohbete başlayın!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={(() => {
                console.log('📊 PrivateChatScreen: FlatList data prop:', messages.length, 'mesaj');
                console.log('📊 PrivateChatScreen: FlatList data içeriği:', messages);
                return messages;
              })()}
              renderItem={renderMessage}
              keyExtractor={item => {
                console.log('🔑 PrivateChatScreen: keyExtractor çağrıldı, item.id:', item.id);
                return item.id;
              }}
              style={styles.messagesList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => {
                console.log('📏 PrivateChatScreen: FlatList content size değişti, messages.length:', messages.length);
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }}
              onLayout={() => {
                console.log('📐 PrivateChatScreen: FlatList layout tamamlandı, messages.length:', messages.length);
              }}
            />
          )}
          
            {/* Message Input */}
            <View style={styles.messageInputContainer}>
              <View style={styles.inputRow}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.messageInput}
                    placeholder={`${friend.name} ile mesajlaşın...`}
                    placeholderTextColor={colors.text.tertiary}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !isSocketConnected && styles.sendButtonDisabled,
                      message.trim() && styles.sendButtonActive
                    ]}
                    onPress={sendPrivateMessage}
                    disabled={!isSocketConnected || !message.trim()}
                  >
                    <LinearGradient
                      colors={message.trim() ? colors.gradients.primary : [colors.lightGray, colors.lightGray]}
                      style={styles.sendButtonGradient}
                    >
                      <Ionicons 
                        name={isSocketConnected ? "send" : "warning"} 
                        size={20} 
                        color={isSocketConnected ? colors.text.light : colors.warning} 
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={styles.menuButton}
                  onPress={() => {
                    console.log('🔘 Menu button pressed!');
                    setShowChatMenu(!showChatMenu);
                  }}
                >
                  <Ionicons name="ellipsis-vertical" size={24} color={colors.text.primary} />
                </TouchableOpacity>
              </View>
              
              {/* Chat Menu Options */}
              {showChatMenu && (
                <View style={styles.chatMenuContainer}>
                  <TouchableOpacity 
                    style={styles.chatMenuItem}
                    onPress={clearChat}
                  >
                    <Ionicons name="trash" size={20} color={colors.error} />
                    <Text style={[styles.chatMenuItemText, { color: colors.error }]}>
                      Sohbeti Temizle
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.chatMenuItem}
                    onPress={() => setShowChatMenu(false)}
                  >
                    <Ionicons name="close" size={20} color={colors.text.secondary} />
                    <Text style={[styles.chatMenuItemText, { color: colors.text.secondary }]}>
                      İptal
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              
            {message.length > 0 && (
              <Text style={styles.characterCount}>
                {message.length}/500
              </Text>
            )}
          </View>
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
  
  // Header Styles
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.text.light,
  },
  headerDefaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.text.light,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text.light,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerSpacer: {
    width: 48,
  },
  
  // Content Styles
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  
  // Message Styles
  messageWrapper: {
    marginVertical: 4,
    paddingHorizontal: 4,
  },
  ownMessageWrapper: {
    alignItems: 'flex-end',
  },
  messageContainer: {
    flexDirection: 'row',
    maxWidth: '85%',
    alignItems: 'flex-end',
  },
  ownMessageContainer: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
  },
  
  // Avatar Styles
  messageAvatar: {
    marginRight: 8,
    marginBottom: 2,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatar: {
    fontSize: 18,
    color: colors.text.light,
  },
  
  // Message Content
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
    marginLeft: 8,
  },
  
  // Message Bubble
  messageBubble: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 4,
    borderColor: colors.primary,
    alignSelf: 'flex-end',
  },
  
  // Message Text
  messageText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 20,
    fontWeight: '400',
  },
  ownMessageText: {
    color: colors.text.light,
    fontWeight: '500',
  },
  
  // Message Footer
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 8,
  },
  ownMessageFooter: {
    justifyContent: 'flex-end',
    marginRight: 8,
  },
  messageTime: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '400',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginRight: 4,
  },
  
  // Input Styles
  messageInputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.darkGray,
    borderRadius: 25,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text.primary,
    textAlignVertical: 'top',
    maxHeight: 100,
    minHeight: 20,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow.red,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonActive: {
    transform: [{ scale: 1.05 }],
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  characterCount: {
    fontSize: 12,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 80,
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: colors.text.secondary,
    marginTop: 12,
  },
  
  // Menu Styles
  menuButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMenuContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingVertical: 8,
    marginTop: 8,
    borderRadius: 12,
  },
  chatMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatMenuItemText: {
    fontSize: 16,
    color: colors.text.primary,
    marginLeft: 12,
    fontWeight: '500',
  },
});
