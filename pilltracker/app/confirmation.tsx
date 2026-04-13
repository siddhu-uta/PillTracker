import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../utils/theme';

export default function ConfirmationScreen() {
  const { name, dosage, times } = useLocalSearchParams();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const timesDisplay = times ? String(times) : null;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.iconCircle}>
        <Text style={s.checkmark}>✓</Text>
      </View>

      <Text style={s.title}>All Set!</Text>

      <Text style={s.description}>
        <Text style={{ fontWeight: '600' }}>{name} {dosage}</Text> has been added
        to your medication list
        {timesDisplay ? ` with daily reminders at ${timesDisplay}.` : '.'}
      </Text>

      <TouchableOpacity style={s.primaryButton} onPress={() => router.push('/dashboard' as any)}>
        <Text style={s.primaryButtonText}>Go to Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.secondaryButton} onPress={() => router.push('/add-medication' as any)}>
        <Text style={s.secondaryButtonText}>+ Add Another Medication</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1, backgroundColor: c.background,
    alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20,
  },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: c.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  checkmark:   { fontSize: 48, color: c.primary },
  title:       { fontSize: 32, fontWeight: 'bold', color: c.text },
  description: { fontSize: 16, color: c.textSecondary, textAlign: 'center', lineHeight: 24 },
  primaryButton: {
    backgroundColor: c.primary, paddingVertical: 16,
    borderRadius: 12, width: '100%', alignItems: 'center',
  },
  primaryButtonText:  { color: c.primaryText, fontSize: 17, fontWeight: '600' },
  secondaryButton: {
    borderWidth: 1, borderColor: c.border, paddingVertical: 16,
    borderRadius: 12, width: '100%', alignItems: 'center',
  },
  secondaryButtonText: { color: c.text, fontSize: 17 },
});
