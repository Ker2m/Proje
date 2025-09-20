import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api';
import { colors } from '../constants/colors';
import { 
  scale, 
  verticalScale, 
  scaleFont, 
  getResponsivePadding, 
  isIOS,
  isAndroid,
  isTablet,
  getBottomSafeArea
} from '../utils/responsive';

const bottomSafeArea = getBottomSafeArea();

export default function SecurityScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [securityData, setSecurityData] = useState({
    twoFactorEnabled: false,
    emailVerified: false,
    lastPasswordChange: null
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, []);

  // Güvenlik verilerini yükle
  const loadSecurityData = async () => {
    try {
      setIsLoading(true);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        navigation.goBack();
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      // Profil bilgilerini al (email doğrulama durumu ve şifre değişikliği tarihi için)
      try {
        const profileResponse = await apiService.getProfile();
        if (profileResponse.success) {
          const user = profileResponse.data.user;
          setSecurityData(prev => ({
            ...prev,
            emailVerified: user.email_verified || false,
            lastPasswordChange: user.last_password_change || null
          }));
        }
      } catch (profileError) {
        console.log('Profile load error (non-critical):', profileError.message);
        // Profil yükleme hatası kritik değil, varsayılan değerleri kullan
      }
      
    } catch (error) {
      console.error('Security data load error:', error);
      // Hata durumunda varsayılan değerleri kullan
      setSecurityData(prev => ({
        ...prev,
        emailVerified: false,
        twoFactorEnabled: false
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Şifre değiştir
  const changePassword = async () => {
    try {
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
        return;
      }

      if (passwordData.newPassword.length < 6) {
        Alert.alert('Hata', 'Yeni şifre en az 6 karakter olmalıdır');
        return;
      }

      // Şifre güçlülük kontrolü - Daha esnek ama özel karakter zorunlu
      const strongPasswordRegex = /^(?=.*[@$!%*?&.]).{6,}$/;
      if (!strongPasswordRegex.test(passwordData.newPassword)) {
        Alert.alert(
          'Zayıf Şifre', 
          'Şifre en az 6 karakter olmalı ve en az 1 özel karakter içermelidir (@$!%*?&.)'
        );
        return;
      }

      setIsSaving(true);
      
      // Token'ı kontrol et
      const token = await apiService.getStoredToken();
      if (!token) {
        Alert.alert('Hata', 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.');
        return;
      }
      
      // Token'ı API servisine set et
      apiService.setToken(token);
      
      // Backend'e şifre değiştirme isteği gönder
      const response = await apiService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      
      if (response.success) {
        Alert.alert('Başarılı', 'Şifreniz başarıyla değiştirildi');
        
        // Modal'ı kapat ve formu temizle
        setShowPasswordModal(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        // Güvenlik verilerini yenile (şifre değişikliği tarihi için)
        await loadSecurityData();
      } else {
        Alert.alert('Hata', response.message || 'Şifre değiştirilemedi');
      }
      
    } catch (error) {
      console.error('Password change error:', error);
      Alert.alert('Hata', error.message || 'Şifre değiştirilirken bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  // 2FA'yı etkinleştir/devre dışı bırak
  const toggle2FA = async () => {
    try {
      if (!securityData.emailVerified) {
        Alert.alert(
          'E-posta Doğrulama Gerekli',
          '2FA özelliğini kullanabilmek için önce e-posta adresinizi doğrulamanız gerekiyor.',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'E-posta Doğrula', onPress: () => {
              navigation.navigate('Profile');
            }}
          ]
        );
        return;
      }

      if (!securityData.twoFactorEnabled) {
        // 2FA'yı etkinleştir
        setShow2FAModal(true);
      } else {
        // 2FA'yı devre dışı bırak
        Alert.alert(
          '2FA Devre Dışı Bırak',
          'İki faktörlü kimlik doğrulamayı devre dışı bırakmak istediğinizden emin misiniz?',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Devre Dışı Bırak', 
              style: 'destructive',
              onPress: () => {
                setSecurityData(prev => ({
                  ...prev,
                  twoFactorEnabled: false
                }));
                Alert.alert('Başarılı', '2FA devre dışı bırakıldı');
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('2FA toggle error:', error);
      Alert.alert('Hata', '2FA ayarı değiştirilirken bir hata oluştu');
    }
  };

  // 2FA doğrulama kodu gönder
  const send2FACode = async () => {
    try {
      setIsVerifying(true);
      
      // Önce profil bilgilerini al
      const profileResponse = await apiService.getProfile();
      if (!profileResponse.success) {
        Alert.alert('Hata', 'Profil bilgileri alınamadı');
        return;
      }
      
      const userEmail = profileResponse.data.user.email;
      if (!userEmail) {
        Alert.alert('Hata', 'E-posta adresi bulunamadı');
        return;
      }
      
      // Email doğrulama kodu gönder
      const response = await apiService.sendVerificationCode(
        userEmail,
        'email_verification' // 2FA için de email verification kullanıyoruz
      );
      
      if (response.success) {
        Alert.alert('Başarılı', 'Doğrulama kodu e-posta adresinize gönderildi');
      } else {
        Alert.alert('Hata', response.message || 'Doğrulama kodu gönderilemedi');
      }
    } catch (error) {
      console.error('2FA code send error:', error);
      Alert.alert('Hata', 'Doğrulama kodu gönderilirken bir hata oluştu: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // 2FA doğrulama kodunu doğrula
  const verify2FACode = async () => {
    try {
      if (!verificationCode.trim()) {
        Alert.alert('Hata', 'Lütfen doğrulama kodunu girin');
        return;
      }

      setIsVerifying(true);
      
      // Önce profil bilgilerini al
      const profileResponse = await apiService.getProfile();
      if (!profileResponse.success) {
        Alert.alert('Hata', 'Profil bilgileri alınamadı');
        return;
      }
      
      const userEmail = profileResponse.data.user.email;
      if (!userEmail) {
        Alert.alert('Hata', 'E-posta adresi bulunamadı');
        return;
      }
      
      // Email doğrulama kodunu doğrula
      const response = await apiService.verifyCode(
        userEmail,
        verificationCode,
        'email_verification'
      );
      
      if (response.success) {
        setShow2FAModal(false);
        setVerificationCode('');
        setSecurityData(prev => ({
          ...prev,
          twoFactorEnabled: true
        }));
        Alert.alert('Başarılı', '2FA başarıyla etkinleştirildi');
      } else {
        Alert.alert('Hata', response.message || 'Doğrulama kodu hatalı');
      }
      
    } catch (error) {
      console.error('2FA verification error:', error);
      Alert.alert('Hata', 'Doğrulama sırasında bir hata oluştu: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const renderSecurityItem = (icon, title, description, value, onPress, color = colors.primary) => (
    <TouchableOpacity
      style={styles.securityItem}
      onPress={onPress}
    >
      <View style={styles.securityLeft}>
        <View style={[styles.securityIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.securityInfo}>
          <Text style={styles.securityTitle}>{title}</Text>
          <Text style={styles.securityDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.securityRight}>
        {typeof value === 'boolean' ? (
          <Switch
            value={value}
            onValueChange={onPress}
            trackColor={{ false: colors.border.light, true: color }}
            thumbColor={value ? colors.text.primary : colors.text.primary}
          />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Güvenlik verileri yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <LinearGradient
            colors={colors.gradients.primary}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              <Text style={styles.headerTitle}>Güvenlik</Text>
              
              <View style={styles.placeholder} />
            </View>
          </LinearGradient>

          {/* Güvenlik Ayarları */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Güvenlik Ayarları</Text>
            
            {renderSecurityItem(
              'key',
              'Şifre Değiştir',
              'Hesap şifrenizi güncelleyin',
              null,
              () => setShowPasswordModal(true),
              colors.primary
            )}

            {renderSecurityItem(
              'shield-checkmark',
              'İki Faktörlü Kimlik Doğrulama',
              securityData.twoFactorEnabled ? 'Etkin' : 'Devre dışı',
              securityData.twoFactorEnabled,
              toggle2FA,
              securityData.twoFactorEnabled ? colors.success : colors.warning
            )}

            {renderSecurityItem(
              'mail',
              'E-posta Doğrulama',
              securityData.emailVerified ? 'Doğrulandı' : 'Doğrulanmadı',
              securityData.emailVerified,
              () => navigation.navigate('Profile'),
              securityData.emailVerified ? colors.success : colors.warning
            )}
          </View>

          {/* Hesap Bilgileri */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hesap Bilgileri</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Son Şifre Değişikliği</Text>
                <Text style={styles.infoValue}>
                  {securityData.lastPasswordChange 
                    ? new Date(securityData.lastPasswordChange).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Hiç değiştirilmemiş'
                  }
                </Text>
              </View>
            </View>
          </View>

          {/* Alt boşluk */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* Şifre Değiştirme Modal */}
      <Modal
        visible={showPasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Şifre Değiştir</Text>
            
            <TextInput
              style={styles.modalInput}
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({...passwordData, currentPassword: text})}
              placeholder="Mevcut şifre"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry={true}
            />
            
            <TextInput
              style={styles.modalInput}
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({...passwordData, newPassword: text})}
              placeholder="Yeni şifre"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry={true}
            />
            
            {/* Şifre güçlülük göstergesi */}
            {passwordData.newPassword.length > 0 && (
              <View style={styles.passwordStrengthContainer}>
                <Text style={styles.passwordStrengthLabel}>Şifre Güçlülüğü:</Text>
                <View style={styles.passwordStrengthBar}>
                  <View style={[
                    styles.passwordStrengthFill,
                    {
                      width: `${(() => {
                        const password = passwordData.newPassword;
                        let strength = 0;
                        
                        // Uzunluk kontrolü
                        if (password.length >= 6) strength += 30;
                        if (password.length >= 8) strength += 20;
                        if (password.length >= 10) strength += 10;
                        
                        // Özel karakter (zorunlu)
                        if (/[@$!%*?&.]/.test(password)) strength += 30;
                        
                        // Ekstra güçlülük (opsiyonel)
                        if (/[a-z]/.test(password)) strength += 10;
                        if (/[A-Z]/.test(password)) strength += 10;
                        if (/[0-9]/.test(password)) strength += 10;
                        
                        return Math.min(strength, 100);
                      })()}%`,
                      backgroundColor: (() => {
                        const password = passwordData.newPassword;
                        const strongPasswordRegex = /^(?=.*[@$!%*?&.]).{6,}$/;
                        
                        if (password.length < 6) return colors.warning;
                        if (!/[@$!%*?&.]/.test(password)) return colors.warning;
                        if (strongPasswordRegex.test(password)) return colors.success;
                        return colors.accent;
                      })()
                    }
                  ]} />
                </View>
                <Text style={styles.passwordStrengthText}>
                  {(() => {
                    const password = passwordData.newPassword;
                    const strongPasswordRegex = /^(?=.*[@$!%*?&.]).{6,}$/;
                    
                    if (password.length < 6) return 'Çok kısa';
                    if (!/[@$!%*?&.]/.test(password)) return 'Özel karakter gerekli';
                    if (strongPasswordRegex.test(password)) {
                      // Ekstra güçlülük kontrolü
                      let bonus = 0;
                      if (/[a-z]/.test(password)) bonus++;
                      if (/[A-Z]/.test(password)) bonus++;
                      if (/[0-9]/.test(password)) bonus++;
                      
                      if (bonus >= 2) return 'Çok güçlü';
                      if (bonus >= 1) return 'Güçlü';
                      return 'Yeterli';
                    }
                    return 'Zayıf';
                  })()}
                </Text>
              </View>
            )}
            
            <TextInput
              style={styles.modalInput}
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({...passwordData, confirmPassword: text})}
              placeholder="Yeni şifre tekrar"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry={true}
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={changePassword}
                disabled={isSaving}
              >
                <Text style={styles.confirmButtonText}>
                  {isSaving ? 'Değiştiriliyor...' : 'Değiştir'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2FA Doğrulama Modal */}
      <Modal
        visible={show2FAModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShow2FAModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>2FA Doğrulama</Text>
            <Text style={styles.modalSubtitle}>
              E-posta adresinize gönderilen doğrulama kodunu girin
            </Text>
            
            <TouchableOpacity
              style={styles.sendCodeButton}
              onPress={send2FACode}
              disabled={isVerifying}
            >
              <Text style={styles.sendCodeText}>
                {isVerifying ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
              </Text>
            </TouchableOpacity>
            
            <TextInput
              style={styles.modalInput}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Doğrulama kodu"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="number-pad"
              maxLength={6}
            />
            
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShow2FAModal(false);
                  setVerificationCode('');
                }}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={verify2FACode}
                disabled={isVerifying || !verificationCode.trim()}
              >
                <Text style={styles.confirmButtonText}>
                  {isVerifying ? 'Doğrulanıyor...' : 'Doğrula'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    paddingTop: isAndroid ? StatusBar.currentHeight : 0,
  },
  scrollContent: {
    paddingBottom: bottomSafeArea + scale(20),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    marginTop: verticalScale(10),
  },
  header: {
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(20),
    paddingTop: isAndroid ? verticalScale(15) : verticalScale(25),
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: scale(8),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTitle: {
    fontSize: scaleFont(isTablet ? 24 : 20),
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: scale(40),
  },
  section: {
    paddingHorizontal: getResponsivePadding(20),
    marginTop: verticalScale(30),
  },
  sectionTitle: {
    fontSize: scaleFont(isTablet ? 20 : 18),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(15),
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: getResponsivePadding(20),
    paddingVertical: verticalScale(15),
    borderRadius: scale(15),
    marginBottom: verticalScale(10),
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  securityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityIcon: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: scale(15),
  },
  securityInfo: {
    flex: 1,
  },
  securityTitle: {
    fontSize: scaleFont(16),
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: verticalScale(2),
  },
  securityDescription: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
  },
  securityRight: {
    marginLeft: scale(10),
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: scale(15),
    padding: getResponsivePadding(20),
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light + '30',
  },
  infoLabel: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: scaleFont(14),
    fontWeight: '500',
    color: colors.text.primary,
  },
  bottomSpacer: {
    height: verticalScale(20),
  },
  // Modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: scale(20),
    padding: getResponsivePadding(25),
    width: '90%',
    maxWidth: scale(400),
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: verticalScale(10),
  },
  modalSubtitle: {
    fontSize: scaleFont(14),
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: verticalScale(20),
    lineHeight: scaleFont(20),
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: scale(12),
    paddingHorizontal: getResponsivePadding(16),
    paddingVertical: verticalScale(14),
    fontSize: scaleFont(15),
    backgroundColor: colors.background,
    color: colors.text.primary,
    marginBottom: verticalScale(15),
  },
  sendCodeButton: {
    backgroundColor: colors.primary + '20',
    paddingVertical: verticalScale(12),
    paddingHorizontal: getResponsivePadding(20),
    borderRadius: scale(12),
    marginBottom: verticalScale(15),
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  sendCodeText: {
    color: colors.primary,
    fontSize: scaleFont(14),
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: verticalScale(12),
    borderRadius: scale(12),
    marginHorizontal: scale(4),
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  confirmButton: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButtonText: {
    color: colors.text.secondary,
    fontSize: scaleFont(15),
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(15),
    fontWeight: '700',
    textAlign: 'center',
  },
  // Şifre güçlülük göstergesi stilleri
  passwordStrengthContainer: {
    marginBottom: verticalScale(15),
  },
  passwordStrengthLabel: {
    fontSize: scaleFont(12),
    color: colors.text.secondary,
    marginBottom: verticalScale(4),
  },
  passwordStrengthBar: {
    height: scale(4),
    backgroundColor: colors.border.light,
    borderRadius: scale(2),
    overflow: 'hidden',
    marginBottom: verticalScale(4),
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: scale(2),
  },
  passwordStrengthText: {
    fontSize: scaleFont(11),
    color: colors.text.tertiary,
    textAlign: 'right',
  },
});