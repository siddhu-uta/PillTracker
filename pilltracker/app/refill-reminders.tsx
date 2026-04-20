import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getMedications, updateMedication, getRefillStatus } from '../firebase/medications';
import { useTheme } from '../utils/theme';

type RefillMed = {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  refillTracking: {
    enabled: boolean;
    totalQuantity: number;
    pillsPerDose: number;
    pillsRemaining: number;
  };
  daysRemaining: number;
  pillsRemaining: number;
  shouldAlert: boolean;
};

function statusConfig(daysRemaining: number): { color: string; bg: string; label: string; emoji: string } {
  if (daysRemaining === 0) return { color: '#dc2626', bg: '#fef2f2', label: 'Out of pills',  emoji: '🚨' };
  if (daysRemaining <= 3)  return { color: '#dc2626', bg: '#fef2f2', label: 'Critical',      emoji: '🔴' };
  if (daysRemaining <= 7)  return { color: '#d97706', bg: '#fffbeb', label: 'Running low',   emoji: '🟡' };
  if (daysRemaining <= 14) return { color: '#2563eb', bg: '#eff6ff', label: 'Getting low',   emoji: '🔵' };
  return                          { color: '#16a34a', bg: '#f0fdf4', label: 'Sufficient',    emoji: '🟢' };
}

