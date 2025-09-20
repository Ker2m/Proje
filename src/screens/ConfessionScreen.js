import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Dimensions,
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
import apiService from '../services/api';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ConfessionScreen() {
  const [confession, setConfession] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confessions, setConfessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfessions();
  }, []);

  const loadConfessions = async () => {
    try {
      setIsLoading(true);
      // TODO: Implement API call to fetch confessions
      // const response = await apiService.getConfessions();
      // setConfessions(response.confessions || []);
      
      // Mock data for now
      setConfessions([
        {
          id: 1,
          content: "Bugün çok güzel bir gün geçirdim, kimse bilmiyor ama içimde büyük bir mutluluk var.",
          timestamp: "2 saat önce",
          likes: 12
        },
        {
          id: 2,
          content: "Bazen kendimi çok yalnız hissediyorum ama bunu kimseye söyleyemiyorum.",
          timestamp: "5 saat önce",
          likes: 8
        }
      ]);
    } catch (error) {
      console.error('İtiraflar yüklenirken hata:', error);
      Alert.alert('Hata', 'İtiraflar yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitConfession = async () => {
    if (!confession.trim()) {
      Alert.alert('Uyarı', 'Lütfen bir itiraf yazın.');
      return;
    }

    if (confession.trim().length < 10) {
      Alert.alert('Uyarı', 'İtiraf en az 10 karakter olmalıdır.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // TODO: Implement API call to submit confession
      // const response = await apiService.submitConfession({ content: confession.trim() });
      
      // Mock success for now
      Alert.alert('Başarılı', 'İtirafınız gönderildi. Anonim olarak paylaşılacaktır.', [
        {
          text: 'Tamam',
          onPress: () => {
            setConfession('');
            loadConfessions(); // Refresh the list
          }
        }
      ]);
      
    } catch (error) {
      console.error('İtiraf gönderilirken hata:', error);
      Alert.alert('Hata', 'İtiraf gönderilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConfessionItem = ({ item }) => (
    <View style={styles.confessionItem}>
      <View style={styles.confessionContent}>
        <Text style={styles.confessionText}>{item.content}</Text>
        <View style={styles.confessionFooter}>
          <Text style={styles.confessionTimestamp}>{item.timestamp}</Text>
          <TouchableOpacity style={styles.likeButton}>
            <Ionicons name="heart-outline" size={scale(16)} color={colors.text.secondary} />
            <Text style={styles.likeCount}>{item.likes}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header */}
      <LinearGradient
        colors={['rgba(255, 107, 107, 0.9)', 'rgba(255, 142, 142, 0.9)']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>İtiraf</Text>
        <Text style={styles.headerSubtitle}>Anonim olarak paylaş</Text>
      </LinearGradient>

      <KeyboardAvoidingView 
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Submit Confession Section */}
        <View style={styles.submitSection}>
          <Text style={styles.sectionTitle}>İtirafını Paylaş</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.confessionInput}
              placeholder="İtirafını buraya yaz..."
              placeholderTextColor={colors.text.tertiary}
              value={confession}
              onChangeText={setConfession}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <View style={styles.inputFooter}>
              <Text style={styles.characterCount}>
                {confession.length}/500
              </Text>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!confession.trim() || confession.trim().length < 10) && styles.submitButtonDisabled
                ]}
                onPress={submitConfession}
                disabled={isSubmitting || !confession.trim() || confession.trim().length < 10}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Gönder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Confessions List */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Diğer İtiraflar</Text>
            <TouchableOpacity onPress={loadConfessions}>
              <Ionicons name="refresh" size={scale(20)} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>İtiraflar yükleniyor...</Text>
            </View>
          ) : confessions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={scale(60)} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>Henüz itiraf yok</Text>
              <Text style={styles.emptySubtext}>İlk itirafı sen yap!</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.confessionsList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.confessionsListContent}
            >
              {confessions.map(renderConfessionItem)}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: getBottomSafeArea() + verticalScale(20),
    paddingBottom: verticalScale(20),
    paddingHorizontal: getResponsivePadding(20),
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scaleFont(28),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: verticalScale(5),
  },
  headerSubtitle: {
    fontSize: scaleFont(16),
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
  },
  submitSection: {
    padding: getResponsivePadding(20),
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionTitle: {
    fontSize: scaleFont(20),
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: verticalScale(15),
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderRadius: scale(15),
    padding: getResponsivePadding(15),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confessionInput: {
    fontSize: scaleFont(16),
    color: colors.text.primary,
    minHeight: verticalScale(100),
    maxHeight: verticalScale(150),
    textAlignVertical: 'top',
    fontFamily: isIOS ? 'System' : 'Roboto',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(15),
  },
  characterCount: {
    fontSize: scaleFont(14),
    color: colors.text.tertiary,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(10),
    borderRadius: scale(20),
  },
  submitButtonDisabled: {
    backgroundColor: colors.text.tertiary,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: scaleFont(16),
    fontWeight: 'bold',
  },
  listSection: {
    flex: 1,
    padding: getResponsivePadding(20),
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(15),
  },
  confessionsList: {
    flex: 1,
  },
  confessionsListContent: {
    paddingBottom: verticalScale(20),
  },
  confessionItem: {
    backgroundColor: colors.surface,
    borderRadius: scale(15),
    marginBottom: verticalScale(15),
    shadowColor: colors.shadow.dark,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  confessionContent: {
    padding: getResponsivePadding(15),
  },
  confessionText: {
    fontSize: scaleFont(16),
    color: colors.text.primary,
    lineHeight: scaleFont(22),
    marginBottom: verticalScale(10),
  },
  confessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confessionTimestamp: {
    fontSize: scaleFont(12),
    color: colors.text.tertiary,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    fontSize: scaleFont(12),
    color: colors.text.secondary,
    marginLeft: scale(5),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: scaleFont(16),
    color: colors.text.secondary,
    marginTop: verticalScale(10),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(50),
  },
  emptyText: {
    fontSize: scaleFont(18),
    color: colors.text.secondary,
    marginTop: verticalScale(15),
    marginBottom: verticalScale(5),
  },
  emptySubtext: {
    fontSize: scaleFont(14),
    color: colors.text.tertiary,
  },
});
