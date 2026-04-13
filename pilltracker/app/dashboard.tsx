import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Modal,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import {
  getMedications, toggleMedication, getAdherenceForDate,
  deleteMedication, initializeTodayAdherence,
  decrementPillsRemaining, getRefillStatus,
} from '../firebase/medications';
import { cancelMedNotifications } from '../utils/notifications';
import { useTheme } from '../utils/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

// ─── Skeleton Pulse ───────────────────────────────────────────────────────────
function SkeletonPulse({ style }: { style: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity }]} />;
}

function SkeletonCard({ colors }: { colors: any }) {
  const sk = skeletonStyles(colors);
  return (
    <View style={sk.card}>
      <SkeletonPulse style={sk.icon} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonPulse style={sk.lineWide} />
        <SkeletonPulse style={sk.lineNarrow} />
      </View>
      <SkeletonPulse style={sk.circle} />
    </View>
  );
}

// ─── Refill Badge ─────────────────────────────────────────────────────────────
function RefillBadge({ daysRemaining }: { daysRemaining: number }) {
  const color = daysRemaining <= 3 ? '#ef4444' : '#f59e0b';
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>
        {daysRemaining === 0 ? '⚠️ Out of pills — refill now!' : `🔁 ~${daysRemaining}d supply left`}
      </Text>
    </View>
  );
}

