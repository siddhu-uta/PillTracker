import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Switch, StyleSheet,
  SafeAreaView, ScrollView, Alert, Modal, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { addMedication } from '../firebase/medications';
import {
  requestNotificationPermissions, scheduleMedNotification,
  SOUND_OPTIONS, type SoundOption,
} from '../utils/notifications';
import { useTheme } from '../utils/theme';

// ─── Time Picker Modal ────────────────────────────────────────────────────────
const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

interface TimePickerModalProps {
  visible: boolean;
  currentTime: string;
  label: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
  colors: any;
}

function TimePickerModal({ visible, currentTime, label, onConfirm, onClose, colors }: TimePickerModalProps) {
  const parse = (t: string) => {
    const [timePart, period] = t.split(' ');
    const [h, m] = timePart.split(':');
    return { hour: String(Number(h)).padStart(2, '0'), minute: String(Number(m)).padStart(2, '0'), period: period ?? 'AM' };
  };
  const parsed = parse(currentTime);
  const [hour, setHour]     = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  const handleConfirm = () => { onConfirm(`${Number(hour)}:${minute} ${period}`); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: '80%', gap: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{label}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[{ label: 'Hour', vals: HOURS, sel: hour, set: setHour },
              { label: 'Min', vals: MINUTES, sel: minute, set: setMinute },
              { label: 'AM/PM', vals: PERIODS, sel: period, set: setPeriod }].map(col => (
              <View key={col.label} style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6 }}>{col.label}</Text>
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {col.vals.map(v => (
                    <TouchableOpacity
                      key={v}
                      style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, marginVertical: 2, alignItems: 'center', backgroundColor: col.sel === v ? colors.primary : 'transparent' }}
                      onPress={() => col.set(v)}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '600', color: col.sel === v ? colors.primaryText : colors.text }}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }} onPress={onClose}>
              <Text style={{ fontSize: 15, color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }} onPress={handleConfirm}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primaryText }}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SetRemindersScreen() {
  const { name, dosage, form, frequency, notes, photoUri } = useLocalSearchParams();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const defaultTimes = () => {
    const freq = String(frequency).toLowerCase();
    if (freq === 'twice daily') return ['8:00 AM', '8:00 PM'];
    return ['8:00 AM'];
  };

  const [times, setTimes]                   = useState<string[]>(defaultTimes());
  const [pickerIndex, setPickerIndex]       = useState<number | null>(null);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundAlert, setSoundAlert]         = useState(true);
  const [selectedSound, setSelectedSound]   = useState<SoundOption>('default');
  const [snooze, setSnooze]                 = useState(true);
  const [loading, setLoading]               = useState(false);

  // ── Refill tracking ──────────────────────────────────────────────────────
  const [refillEnabled, setRefillEnabled]       = useState(false);
  const [totalQuantity, setTotalQuantity]       = useState('');
  const [pillsPerDose, setPillsPerDose]         = useState('1');

  const updateTime      = (index: number, newTime: string) => setTimes(prev => prev.map((t, i) => i === index ? newTime : t));
  const addTimeSlot     = () => { if (times.length < 4) setTimes(prev => [...prev, '12:00 PM']); };
  const removeTimeSlot  = (index: number) => { if (times.length > 1) setTimes(prev => prev.filter((_, i) => i !== index)); };

  const handleSave = async () => {
    // Validate refill fields if enabled
    if (refillEnabled) {
      const qty = parseInt(totalQuantity, 10);
      const ppd = parseInt(pillsPerDose, 10);
      if (isNaN(qty) || qty <= 0) {
        Alert.alert('Invalid quantity', 'Please enter a valid total quantity of pills.');
        return;
      }
      if (isNaN(ppd) || ppd <= 0) {
        Alert.alert('Invalid pills per dose', 'Please enter a valid number of pills per dose.');
        return;
      }
    }

    setLoading(true);
    try {
      let notificationIds: string[] = [];

      if (pushNotifications) {
        const granted = await requestNotificationPermissions();
        if (granted) {
          notificationIds = await scheduleMedNotification(
            String(name), String(dosage), times, soundAlert, selectedSound, snooze
          );
        } else {
          Alert.alert('Permission Denied', 'Enable notifications in your device settings to receive medication reminders.');
        }
      }

      const refillTracking = refillEnabled
        ? {
            enabled:        true,
            totalQuantity:  parseInt(totalQuantity, 10),
            pillsPerDose:   parseInt(pillsPerDose, 10),
            pillsRemaining: parseInt(totalQuantity, 10),
          }
        : { enabled: false };

      await addMedication({
        name, dosage, form, frequency, notes,
        photoUri: photoUri ?? '',
        times,
        reminders: { pushNotifications, soundAlert, selectedSound, snooze },
        refillTracking,
        notificationIds,
        createdAt: new Date().toISOString(),
      });

      router.push({ pathname: '/confirmation' as any, params: { name, dosage, times: times.join(', ') } });
    } catch {
      Alert.alert('Error', 'Could not save medication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>🔔 Set Reminders</Text>

        <View style={s.medCard}>
          <Text style={s.medName}>{name} — {dosage}</Text>
          <Text style={s.medFreq}>{frequency}</Text>
        </View>

        {/* ── Time Slots ── */}
        <Text style={s.sectionTitle}>Reminder Times</Text>
        <Text style={s.hint}>Tap a time to change it · Add up to 4 doses per day</Text>

        {times.map((t, i) => (
          <View key={i} style={s.timeRow}>
            <Text style={s.doseLabel}>Dose {i + 1}</Text>
            <TouchableOpacity style={s.timeBox} onPress={() => setPickerIndex(i)}>
              <Text style={s.timeText}>🕐 {t}</Text>
            </TouchableOpacity>
            {times.length > 1 && (
              <TouchableOpacity onPress={() => removeTimeSlot(i)} style={s.removeBtn}>
                <Text style={s.removeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {times.length < 4 && (
          <TouchableOpacity style={s.addTimeBtn} onPress={addTimeSlot}>
            <Text style={s.addTimeBtnText}>+ Add another time</Text>
          </TouchableOpacity>
        )}

        {/* ── Notification Preferences ── */}
        <Text style={[s.sectionTitle, { marginTop: 8 }]}>Notification Preferences</Text>

        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Push Notifications</Text>
          <Switch value={pushNotifications} onValueChange={setPushNotifications} trackColor={{ true: colors.primary }} thumbColor={colors.surface} />
        </View>

        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Sound Alert</Text>
          <Switch value={soundAlert} onValueChange={setSoundAlert} trackColor={{ true: colors.primary }} thumbColor={colors.surface} />
        </View>

        {soundAlert && (
          <View style={s.soundPickerContainer}>
            <Text style={s.soundPickerLabel}>Notification Sound</Text>
            <View style={s.soundPickerRow}>
              {SOUND_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.soundOption, selectedSound === opt.id && s.soundOptionActive]}
                  onPress={() => setSelectedSound(opt.id)}
                >
                  <Text style={s.soundOptionEmoji}>{opt.emoji}</Text>
                  <Text style={[s.soundOptionText, selectedSound === opt.id && s.soundOptionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Snooze (5 min)</Text>
          <Switch value={snooze} onValueChange={setSnooze} trackColor={{ true: colors.primary }} thumbColor={colors.surface} />
        </View>

        {/* ── Refill Tracking ── */}
        <Text style={[s.sectionTitle, { marginTop: 8 }]}>Refill Tracking</Text>

        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>Track Pill Inventory</Text>
            <Text style={s.toggleSub}>Get alerted when running low (≤7 days)</Text>
          </View>
          <Switch value={refillEnabled} onValueChange={setRefillEnabled} trackColor={{ true: colors.primary }} thumbColor={colors.surface} />
        </View>

        {refillEnabled && (
          <View style={s.refillCard}>
            <View style={s.refillRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.refillLabel}>Total Pills in Bottle</Text>
                <TextInput
                  style={s.refillInput}
                  placeholder="e.g. 30"
                  placeholderTextColor={colors.textMuted}
                  value={totalQuantity}
                  onChangeText={setTotalQuantity}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.refillLabel}>Pills per Dose</Text>
                <TextInput
                  style={s.refillInput}
                  placeholder="e.g. 1"
                  placeholderTextColor={colors.textMuted}
                  value={pillsPerDose}
                  onChangeText={setPillsPerDose}
                  keyboardType="numeric"
                />
              </View>
            </View>
            {totalQuantity && pillsPerDose && !isNaN(parseInt(totalQuantity)) && !isNaN(parseInt(pillsPerDose)) && (
              <Text style={s.refillEstimate}>
                📅 Estimated supply: {Math.floor(parseInt(totalQuantity) / (parseInt(pillsPerDose) * times.length))} days
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity style={s.primaryButton} onPress={handleSave} disabled={loading}>
          <Text style={s.primaryButtonText}>{loading ? 'Saving...' : 'Save Reminders'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {pickerIndex !== null && (
        <TimePickerModal
          visible={pickerIndex !== null}
          currentTime={times[pickerIndex]}
          label={`Set time for Dose ${pickerIndex + 1}`}
          onConfirm={(newTime) => updateTime(pickerIndex, newTime)}
          onClose={() => setPickerIndex(null)}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:  { flex: 1, backgroundColor: c.background },
  scroll:     { padding: 24, gap: 16 },
  title:      { fontSize: 26, fontWeight: 'bold', color: c.text },
  medCard:    { backgroundColor: c.card, borderRadius: 12, padding: 16, gap: 4 },
  medName:    { fontSize: 16, fontWeight: '600', color: c.text },
  medFreq:    { fontSize: 13, color: c.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: c.text },
  hint:       { fontSize: 12, color: c.textMuted, marginTop: -8 },
  doseLabel:  { fontSize: 14, fontWeight: '600', color: c.textSecondary, width: 60 },
  timeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBox: {
    flex: 1, borderWidth: 1.5, borderColor: c.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.inputBg,
  },
  timeText:     { fontSize: 16, fontWeight: '600', color: c.text },
  removeBtn:    { padding: 8 },
  removeBtnText:{ fontSize: 18, color: c.error },
  addTimeBtn:   { borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  addTimeBtnText: { fontSize: 14, color: c.textSecondary },
  toggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  toggleLabel:{ fontSize: 15, color: c.text, flex: 1 },
  toggleSub:  { fontSize: 12, color: c.textMuted, marginTop: 2 },

  soundPickerContainer: { backgroundColor: c.card, borderRadius: 12, padding: 14, gap: 10 },
  soundPickerLabel:     { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  soundPickerRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: c.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.chip,
  },
  soundOptionActive:     { borderColor: c.primary, backgroundColor: c.primary },
  soundOptionEmoji:      { fontSize: 14 },
  soundOptionText:       { fontSize: 13, fontWeight: '600', color: c.chipText },
  soundOptionTextActive: { color: c.primaryText },

  // Refill section
  refillCard:     { backgroundColor: c.card, borderRadius: 14, padding: 16, gap: 12 },
  refillRow:      { flexDirection: 'row', gap: 12 },
  refillLabel:    { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6 },
  refillInput: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 12, fontSize: 16, backgroundColor: c.inputBg, color: c.text,
  },
  refillEstimate: { fontSize: 13, color: c.textSecondary, fontStyle: 'italic' },

  primaryButton:     { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: c.primaryText, fontSize: 17, fontWeight: '600' },
});
