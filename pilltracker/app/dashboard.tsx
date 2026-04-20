import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, Modal, Image, TextInput,
  KeyboardAvoidingView, Platform,
  Animated, PanResponder, Dimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { auth } from '../firebase/config';
import { signOut } from 'firebase/auth';
import {
  getMedications, toggleMedication, getAdherenceForDate,
  deleteMedication, updateMedication, initializeTodayAdherence,
  decrementPillsRemaining, getRefillStatus,
} from '../firebase/medications';
import { cancelMedNotifications, scheduleRefillNotification } from '../utils/notifications';
import { useTheme } from '../utils/theme';

const SCREEN_WIDTH    = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;
const DELETE_WIDTH    = 80;

// ─── Per-dose countdown helpers ──────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [part, period] = t.split(' ');
  let [h, m] = part.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

/** Minutes until a specific dose time — negative means it has already passed today */
function useDoseMinutes(timeStr: string): number {
  const compute = () => {
    const now = new Date();
    return timeToMinutes(timeStr) - (now.getHours() * 60 + now.getMinutes());
  };
  const [mins, setMins] = React.useState(compute);
  useEffect(() => {
    setMins(compute());
    const id = setInterval(() => setMins(compute()), 60_000);
    return () => clearInterval(id);
  }, [timeStr]);
  return mins;
}