// ─── Swipeable Med Card ───────────────────────────────────────────────────────
function SwipeableMedCard({
  med, taken, onToggle, onEdit, onDelete, colors,
}: {
  med: any;
  taken: boolean | undefined;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  colors: any;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const slideIn    = useRef(new Animated.Value(30)).current;
  const fadeIn     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideIn, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => { if (g.dx < 0) translateX.setValue(g.dx); },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 250, useNativeDriver: true })
            .start(() => onDelete());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const s = cardStyles(colors);
  const refillStatus = getRefillStatus(med);
  const allTimes: string[] = Array.isArray(med.times) ? med.times : (med.times ? [med.times] : []);

  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 0 }}>
      <View style={s.deleteHint}>
        <Text style={s.deleteHintText}>🗑️  Delete</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX }], opacity: fadeIn, translateY: slideIn }}
        {...panResponder.panHandlers}
      >
        <View style={[
          s.medCard,
          taken === true  && s.medCardTaken,
          taken === false && s.medCardMissed,
        ]}>
          <View style={s.medIcon}><Text>💊</Text></View>

          <View style={s.medInfo}>
            <Text style={s.medName}>{med.name}</Text>
            <Text style={s.medDetails}>
              {med.dosage}
              {allTimes.length > 0 ? ' · ' + allTimes.join(' · ') : ''}
            </Text>
            {refillStatus?.shouldAlert && (
              <RefillBadge daysRemaining={refillStatus.daysRemaining} />
            )}
          </View>

          <TouchableOpacity style={s.editButton} onPress={onEdit}>
            <Text style={s.editIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.checkButton, taken && s.checkButtonDone]}
            onPress={onToggle}
          >
            {taken && <Text style={s.checkMark}>✓</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [medications, setMedications] = useState<any[]>([]);
  const [takenMeds, setTakenMeds]     = useState<Record<string, boolean>>({});
  const [loading, setLoading]         = useState(true);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const screenFade  = useRef(new Animated.Value(0)).current;
  const screenSlide = useRef(new Animated.Value(24)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const userName = auth.currentUser?.displayName?.split(' ')[0] || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useFocusEffect(
    useCallback(() => {
      screenFade.setValue(0);
      screenSlide.setValue(24);
      Animated.parallel([
        Animated.timing(screenFade,  { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(screenSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();

      const loadData = async () => {
        try {
          const meds = await getMedications();
          setMedications(meds);
          const today = new Date().toISOString().split('T')[0];
          await initializeTodayAdherence(meds.map((m: any) => m.id));
          const adherence = await getAdherenceForDate(today);
          setTakenMeds(adherence);
        } catch {
          Alert.alert('Error', 'Could not load medications.');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  const handleMarkTaken = async (med: any) => {
    try {
      const newValue = !takenMeds[med.id];
      await toggleMedication(med.id, newValue);
      setTakenMeds(prev => ({ ...prev, [med.id]: newValue }));

      if (newValue) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Decrement pill count if refill tracking is on
        const remaining = await decrementPillsRemaining(med.id);
        if (typeof remaining === 'number') {
          const refillStatus = getRefillStatus({ ...med, refillTracking: { ...med.refillTracking, pillsRemaining: remaining } });
          if (refillStatus?.shouldAlert) {
            const msg = refillStatus.daysRemaining === 0
              ? `You are out of ${med.name}. Please refill now!`
              : `You have approximately ${refillStatus.daysRemaining} day(s) of ${med.name} remaining. Time to refill soon.`;
            setTimeout(() => Alert.alert('💊 Refill Reminder', msg), 500);
          }
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      Alert.alert('Error', 'Could not update medication status.');
    }
  };

  const handleDelete = (medId: string, medName: string, notificationIds: string[] = []) => {
    Alert.alert(
      'Delete Medication',
      `Are you sure you want to delete ${medName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              if (notificationIds.length > 0) await cancelMedNotifications(notificationIds);
              await deleteMedication(medId);
              setMedications(prev => prev.filter(m => m.id !== medId));
              setTakenMeds(prev => { const u = { ...prev }; delete u[medId]; return u; });
            } catch {
              Alert.alert('Error', 'Could not delete medication.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setProfileMenuVisible(false);
      router.replace('/login' as any);
    } catch {
      Alert.alert('Error', 'Could not log out.');
    }
  };

  const takenCount   = medications.filter(m => takenMeds[m.id] === true).length;
  const missedCount  = medications.filter(m => takenMeds[m.id] === false).length;
  const totalCount   = medications.length;
  const progressPercent = totalCount > 0 ? (takenCount / totalCount) * 100 : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercent, duration: 600, useNativeDriver: false,
    }).start();
  }, [progressPercent]);

  return (
    <SafeAreaView style={s.container}>
      <Animated.View style={{ flex: 1, opacity: screenFade, transform: [{ translateY: screenSlide }] }}>
        <ScrollView contentContainerStyle={s.scroll}>

          <View style={s.header}>
            <View>
              <Text style={s.greeting}>{getGreeting()},</Text>
              <Text style={s.userName}>{userName}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/settings' as any)}>
              <Text style={s.settingsText}>⚙️</Text>
            </TouchableOpacity>
          </View>

          <View style={s.progressCard}>
            <Text style={s.progressLabel}>Today's Progress</Text>
            <View style={s.progressBarBg}>
              <Animated.View style={[
                s.progressBarFill,
                { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
              ]} />
            </View>
            <View style={s.progressStats}>
              <Text style={s.progressStatTaken}>✓ {takenCount} taken</Text>
              <Text style={s.progressCount}>{takenCount}/{totalCount}</Text>
              {missedCount > 0 && (
                <Text style={s.progressStatMissed}>✗ {missedCount} missed</Text>
              )}
            </View>
          </View>

          <Text style={s.sectionTitle}>TODAY'S MEDICATIONS</Text>

          {loading ? (
            <>
              <SkeletonCard colors={colors} />
              <SkeletonCard colors={colors} />
              <SkeletonCard colors={colors} />
            </>
          ) : medications.length === 0 ? (
            <TouchableOpacity
              style={s.emptyCard}
              onPress={() => router.push('/add-medication' as any)}
            >
              <Text style={s.emptyText}>+ Add your first medication</Text>
            </TouchableOpacity>
          ) : (
            medications.map(med => (
              <SwipeableMedCard
                key={med.id}
                med={med}
                taken={takenMeds[med.id]}
                onToggle={() => handleMarkTaken(med)}
                onEdit={() => router.push({
                  pathname: '/edit-medication' as any,
                  params: {
                    id: med.id, name: med.name, dosage: med.dosage,
                    form: med.form, frequency: med.frequency, notes: med.notes ?? '',
                    photoUri: med.photoUri ?? '',
                  },
                })}
                onDelete={() => handleDelete(med.id, med.name, med.notificationIds ?? [])}
                colors={colors}
              />
            ))
          )}
        </ScrollView>
      </Animated.View>

      {/* Profile modal */}
      <Modal
        visible={profileMenuVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProfileMenuVisible(false)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setProfileMenuVisible(false)}
        >
          <View style={s.profileMenu}>
            <Text style={s.profileName}>{auth.currentUser?.displayName || 'User'}</Text>
            <Text style={s.profileEmail}>{auth.currentUser?.email || ''}</Text>

            {[
              { label: 'Settings',         route: '/settings'       },
              { label: 'Adherence Report', route: '/adherence'      },
              { label: 'Add Medication',   route: '/add-medication' },
              { label: 'Set Reminders',    route: '/set-reminders'  },
            ].map(({ label, route }) => (
              <TouchableOpacity
                key={route}
                style={s.menuItem}
                onPress={() => { setProfileMenuVisible(false); router.push(route as any); }}
              >
                <Text style={s.menuText}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={s.logoutItem} onPress={handleLogout}>
              <Text style={s.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Bottom nav */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem}>
          <Text style={s.navIcon}>🏠</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/add-medication' as any)}>
          <Text style={s.navIcon}>💊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => router.push('/adherence' as any)}>
          <Text style={s.navIcon}>📈</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => setProfileMenuVisible(true)}>
          <Text style={s.navIcon}>👤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:           { flex: 1, backgroundColor: c.background },
  scroll:              { padding: 20, gap: 16, paddingBottom: 100 },
  header:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting:            { fontSize: 16, color: c.textSecondary },
  userName:            { fontSize: 28, fontWeight: 'bold', color: c.text },
  settingsText:        { fontSize: 22, padding: 8 },

  progressCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 20, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  progressLabel:       { fontSize: 14, fontWeight: '600', color: c.text },
  progressBarBg:       { height: 10, backgroundColor: c.border, borderRadius: 5, overflow: 'hidden' },
  progressBarFill:     { height: '100%', backgroundColor: c.primary, borderRadius: 5 },
  progressStats:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressCount:       { fontSize: 14, color: c.textSecondary, textAlign: 'right' },
  progressStatTaken:   { fontSize: 13, fontWeight: '600', color: c.success },
  progressStatMissed:  { fontSize: 13, fontWeight: '600', color: c.error },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: c.textMuted, letterSpacing: 1 },

  emptyCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 30,
    alignItems: 'center', borderWidth: 1, borderColor: c.border, borderStyle: 'dashed',
  },
  emptyText: { color: c.textMuted, fontSize: 16 },

  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: c.navBg, flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border,
  },
  navItem: { padding: 8 },
  navIcon: { fontSize: 22 },

  modalOverlay: {
    flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end',
  },
  profileMenu: {
    backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12,
  },
  profileName:  { fontSize: 22, fontWeight: '700', color: c.text },
  profileEmail: { fontSize: 14, color: c.textSecondary, marginBottom: 10 },
  menuItem:     { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
  menuText:     { fontSize: 16, color: c.text },
  logoutItem:   { marginTop: 10, paddingVertical: 14, alignItems: 'center', backgroundColor: c.primary, borderRadius: 12 },
  logoutText:   { color: c.primaryText, fontSize: 16, fontWeight: '600' },
});

const cardStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  medCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  medCardTaken:    { borderLeftWidth: 4, borderLeftColor: '#22c55e' },
  medCardMissed:   { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  medIcon:         { width: 44, height: 44, backgroundColor: c.border, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  medInfo:         { flex: 1 },
  medName:         { fontSize: 16, fontWeight: '600', color: c.text },
  medDetails:      { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  checkButton:     { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  checkButtonDone: { backgroundColor: c.primary, borderColor: c.primary },
  checkMark:       { color: c.primaryText, fontWeight: 'bold' },
  editButton:      { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editIcon:        { fontSize: 16 },
  deleteHint: {
    position: 'absolute', top: 0, bottom: 0, right: 0, left: 0,
    backgroundColor: '#ef4444', borderRadius: 16,
    justifyContent: 'center', alignItems: 'flex-end', paddingRight: 24,
  },
  deleteHintText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const skeletonStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  card: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  icon:       { width: 44, height: 44, borderRadius: 12, backgroundColor: c.skeleton },
  lineWide:   { height: 14, borderRadius: 6, backgroundColor: c.skeleton, width: '70%' },
  lineNarrow: { height: 11, borderRadius: 6, backgroundColor: c.skeleton, width: '45%' },
  circle:     { width: 32, height: 32, borderRadius: 16, backgroundColor: c.skeleton },
});
