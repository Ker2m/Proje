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

export default function LocalChatScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
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

  // Mesaj geçmişini yükle
  const loadMessageHistory = useCallback(async () => {
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
        const formattedMessages = response.data.map(msg => {
          const isOwn = currentUser && 
                       currentUser.id && 
                       msg.senderId && 
                       String(msg.senderId) === String(currentUser.id);
          
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
        
        setMessages(formattedMessages.reverse());
        console.log(`${formattedMessages.length} mesaj yüklendi`);
      }
    } catch (error) {
      console.error('Mesaj geçmişi yüklenirken hata:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Event handler'ları useCallback ile tanımla
  const handleMessageReceived = useCallback((data) => {
    console.log('🔔🔔🔔 LocalChatScreen: YENİ MESAJ ALINDI!', data);
    console.log('🔔 LocalChatScreen: Current user ID:', currentUser?.id);
    console.log('🔔 LocalChatScreen: Sender ID:', data.senderId);
    console.log('🔔 LocalChatScreen: Data type check - senderId:', typeof data.senderId, data.senderId);
    console.log('🔔 LocalChatScreen: Data type check - currentUser.id:', typeof currentUser?.id, currentUser?.id);
    console.log('🔔 LocalChatScreen: Socket connected:', isSocketConnected);
    
    // Güvenli string dönüşümü
    const currentUserId = currentUser?.id ? String(currentUser.id) : null;
    const senderId = data.senderId ? String(data.senderId) : null;
    
    console.log('🔔 LocalChatScreen: String dönüşümü - currentUserId:', currentUserId);
    console.log('🔔 LocalChatScreen: String dönüşümü - senderId:', senderId);
    
    // Kendi mesajımızı filtrele - optimistic update zaten eklenmiş
    if (currentUserId && senderId && currentUserId === senderId) {
      console.log('🔔 LocalChatScreen: Kendi mesajımız (socket\'ten), eklenmiyor - zaten optimistic update ile eklendi');
      return;
    }
    
    const timestamp = data.timestamp || new Date().toISOString();
    const safeSenderId = senderId || 'unknown';
    const newMessage = {
      id: `socket-${safeSenderId}-${timestamp}`,
      user: data.senderEmail || `Kullanıcı ${safeSenderId.slice(-4)}`,
      message: data.message || '',
      time: new Date(timestamp).toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      avatar: '👤',
      senderId: data.senderId,
      isOwn: false,
      timestamp: timestamp,
    };
    
    console.log('🔔 LocalChatScreen: Yeni mesaj oluşturuldu:', newMessage);
    
    setMessages(prev => {
      console.log('🔔 LocalChatScreen: Mevcut mesaj sayısı:', prev.length);
      console.log('🔔 LocalChatScreen: Yeni mesaj ID:', newMessage.id);
      console.log('🔔 LocalChatScreen: Yeni mesaj senderId:', newMessage.senderId);
      console.log('🔔 LocalChatScreen: Yeni mesaj message:', newMessage.message);
      
      // Duplicate mesajları kontrol et - çok güçlü kontrol
      const exists = prev.some(msg => {
        const isSameId = msg.id === newMessage.id;
        const isSameSenderAndMessage = msg.senderId === newMessage.senderId && 
                                      msg.message === newMessage.message;
        const isSameSenderAndTime = msg.senderId === newMessage.senderId && 
                                   Math.abs(new Date(msg.time).getTime() - new Date(newMessage.time).getTime()) < 2000;
        
        console.log('🔔 LocalChatScreen: Duplicate kontrol:', {
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
        console.log('🔔 LocalChatScreen: Mesaj zaten mevcut, eklenmiyor');
        return prev;
      }
      console.log('🔔 LocalChatScreen: Mesaj listeye ekleniyor');
      const updatedMessages = [...prev, newMessage];
      console.log('🔔 LocalChatScreen: Güncellenmiş mesaj sayısı:', updatedMessages.length);
      return updatedMessages;
    });
  }, [currentUser]);

  const handleOnlineUsersList = useCallback((users) => {
    console.log('LocalChatScreen: Online kullanıcı listesi alındı:', users);
    setOnlineUsers(users);
  }, []);

  const handleUserJoined = useCallback((data) => {
    console.log('LocalChatScreen: Kullanıcı katıldı:', data);
    setOnlineUsers(prev => [...prev, data]);
  }, []);

  const handleUserLeft = useCallback((data) => {
    console.log('LocalChatScreen: Kullanıcı ayrıldı:', data);
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
    console.log('🔌 LocalChatScreen: Socket bağlantısı başlatılıyor...');
    
    // Socket bağlantısını başlat
    socketService.connect();

    // Socket bağlantısını kontrol et ve odaya katıl
    const checkConnection = () => {
      const connected = socketService.isSocketConnected();
      if (connected) {
        console.log('🔌 LocalChatScreen: Socket bağlantısı kuruldu');
        setIsSocketConnected(true);
        // Genel odaya katıl
        socketService.joinRoom('general');
        console.log('🔌 LocalChatScreen: General room\'a katıldı');
        // Kullanıcı durumunu online olarak güncelle
        socketService.updateUserStatus('online');
        console.log('🔌 LocalChatScreen: Kullanıcı durumu online olarak güncellendi');
      } else {
        console.log('🔌 LocalChatScreen: Socket bağlantısı yok, tekrar denenecek...');
        setIsSocketConnected(false);
        // Kısa bir süre sonra tekrar kontrol et
        setTimeout(checkConnection, 1000);
      }
    };

    // İlk kontrol
    checkConnection();

    // Event listener'ları kaydet
    console.log('🔌 LocalChatScreen: Event listener\'lar kaydediliyor...');
    socketService.on('message_received', handleMessageReceived);
    socketService.on('connection_error', handleConnectionError);
    socketService.on('connection_status', handleConnectionStatus);
    socketService.on('online_users_list', handleOnlineUsersList);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);
    console.log('🔌 LocalChatScreen: Event listener\'lar kaydedildi');
    console.log('🔌 LocalChatScreen: message_received listener kaydedildi:', typeof handleMessageReceived);

    // Cleanup function
    return () => {
      console.log('🔌 LocalChatScreen: Event listener\'lar temizleniyor...');
      socketService.off('message_received', handleMessageReceived);
      socketService.off('connection_error', handleConnectionError);
      socketService.off('connection_status', handleConnectionStatus);
      socketService.off('online_users_list', handleOnlineUsersList);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
    };
  }, []); // Dependency array'i boş bırakıyoruz

  // currentUser yüklendikten sonra mesaj geçmişini yükle
  useEffect(() => {
    if (currentUser && isSocketConnected) {
      loadMessageHistory();
    }
  }, [currentUser, isSocketConnected, loadMessageHistory]);

  // Component unmount olduğunda socket bağlantısını kapat
  useEffect(() => {
    return () => {
      socketService.disconnect();
    };
  }, []);

  const sendMessage = async () => {
    if (message.trim()) {
      const messageText = message.trim();
      console.log('📤 LocalChatScreen: Mesaj gönderiliyor:', messageText);
      
      // Socket bağlantısını kontrol et
      if (!isSocketConnected) {
        console.log('📤 LocalChatScreen: Socket bağlantısı yok, mesaj gönderilemiyor');
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
      
      console.log('📤 LocalChatScreen: Optimistic update - mesaj eklendi:', newMessage);
      setMessages(prev => [...prev, newMessage]);
      
      // Backend'e mesajı kaydet
      try {
        const token = await apiService.getStoredToken();
        if (token) {
          apiService.setToken(token);
          console.log('📤 LocalChatScreen: Backend\'e mesaj kaydediliyor...');
          const response = await apiService.post('/chat/send', {
            message: messageText,
            room: 'general'
          });
          
          if (response.success) {
            console.log('📤 LocalChatScreen: Mesaj backend\'e kaydedildi');
          }
        }
      } catch (error) {
        console.error('📤 LocalChatScreen: Backend mesaj kaydetme hatası:', error);
      }
      
      // Socket.io ile mesaj gönder
      console.log('📤 LocalChatScreen: Socket ile mesaj gönderiliyor...');
      console.log('📤 LocalChatScreen: Socket connected:', isSocketConnected);
      console.log('📤 LocalChatScreen: Socket service connected:', socketService.isSocketConnected());
      const sentMessage = socketService.sendMessage(messageText, 'general');
      console.log('📤 LocalChatScreen: Socket gönderim sonucu:', sentMessage);
      
      if (sentMessage) {
        console.log('📤 LocalChatScreen: Mesaj başarıyla gönderildi');
      } else {
        console.log('📤 LocalChatScreen: Mesaj gönderilemedi');
        Alert.alert('Hata', 'Mesaj gönderilemedi. Lütfen tekrar deneyin.');
        // Hata durumunda mesajı geri al
        setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      }
      
      setMessage('');
    }
  };

  const renderMessage = ({ item }) => (
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
              <Text style={styles.avatar}>{item.avatar}</Text>
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
              <Text style={styles.headerTitle}>Local Chat</Text>
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
                İlk mesajı siz gönderin ve sohbete başlayın!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              style={styles.messagesList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }}
            />
          )}
          
          {/* Message Input */}
          <View style={styles.messageInputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.messageInput}
                placeholder="Mesajınızı yazın..."
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
                onPress={sendMessage}
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
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text.light,
    marginBottom: 2,
  },
  headerSpacer: {
    width: 48, // Geri butonu ile aynı genişlikte boşluk
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
  inputWrapper: {
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
});