function fmtMins(abs: number): string {
  const h = Math.floor(abs / 60), m = abs % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Next-dose badge (collapsed card header) ─────────────────────────────────
function NextDoseLabel({ allTimes, takenDoses, colors }: {
  allTimes: string[]; takenDoses: boolean[]; colors: any;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (allTimes.length === 0) return null;

  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
  let label = '', color = '';

  // Find the soonest future untaken dose
  for (let i = 0; i < allTimes.length; i++) {
    if (takenDoses[i]) continue;
    const mins = timeToMinutes(allTimes[i]) - nowMins;
    if (mins > 0) {
      label = `Next in ${fmtMins(mins)}`;
      color = mins <= 60 ? '#f59e0b' : '#22c55e';
      break;
    }
  }

  if (!label) {
    const hasUntaken = allTimes.some((_, i) => !takenDoses[i]);
    if (!hasUntaken) {
      // All doses taken — show countdown to the soonest dose tomorrow
      const soonest = Math.min(...allTimes.map(t => timeToMinutes(t) + 1440 - nowMins));
      label = `Next dose in ${fmtMins(soonest)}`; color = '#22c55e';
    } else {
      let latestPast = -1;
      allTimes.forEach((t, i) => { if (!takenDoses[i]) latestPast = Math.max(latestPast, timeToMinutes(t)); });
      const over = nowMins - latestPast;
      label = over > 0 ? `${fmtMins(over)} overdue` : 'Due now';
      color = '#ef4444';
    }
  }

  return <Text style={{ fontSize: 11, fontWeight: '700', color, marginTop: 2 }}>{label}</Text>;
}

// ─── Dose Row (inside expanded card) ─────────────────────────────────────────
function DoseRow({ time, taken, onToggle, colors }: {
  time: string; taken: boolean; onToggle: (v: boolean) => void; colors: any;
}) {
  const mins = useDoseMinutes(time);

  // mins + 1440 = minutes until the same dose tomorrow
  const { label, labelColor } = taken
    ? { label: `✓ Next in ${fmtMins(mins + 1440)}`, labelColor: '#22c55e' }
    : mins > 60
      ? { label: `in ${fmtMins(mins)}`, labelColor: '#22c55e' }
      : mins > 0
        ? { label: `in ${fmtMins(mins)}`, labelColor: '#f59e0b' }
        : mins === 0
          ? { label: 'Due now', labelColor: '#ef4444' }
          : { label: `${fmtMins(Math.abs(mins))} overdue`, labelColor: '#ef4444' };

  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16 }}
      onPress={() => onToggle(!taken)}
      activeOpacity={0.6}
    >
      <View style={{
        width: 26, height: 26, borderRadius: 13, borderWidth: 2,
        borderColor: taken ? '#22c55e' : colors.border,
        backgroundColor: taken ? '#22c55e' : 'transparent',
        justifyContent: 'center', alignItems: 'center',
      }}>
        {taken && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>⏰ {time}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: labelColor }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Dose Counter badge (replaces single checkbox) ───────────────────────────
function DoseCounter({ takenCount, total, colors }: { takenCount: number; total: number; colors: any }) {
  const all = takenCount === total;
  const some = takenCount > 0 && !all;
  const color = all ? '#22c55e' : some ? '#f59e0b' : colors.border;
  return (
    <View style={{
      width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: color,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: all ? '#22c55e22' : 'transparent',
    }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color }}>{takenCount}/{total}</Text>
    </View>
  );
}

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
  med, takenDoses, onToggleDose, onEdit, onDelete, colors,
}: {
  med: any;
  takenDoses: boolean[];
  onToggleDose: (index: number, value: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  colors: any;
}) {
  const translateX  = useRef(new Animated.Value(0)).current;
  const slideIn     = useRef(new Animated.Value(30)).current;
  const fadeIn      = useRef(new Animated.Value(0)).current;
  // Track committed position so multi-gesture swipes start from the right offset
  const committedX  = useRef(0);
  // Always-fresh refs so PanResponder never holds stale closures
  const onDeleteRef = useRef(onDelete);
  useEffect(() => { onDeleteRef.current = onDelete; });
  const medNameRef  = useRef(med.name);
  useEffect(() => { medNameRef.current = med.name; });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideIn, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const snapClose = () => {
    Animated.spring(translateX, {
      toValue: 0, useNativeDriver: true, speed: 30, bounciness: 0,
    }).start(() => { committedX.current = 0; });
  };

  const snapOpen = () => {
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH, useNativeDriver: true, speed: 30, bounciness: 0,
    }).start(() => { committedX.current = -DELETE_WIDTH; });
  };

  // Show Alert FIRST — only animate off-screen after user confirms delete.
  // This fixes the bug where Cancel left the card stuck off-screen.
  const requestDeleteRef = useRef(() => {});
  requestDeleteRef.current = () => {
    snapOpen(); // ensure delete button is visible while alert is shown
    Alert.alert(
      'Delete Medication',
      `Remove ${medNameRef.current} from your medications?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => snapClose() },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => {
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH, duration: 200, useNativeDriver: true,
            }).start(() => onDeleteRef.current());
          },
        },
      ]
    );
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Claim gesture only for clear horizontal swipes
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dy) < 10,
      // Don't let ScrollView steal the gesture once we've claimed it
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        // Set offset so g.dx is relative to current committed position
        translateX.stopAnimation();
        translateX.setOffset(committedX.current);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, g) => {
        // Clamp: no further right than 0, no further left than off-screen
        const desired = committedX.current + g.dx;
        const clamped = Math.max(-SCREEN_WIDTH, Math.min(0, desired));
        translateX.setValue(clamped - committedX.current);
      },
      onPanResponderRelease: (_, g) => {
        translateX.flattenOffset();
        const finalX = Math.max(-SCREEN_WIDTH, Math.min(0, committedX.current + g.dx));
        committedX.current = finalX; // update before spring so callbacks are accurate
        if (finalX < -SWIPE_THRESHOLD) {
          requestDeleteRef.current();
        } else if (finalX < -(DELETE_WIDTH / 2)) {
          snapOpen();
        } else {
          snapClose();
        }
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        snapClose();
      },
    })
  ).current;

  const [expanded, setExpanded] = useState(false);
  const s = cardStyles(colors);
  const refillStatus = getRefillStatus(med);
  const allTimes: string[] = Array.isArray(med.times) ? med.times : (med.times ? [med.times] : []);
  const takenCount = takenDoses.filter(Boolean).length;
  const total = allTimes.length || 1;

  // Card border: all done=green, partial=amber, none=missed red
  const borderStyle = takenCount === total  ? s.medCardTaken
                    : takenCount > 0        ? s.medCardPartial
                    : s.medCardMissed;

  return (
    <View style={{ overflow: 'hidden', borderRadius: 16, marginBottom: 0 }}>
      {/* Delete button */}
      <TouchableOpacity style={s.deleteHint} onPress={() => requestDeleteRef.current()} activeOpacity={0.8}>
        <Text style={s.deleteHintIcon}>🗑️</Text>
        <Text style={s.deleteHintText}>Delete</Text>
      </TouchableOpacity>

      <Animated.View
        style={{ transform: [{ translateX }, { translateY: slideIn }], opacity: fadeIn }}
        {...panResponder.panHandlers}
      >
        {/* ── Card header ── */}
        <View style={[s.medCard, borderStyle]}>
          <View style={s.medIcon}>
            {med.photoUri
              ? <Image source={{ uri: med.photoUri }} style={s.medPhoto} />
              : <Text>💊</Text>}
          </View>

          <View style={s.medInfo}>
            <Text style={s.medName}>{med.name}</Text>
            <Text style={s.medDetails}>{med.dosage}</Text>
            <NextDoseLabel allTimes={allTimes} takenDoses={takenDoses} colors={colors} />
            {refillStatus?.shouldAlert && (
              <RefillBadge daysRemaining={refillStatus.daysRemaining} />
            )}
          </View>

          <TouchableOpacity style={s.editButton} onPress={onEdit}>
            <Text style={s.editIcon}>✏️</Text>
          </TouchableOpacity>

          <DoseCounter takenCount={takenCount} total={total} colors={colors} />

          {/* Expand / collapse chevron */}
          <TouchableOpacity style={s.chevronBtn} onPress={() => setExpanded(e => !e)}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>{expanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Expanded dose list ── */}
        {expanded && (
          <View style={[s.doseList, { borderColor: colors.border }]}>
            {allTimes.map((time, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />}
                <DoseRow
                  time={time}
                  taken={takenDoses[i] ?? false}
                  onToggle={v => onToggleDose(i, v)}
                  colors={colors}
                />
              </React.Fragment>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [medications, setMedications] = useState<any[]>([]);
  const [takenMeds, setTakenMeds]     = useState<Record<string, boolean[]>>({});
  const [loading, setLoading]         = useState(true);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  // Refill modal state
  const [refillModalVisible, setRefillModalVisible] = useState(false);
  const [refillNewQty, setRefillNewQty] = useState<Record<string, string>>({});
  const refillShownThisSession = useRef(false);

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
          await initializeTodayAdherence(meds);
          const raw = await getAdherenceForDate(today);
          // Normalise: old boolean entries become single-element arrays
          const normalised: Record<string, boolean[]> = {};
          for (const med of meds) {
            const v = (raw as any)[med.id];
            const count = Array.isArray(med.times) ? med.times.length : 1;
            normalised[med.id] = Array.isArray(v) ? v
              : typeof v === 'boolean'             ? [v]
              : new Array(count).fill(false);
          }
          setTakenMeds(normalised);

          // Show refill modal once per session if any med is running low
          if (!refillShownThisSession.current) {
            const lowMeds = meds.filter(m => getRefillStatus(m)?.shouldAlert);
            if (lowMeds.length > 0) {
              refillShownThisSession.current = true;
              const initQty: Record<string, string> = {};
              lowMeds.forEach(m => { initQty[m.id] = ''; });
              setRefillNewQty(initQty);
              setRefillModalVisible(true);
            }
          }
        } catch {
          Alert.alert('Error', 'Could not load medications.');
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }, [])
  );

  const handleMarkDose = async (med: any, doseIndex: number, newValue: boolean) => {
    try {
      const allTimes: string[] = Array.isArray(med.times) ? med.times : (med.times ? [med.times] : []);
      const totalDoses = allTimes.length || 1;
      await toggleMedication(med.id, doseIndex, newValue, totalDoses);
      setTakenMeds(prev => {
        const arr = [...(prev[med.id] ?? new Array(totalDoses).fill(false))];
        arr[doseIndex] = newValue;
        return { ...prev, [med.id]: arr };
      });

      if (newValue) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const remaining = await decrementPillsRemaining(med.id);
        if (typeof remaining === 'number') {
          const updatedMed = { ...med, refillTracking: { ...med.refillTracking, pillsRemaining: remaining } };
          const refillStatus = getRefillStatus(updatedMed);
          if (refillStatus?.shouldAlert) {
            // Fire a push notification (visible even when app is backgrounded)
            scheduleRefillNotification(med.name, refillStatus.daysRemaining, remaining).catch(() => {});
            // Also update the meds list so the modal reflects latest state
            setMedications(prev => prev.map(m => m.id === med.id ? updatedMed : m));
          }
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      Alert.alert('Error', 'Could not update medication status.');
    }
  };

  // Confirmation is handled by the card's swipe Alert — this just performs the deletion.
  const handleDelete = async (medId: string, notificationIds: string[] = []) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (notificationIds.length > 0) await cancelMedNotifications(notificationIds);
      await deleteMedication(medId);
      setMedications(prev => prev.filter(m => m.id !== medId));
      setTakenMeds(prev => { const u = { ...prev }; delete u[medId]; return u; });
    } catch {
      Alert.alert('Error', 'Could not delete medication.');
    }
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

  const lowStockMeds = useMemo(() =>
    medications.map(m => ({ m, status: getRefillStatus(m) }))
               .filter(({ status }) => status?.shouldAlert)
               .map(({ m, status }) => ({ ...m, refillStatus: status! })),
  [medications]);

  // Count individual doses, not just medications
  const takenCount = medications.reduce((sum, m) => sum + (takenMeds[m.id] ?? []).filter(Boolean).length, 0);
  const totalCount = medications.reduce((sum, m) => {
    const t = Array.isArray(m.times) ? m.times : (m.times ? [m.times] : []);
    return sum + (t.length || 1);
  }, 0);
  const missedCount = totalCount - takenCount;
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
                takenDoses={takenMeds[med.id] ?? []}
                onToggleDose={(i, v) => handleMarkDose(med, i, v)}
                onEdit={() => router.push({
                  pathname: '/edit-medication' as any,
                  params: {
                    id: med.id, name: med.name, dosage: med.dosage,
                    form: med.form, frequency: med.frequency, notes: med.notes ?? '',
                    photoUri: med.photoUri ?? '',
                    times: JSON.stringify(med.times ?? []),
                    notificationIds: JSON.stringify(med.notificationIds ?? []),
                    refillTracking: JSON.stringify(med.refillTracking ?? { enabled: false }),
                  },
                })}
                onDelete={() => handleDelete(med.id, med.notificationIds ?? [])}
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

      {/* ── Refill Reminder Modal ── */}
      <Modal
        visible={refillModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRefillModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
        <View style={s.modalOverlay}>
          <View style={[s.refillModal, { backgroundColor: colors.surface }]}>
            <Text style={[s.refillModalTitle, { color: colors.text }]}>💊 Refill Reminder</Text>
            <Text style={[s.refillModalSub, { color: colors.textSecondary }]}>
              The following medications are running low. Enter the new pill count after refilling.
            </Text>

            <ScrollView
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {lowStockMeds.map(med => (
                <View key={med.id} style={[s.refillMedRow, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.refillMedName, { color: colors.text }]}>{med.name}</Text>
                    <Text style={[s.refillMedInfo, { color: med.refillStatus.daysRemaining === 0 ? '#ef4444' : '#f59e0b' }]}>
                      {med.refillStatus.daysRemaining === 0
                        ? '🚨 Out of pills'
                        : `🟡 ~${med.refillStatus.daysRemaining} days left · ${med.refillStatus.pillsRemaining} pills`}
                    </Text>
                  </View>
                  <TextInput
                    style={[s.refillQtyInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                    placeholder="New qty"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={refillNewQty[med.id] ?? ''}
                    onChangeText={t => setRefillNewQty(prev => ({ ...prev, [med.id]: t }))}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={s.refillModalBtns}>
              <TouchableOpacity
                style={[s.refillModalBtn, { borderColor: colors.border }]}
                onPress={() => setRefillModalVisible(false)}
              >
                <Text style={[s.refillModalBtnText, { color: colors.textSecondary }]}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.refillModalBtn, s.refillModalBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  const updates = lowStockMeds.filter(m => {
                    const qty = parseInt(refillNewQty[m.id] ?? '', 10);
                    return !isNaN(qty) && qty > 0;
                  });
                  if (updates.length === 0) { setRefillModalVisible(false); return; }
                  try {
                    await Promise.all(updates.map(m => {
                      const qty = parseInt(refillNewQty[m.id], 10);
                      return updateMedication(m.id, { 'refillTracking.pillsRemaining': qty });
                    }));
                    setMedications(prev => prev.map(m => {
                      const match = updates.find(u => u.id === m.id);
                      if (!match) return m;
                      const qty = parseInt(refillNewQty[m.id], 10);
                      return { ...m, refillTracking: { ...m.refillTracking, pillsRemaining: qty } };
                    }));
                    setRefillModalVisible(false);
                  } catch {
                    Alert.alert('Error', 'Could not update pill counts.');
                  }
                }}
              >
                <Text style={[s.refillModalBtnText, { color: colors.primaryText }]}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
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

  refillModal: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  refillModalTitle:   { fontSize: 20, fontWeight: '800' },
  refillModalSub:     { fontSize: 13, lineHeight: 18 },
  refillMedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  refillMedName:      { fontSize: 15, fontWeight: '700' },
  refillMedInfo:      { fontSize: 12, fontWeight: '600', marginTop: 2 },
  refillQtyInput: {
    width: 80, borderWidth: 1, borderRadius: 8,
    padding: 8, fontSize: 15, textAlign: 'center',
  },
  refillModalBtns:    { flexDirection: 'row', gap: 12, marginTop: 4 },
  refillModalBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    alignItems: 'center', borderWidth: 1,
  },
  refillModalBtnPrimary: { borderWidth: 0 },
  refillModalBtnText:    { fontSize: 15, fontWeight: '700' },
});

const cardStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  medCard: {
    backgroundColor: c.card, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  medCardTaken:    { borderLeftWidth: 4, borderLeftColor: '#22c55e' },
  medCardPartial:  { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  medCardMissed:   { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  doseList: {
    backgroundColor: '#fafafa', borderTopWidth: 1,
    borderLeftWidth: 4, borderLeftColor: '#e5e7eb',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  chevronBtn: { padding: 6, marginLeft: 2 },
  medIcon:         { width: 44, height: 44, backgroundColor: c.border, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  medPhoto:        { width: 44, height: 44, borderRadius: 12 },
  medInfo:         { flex: 1 },
  medName:         { fontSize: 16, fontWeight: '600', color: c.text },
  medDetails:      { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  checkButton:     { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  checkButtonDone: { backgroundColor: c.primary, borderColor: c.primary },
  checkMark:       { color: c.primaryText, fontWeight: 'bold' },
  editButton:      { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editIcon:        { fontSize: 16 },
  deleteHint: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: DELETE_WIDTH,
    backgroundColor: '#ef4444', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  deleteHintIcon: { fontSize: 18 },
  deleteHintText: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
