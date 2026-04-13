import React from 'react';
import {
  View, Text, TouchableOpacity, Switch, StyleSheet,
  SafeAreaView, ScrollView, Linking, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../utils/theme';
import { auth } from '../firebase/config';
import { cancelAllNotifications } from '../utils/notifications';
import { signOut } from 'firebase/auth';

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const s = makeStyles(colors);

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelAllNotifications();
            await signOut(auth);
            router.replace('/login' as any);
          } catch {
            Alert.alert('Error', 'Could not log out. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* ── Appearance ── */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🌙</Text>
              <View>
                <Text style={s.rowTitle}>Dark Mode</Text>
                <Text style={s.rowSubtitle}>Switch between light and dark theme</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* ── Notifications ── */}
        <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={s.row}
            onPress={() => Linking.openSettings()}
          >
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🔔</Text>
              <View>
                <Text style={s.rowTitle}>Notification Permissions</Text>
                <Text style={s.rowSubtitle}>Manage in device settings</Text>
              </View>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>

          <View style={s.divider} />

          <TouchableOpacity
            style={s.row}
            onPress={() => {
              Alert.alert(
                'Cancel All Reminders',
                'This will cancel all scheduled medication reminders. Are you sure?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Cancel Reminders',
                    style: 'destructive',
                    onPress: async () => {
                      await cancelAllNotifications();
                      Alert.alert('Done', 'All reminders have been cancelled.');
                    },
                  },
                ]
              );
            }}
          >
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>🔕</Text>
              <View>
                <Text style={s.rowTitle}>Cancel All Reminders</Text>
                <Text style={s.rowSubtitle}>Remove all scheduled notifications</Text>
              </View>
            </View>
            <Text style={s.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Account ── */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>👤</Text>
              <View>
                <Text style={s.rowTitle}>{auth.currentUser?.displayName || 'User'}</Text>
                <Text style={s.rowSubtitle}>{auth.currentUser?.email || ''}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── About ── */}
        <Text style={s.sectionLabel}>ABOUT</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>💊</Text>
              <View>
                <Text style={s.rowTitle}>PillTracker</Text>
                <Text style={s.rowSubtitle}>Version 1.0.0</Text>
              </View>
            </View>
          </View>

          <View style={s.divider} />

          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowIcon}>ℹ️</Text>
              <View>
                <Text style={s.rowTitle}>Drug Interaction Warnings</Text>
                <Text style={s.rowSubtitle}>
                  Interactions are advisory only. Always consult your pharmacist or doctor.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Log Out ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 20, gap: 8, paddingBottom: 40 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
    backBtn: { padding: 4 },
    backText: { fontSize: 16, color: colors.textSecondary },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textMuted,
      letterSpacing: 1, marginTop: 12, marginBottom: 4, paddingHorizontal: 4,
    },

    card: {
      backgroundColor: colors.card, borderRadius: 16,
      overflow: 'hidden',
      shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },

    row: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', padding: 16, gap: 12,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowIcon: { fontSize: 22, width: 30, textAlign: 'center' },
    rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    rowSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, flexShrink: 1 },
    chevron: { fontSize: 20, color: colors.textMuted },

    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

    logoutBtn: {
      marginTop: 16,
      backgroundColor: colors.error,
      borderRadius: 14,
      padding: 16,
      alignItems: 'center',
    },
    logoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
