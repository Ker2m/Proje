import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/api';
import { colors } from '../constants/colors';

export default function RegisterScreen({ navigation, onAuthentication }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Form, 2: 2FA Verification
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegister = async () => {
    const { name, email, password, confirmPassword } = formData;

    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır');
      return;
    }

    // Şifre güçlülük kontrolü - Özel karakter zorunlu
    const strongPasswordRegex = /^(?=.*[@$!%*?&.]).{6,}$/;
    if (!strongPasswordRegex.test(password)) {
      Alert.alert(
        'Zayıf Şifre', 
        'Şifre en az 6 karakter olmalı ve en az 1 özel karakter içermelidir (@$!%*?&.)'
      );
      return;
    }

    // Email formatını kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Hata', 'Geçerli bir email adresi giriniz');
      return;
    }

    setIsLoading(true);

    try {
      // Ad ve soyadı ayır
      const nameParts = name.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ') || '';

      // 2FA doğrulama kodu gönder
      const response = await apiService.sendRegistration2FA(email, first_name, last_name);
      
      if (response.success) {
        // 2FA doğrulama adımına geç
        setStep(2);
        Alert.alert('Doğrulama Kodu Gönderildi', 'Email adresinize 2FA doğrulama kodu gönderildi. Lütfen kodu girin.');
      } else {
        Alert.alert('Hata', response.message || '2FA doğrulama kodu gönderilemedi');
      }
    } catch (error) {
      console.error('Register error:', error);
      Alert.alert('Hata', error.message || 'Kayıt yapılırken bir hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FAVerification = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Hata', 'Geçerli bir 6 haneli kod girin');
      return;
    }

    setIsVerifying(true);

    try {
      // 2FA doğrulama kodunu doğrula
      const response = await apiService.verifyRegistration2FA(formData.email, verificationCode);
      
      if (response.success) {
        // Doğrulama başarılı, kayıt işlemini tamamla
        await completeRegistration();
      } else {
        Alert.alert('Hata', response.message || 'Doğrulama kodu hatalı');
      }
    } catch (error) {
      console.error('2FA verification error:', error);
      Alert.alert('Hata', error.message || 'Doğrulama kodu doğrulanırken bir hata oluştu');
    } finally {
      setIsVerifying(false);
    }
  };

  const completeRegistration = async () => {
    try {
      // Ad ve soyadı ayır
      const nameParts = formData.name.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ') || '';

      const userData = {
        first_name,
        last_name,
        email: formData.email,
        password: formData.password,
        birth_date: '1990-01-01', // Varsayılan doğum tarihi
        gender: 'other', // Varsayılan değer
      };

      const response = await apiService.register(userData);
      
      if (response.success) {
        // Token'ı kaydet
        apiService.setToken(response.data.token);
        
        Alert.alert('Başarılı', 'Hesabınız başarıyla oluşturuldu ve 2FA ile doğrulandı!', [
          { text: 'Tamam', onPress: () => {
            // Authentication state'ini güncelle
            if (onAuthentication) {
              onAuthentication(true);
            }
          }}
        ]);
      }
    } catch (error) {
      console.error('Complete registration error:', error);
      Alert.alert('Hata', error.message || 'Kayıt tamamlanırken bir hata oluştu');
    }
  };

  const resendVerificationCode = async () => {
    try {
      const nameParts = formData.name.trim().split(' ');
      const first_name = nameParts[0];
      const last_name = nameParts.slice(1).join(' ') || '';

      const response = await apiService.sendRegistration2FA(formData.email, first_name, last_name);
      
      if (response.success) {
        Alert.alert('Başarılı', 'Yeni doğrulama kodu gönderildi');
      } else {
        Alert.alert('Hata', response.message || 'Yeni kod gönderilemedi');
      }
    } catch (error) {
      console.error('Resend code error:', error);
      Alert.alert('Hata', error.message || 'Yeni kod gönderilemedi');
    }
  };

  return (
    <LinearGradient
      colors={colors.gradients.redBlack}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <View style={styles.logoContainer}>
                  <Ionicons name="person-add" size={50} color={colors.text.primary} />
                </View>
                <Text style={styles.title}>Kayıt Ol</Text>
                <Text style={styles.subtitle}>Caddate ailesine katıl</Text>
              </View>

              {/* Form - Step 1 */}
              {step === 1 && (
                <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Adınız ve soyadınız"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.name}
                    onChangeText={(value) => handleInputChange('name', value)}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="E-posta adresiniz"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>


                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Şifreniz"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>

                {/* Şifre güçlülük göstergesi */}
                {formData.password.length > 0 && (
                  <View style={styles.passwordStrengthContainer}>
                    <Text style={styles.passwordStrengthLabel}>Şifre Güçlülüğü:</Text>
                    <View style={styles.passwordStrengthBar}>
                      <View style={[
                        styles.passwordStrengthFill,
                        {
                          width: `${(() => {
                            const password = formData.password;
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
                            const password = formData.password;
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
                        const password = formData.password;
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

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Şifrenizi tekrar girin"
                    placeholderTextColor={colors.text.tertiary}
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.text.tertiary}
                    />
                  </TouchableOpacity>
                </View>


                <TouchableOpacity
                  style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  <Text style={styles.registerButtonText}>
                    {isLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                  </Text>
                </TouchableOpacity>
              </View>
              )}

              {/* 2FA Verification - Step 2 */}
              {step === 2 && (
                <View style={styles.formContainer}>
                  <View style={styles.verificationHeader}>
                    <Ionicons name="shield-checkmark" size={60} color={colors.primary} />
                    <Text style={styles.verificationTitle}>2FA Doğrulama</Text>
                    <Text style={styles.verificationSubtitle}>
                      Email adresinize gönderilen 6 haneli kodu girin
                    </Text>
                    <Text style={styles.emailText}>{formData.email}</Text>
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="key" size={20} color={colors.text.tertiary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Doğrulama kodu"
                      placeholderTextColor={colors.text.tertiary}
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="numeric"
                      maxLength={6}
                      textAlign="center"
                      style={[styles.input, styles.verificationInput]}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={handle2FAVerification}
                    disabled={isVerifying}
                  >
                    <Text style={styles.verifyButtonText}>
                      {isVerifying ? 'Doğrulanıyor...' : 'Doğrula'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={resendVerificationCode}
                    disabled={isVerifying}
                  >
                    <Text style={styles.resendButtonText}>Kodu Tekrar Gönder</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.backToFormButton}
                    onPress={() => setStep(1)}
                    disabled={isVerifying}
                  >
                    <Text style={styles.backToFormButtonText}>← Forma Dön</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Zaten hesabınız var mı? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>Giriş Yap</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.overlayLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 20,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
    paddingVertical: 15,
  },
  eyeIcon: {
    padding: 5,
  },
  registerButton: {
    backgroundColor: colors.text.primary,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: colors.shadow.light,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    elevation: 5,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  loginLink: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 2FA Verification Styles
  verificationHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  verificationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginTop: 15,
    marginBottom: 10,
  },
  verificationSubtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 10,
  },
  emailText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  verificationInput: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 5,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  resendButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  backToFormButton: {
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
  },
  backToFormButtonText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  // Şifre güçlülük göstergesi stilleri
  passwordStrengthContainer: {
    marginBottom: 15,
    marginTop: 5,
  },
  passwordStrengthLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 11,
    color: colors.text.tertiary,
    textAlign: 'right',
  },
});