function RefillCard({ med, onRefill, colors }: {
  med: RefillMed;
  onRefill: () => void;
  colors: any;
}) {
  const status  = statusConfig(med.daysRemaining);
  const total   = med.refillTracking.totalQuantity;
  const remaining = med.pillsRemaining;
  const pct     = total > 0 ? Math.max(0, Math.min(100, Math.round((remaining / total) * 100))) : 0;
  const dosesPerDay = (med.times?.length || 1);
  const pillsPerDay = med.refillTracking.pillsPerDose * dosesPerDay;

  const barColor = pct > 50 ? '#22c55e' : pct > 20 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderLeftColor: status.color }]}>
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.medName, { color: colors.text }]}>{med.name}</Text>
          <Text style={[s.medDosage, { color: colors.textSecondary }]}>{med.dosage}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[s.statusText, { color: status.color }]}>{status.emoji} {status.label}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[s.barBg, { backgroundColor: colors.border }]}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={s.barLabels}>
        <Text style={[s.barLabelLeft, { color: colors.textMuted }]}>
          {remaining} / {total} pills remaining
        </Text>
        <Text style={[s.barLabelRight, { color: colors.textMuted }]}>{pct}%</Text>
      </View>

      {/* Stats row */}
      <View style={[s.statsRow, { borderColor: colors.border }]}>
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: med.daysRemaining <= 7 ? status.color : colors.text }]}>
            {med.daysRemaining === 0 ? '0' : `~${med.daysRemaining}`}
          </Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Days left</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.text }]}>{med.refillTracking.pillsPerDose}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Pills/dose</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.text }]}>{dosesPerDay}x</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Per day</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statValue, { color: colors.text }]}>{pillsPerDay}</Text>
          <Text style={[s.statLabel, { color: colors.textMuted }]}>Pills/day</Text>
        </View>
      </View>

      {/* Refill button */}
      <TouchableOpacity
        style={[s.refillBtn, { borderColor: status.color }]}
        onPress={onRefill}
        activeOpacity={0.7}
      >
        <Text style={[s.refillBtnText, { color: status.color }]}>🔁 Mark as Refilled</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RefillRemindersScreen() {
  const { colors } = useTheme();
  const [meds, setMeds]       = useState<RefillMed[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        try {
          const all = await getMedications();
          const refillMeds: RefillMed[] = [];
          for (const med of all) {
            const status = getRefillStatus(med);
            if (!status) continue; // refill tracking not enabled
            refillMeds.push({
              ...med,
              daysRemaining:  status.daysRemaining,
              pillsRemaining: status.pillsRemaining,
              shouldAlert:    status.shouldAlert,
            });
          }
          // Sort: critical first
          refillMeds.sort((a, b) => a.daysRemaining - b.daysRemaining);
          setMeds(refillMeds);
        } catch {
          Alert.alert('Error', 'Could not load refill data.');
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [])
  );

  const handleRefill = (med: RefillMed) => {
    Alert.alert(
      '🔁 Mark as Refilled',
      `Reset ${med.name} back to ${med.refillTracking.totalQuantity} pills?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refilled',
          onPress: async () => {
            try {
              await updateMedication(med.id, {
                'refillTracking.pillsRemaining': med.refillTracking.totalQuantity,
              });
              setMeds(prev => prev.map(m =>
                m.id !== med.id ? m : {
                  ...m,
                  pillsRemaining: med.refillTracking.totalQuantity,
                  daysRemaining:  Math.floor(
                    med.refillTracking.totalQuantity /
                    (med.refillTracking.pillsPerDose * (med.times?.length || 1))
                  ),
                  shouldAlert: false,
                }
              ).sort((a, b) => a.daysRemaining - b.daysRemaining));
            } catch {
              Alert.alert('Error', 'Could not update refill count.');
            }
          },
        },
      ]
    );
  };

  const alertMeds = meds.filter(m => m.shouldAlert);
  const okMeds    = meds.filter(m => !m.shouldAlert);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={[s.backText, { color: colors.textSecondary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>💊 Refill Reminders</Text>
          <Text style={[s.subtitle, { color: colors.textMuted }]}>
            Track your pill inventory and know when to reorder
          </Text>
        </View>

        {loading && (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        )}

        {!loading && meds.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>💊</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>No refill tracking set up</Text>
            <Text style={[s.emptyText, { color: colors.textMuted }]}>
              Enable refill tracking when adding or editing a medication to monitor your pill supply here.
            </Text>
            <TouchableOpacity
              style={[s.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/add-medication' as any)}
            >
              <Text style={[s.emptyBtnText, { color: colors.primaryText }]}>+ Add Medication</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && alertMeds.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>⚠️ Needs Attention</Text>
              <View style={s.sectionBadge}>
                <Text style={s.sectionBadgeText}>{alertMeds.length}</Text>
              </View>
            </View>
            {alertMeds.map(med => (
              <RefillCard key={med.id} med={med} onRefill={() => handleRefill(med)} colors={colors} />
            ))}
          </>
        )}

        {!loading && okMeds.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { color: colors.text, marginTop: alertMeds.length > 0 ? 8 : 0 }]}>
              ✅ Sufficient Supply
            </Text>
            {okMeds.map(med => (
              <RefillCard key={med.id} med={med} onRefill={() => handleRefill(med)} colors={colors} />
            ))}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { padding: 20, gap: 16, paddingBottom: 40 },

  header:      { gap: 4, marginBottom: 4 },
  backBtn:     { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText:    { fontSize: 15, fontWeight: '500' },
  title:       { fontSize: 24, fontWeight: '800' },
  subtitle:    { fontSize: 13, marginTop: 2 },

  sectionRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:{ fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionBadge:{ backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  card: {
    borderRadius: 16, padding: 16, gap: 12,
    borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  medName:     { fontSize: 17, fontWeight: '700' },
  medDosage:   { fontSize: 13, marginTop: 2 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 12, fontWeight: '700' },

  barBg:       { height: 10, borderRadius: 5, overflow: 'hidden' },
  barFill:     { height: '100%', borderRadius: 5 },
  barLabels:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  barLabelLeft:{ fontSize: 12, fontWeight: '500' },
  barLabelRight:{ fontSize: 12, fontWeight: '600' },

  statsRow:    { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, gap: 0 },
  statItem:    { flex: 1, alignItems: 'center', gap: 3 },
  statValue:   { fontSize: 18, fontWeight: '800' },
  statLabel:   { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider: { width: 1, marginHorizontal: 4 },

  refillBtn: {
    borderWidth: 1.5, borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  refillBtnText: { fontSize: 14, fontWeight: '700' },

  emptyCard:   { alignItems: 'center', padding: 40, gap: 12, marginTop: 20 },
  emptyEmoji:  { fontSize: 52 },
  emptyTitle:  { fontSize: 18, fontWeight: '700' },
  emptyText:   { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn:    { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText:{ fontSize: 15, fontWeight: '600' },
});
