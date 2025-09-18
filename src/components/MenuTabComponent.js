import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { scale, verticalScale, getResponsiveFontSize, isIOS, isTablet } from '../utils/responsive';

export default function MenuTabComponent() {
  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    }}>
      <View style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: colors.primary + '20',
        marginBottom: verticalScale(20),
      }}>
        <Ionicons 
          name="grid" 
          size={scale(40)} 
          color={colors.primary}
        />
      </View>
      <Text style={{
        fontSize: getResponsiveFontSize(18),
        fontWeight: isIOS ? '600' : '500',
        fontFamily: isIOS ? 'System' : 'Roboto',
        color: colors.text.primary,
        textAlign: 'center',
      }}>
        Menü
      </Text>
      <Text style={{
        fontSize: getResponsiveFontSize(14),
        color: colors.text.secondary,
        textAlign: 'center',
        marginTop: verticalScale(10),
        paddingHorizontal: scale(20),
      }}>
        Alt navbar'daki menü butonuna tıklayarak menüyü açabilirsiniz
      </Text>
    </View>
  );
}

