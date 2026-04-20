import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Image, Switch,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { updateMedication, uploadMedPhoto } from '../firebase/medications';
import { useTheme } from '../utils/theme';

const FREQUENCIES = ['Daily', 'Weekly', 'As needed'];
const FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection'];
const DOSAGE_REGEX = /^\d+(\.\d+)?\s*(mg|ml|mcg|g|iu|units?|drops?|puffs?|%)/i;

type Errors = { name?: string; dosage?: string };

export default function EditMedicationScreen() {
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [name, setName]         = useState(String(params.name    || ''));
  const [dosage, setDosage]     = useState(String(params.dosage  || ''));
  const [form, setForm]         = useState(String(params.form    || 'Tablet'));
  const [frequency, setFrequency] = useState(String(params.frequency || 'Daily'));
  const [notes, setNotes]       = useState(String(params.notes   || ''));
  const [photoUri, setPhotoUri] = useState<string | null>(
    params.photoUri && String(params.photoUri) !== '' ? String(params.photoUri) : null
  );
  const [times, setTimes] = useState<string[]>(() => {
    try { return JSON.parse(String(params.times || '[]')); } catch { return []; }
  });

  // ── Refill tracking ───────────────────────────────────────────────────────
  const parsedRefill = (() => {
    try { return JSON.parse(String(params.refillTracking || '{}')); } catch { return {}; }
  })();
  const [refillEnabled, setRefillEnabled]   = useState<boolean>(parsedRefill.enabled ?? false);
  const [totalQuantity, setTotalQuantity]   = useState(String(parsedRefill.totalQuantity ?? ''));
  const [pillsPerDose, setPillsPerDose]     = useState(String(parsedRefill.pillsPerDose  ?? '1'));
  const [pillsRemaining, setPillsRemaining] = useState(String(parsedRefill.pillsRemaining ?? ''));

  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Errors>({});

  // ── Camera / Gallery ──────────────────────────────────────────────────────
  const handlePickPhoto = () => {
    Alert.alert('Change Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera access is required to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Photo library access is required.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validate = (): boolean => {
    const newErrors: Errors = {};
    if (!name.trim()) {
      newErrors.name = 'Medication name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }
    if (!dosage.trim()) {
      newErrors.dosage = 'Dosage is required.';
    } else if (!DOSAGE_REGEX.test(dosage.trim())) {
      newErrors.dosage = 'Enter a valid dosage (e.g. 500mg, 10ml, 5mcg).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let finalPhotoUri = photoUri ?? '';
      // Upload to Firebase Storage if user picked a new local photo
      if (finalPhotoUri.startsWith('file://')) {
        try {
          finalPhotoUri = await uploadMedPhoto(finalPhotoUri, String(params.id));
        } catch {
          // Non-fatal — keep the local URI as fallback
        }
      }
      if (refillEnabled) {
        const qty = parseInt(totalQuantity, 10);
        const ppd = parseInt(pillsPerDose, 10);
        const rem = parseInt(pillsRemaining, 10);
        if (isNaN(qty) || qty <= 0) {
          Alert.alert('Invalid quantity', 'Enter a valid total pill quantity.');
          setLoading(false); return;
        }
        if (isNaN(ppd) || ppd <= 0) {
          Alert.alert('Invalid pills per dose', 'Enter a valid number of pills per dose.');
          setLoading(false); return;
        }
        if (isNaN(rem) || rem < 0) {
          Alert.alert('Invalid count', 'Current pill count cannot be negative.');
          setLoading(false); return;
        }
      }

      const refillTracking = refillEnabled
        ? {
            enabled:        true,
            totalQuantity:  parseInt(totalQuantity, 10),
            pillsPerDose:   parseInt(pillsPerDose, 10),
            pillsRemaining: parseInt(pillsRemaining, 10),
          }
        : { enabled: false };

      await updateMedication(String(params.id), {
        name: name.trim(),
        dosage: dosage.trim(),
        form,
        frequency,
        notes: notes.trim(),
        photoUri: finalPhotoUri,
        times,
        refillTracking,
        updatedAt: new Date().toISOString(),
      });
      Alert.alert('Saved', `${name.trim()} has been updated.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not update medication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Edit Medication</Text>
        </View>

        {/* ── Photo picker ── */}
        <Text style={s.label}>Pill Photo</Text>
        <View style={s.photoRow}>
          <TouchableOpacity style={s.photoBox} onPress={handlePickPhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={s.photoThumb} />
            ) : (
              <View style={s.photoPlaceholder}>
                <Text style={s.photoIcon}>📷</Text>
                <Text style={s.photoHint}>Tap to add photo</Text>
              </View>
            )}
          </TouchableOpacity>
          {photoUri && (
            <TouchableOpacity style={s.removePhoto} onPress={() => setPhotoUri(null)}>
              <Text style={s.removePhotoText}>✕ Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Name ── */}
        <Text style={s.label}>Medication Name</Text>
        <TextInput
          style={[s.input, errors.name && s.inputError]}
          placeholder="e.g. Metformin"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={t => { setName(t); if (errors.name) setErrors(e => ({ ...e, name: undefined })); }}
          autoCapitalize="words"
        />
        {errors.name && <Text style={s.errorText}>{errors.name}</Text>}

        {/* ── Dosage ── */}
        <Text style={s.label}>Dosage</Text>
        <TextInput
          style={[s.input, errors.dosage && s.inputError]}
          placeholder="e.g. 500mg"
          placeholderTextColor={colors.textMuted}
          value={dosage}
          onChangeText={t => { setDosage(t); if (errors.dosage) setErrors(e => ({ ...e, dosage: undefined })); }}
        />
        {errors.dosage && <Text style={s.errorText}>{errors.dosage}</Text>}

        {/* ── Form ── */}
        <Text style={s.label}>Form</Text>
        <View style={s.chipRow}>
          {FORMS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.chip, form === f && s.chipSelected]}
              onPress={() => setForm(f)}
            >
              <Text style={[s.chipText, form === f && s.chipTextSelected]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Frequency ── */}
        <Text style={s.label}>Frequency</Text>
        <View style={s.chipRow}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.chip, frequency === f && s.chipSelected]}
              onPress={() => setFrequency(f)}
            >
              <Text style={[s.chipText, frequency === f && s.chipTextSelected]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Notes ── */}
        <Text style={s.label}>Notes (optional)</Text>
        <TextInput
          style={[s.input, s.notesInput]}
          placeholder="e.g. Take with food..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {/* ── Dose Times ── */}
        {times.length > 0 && (
          <>
            <Text style={s.label}>Dose Times</Text>
            <View style={s.timesList}>
              {times.map((t, i) => (
                <View key={i} style={s.timeRow}>
                  <Text style={s.timeText}>⏰ {t}</Text>
                  <TouchableOpacity
                    style={[s.removeTimeBtn, times.length === 1 && s.removeTimeBtnDisabled]}
                    onPress={() => {
                      if (times.length > 1) setTimes(prev => prev.filter((_, idx) => idx !== i));
                    }}
                    disabled={times.length === 1}
                  >
                    <Text style={[s.removeTimeIcon, times.length === 1 && { color: colors.border }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {times.length === 1 && (
              <Text style={s.timesHint}>At least one dose time is required.</Text>
            )}
          </>
        )}

        {/* ── Refill Tracking ── */}
        <Text style={s.label}>Refill Tracking</Text>
        <View style={[s.refillToggleRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.refillToggleLabel, { color: colors.text }]}>Track Pill Inventory</Text>
            <Text style={[s.refillToggleSub, { color: colors.textMuted }]}>Get alerted when running low</Text>
          </View>
          <Switch
            value={refillEnabled}
            onValueChange={setRefillEnabled}
            trackColor={{ true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>

        {refillEnabled && (
          <View style={[s.refillCard, { backgroundColor: colors.card }]}>
            <View style={s.refillRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.refillLabel, { color: colors.text }]}>Current Pills Remaining</Text>
                <TextInput
                  style={[s.refillInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder="e.g. 18"
                  placeholderTextColor={colors.textMuted}
                  value={pillsRemaining}
                  onChangeText={setPillsRemaining}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.refillLabel, { color: colors.text }]}>Total Bottle Size</Text>
                <TextInput
                  style={[s.refillInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder="e.g. 30"
                  placeholderTextColor={colors.textMuted}
                  value={totalQuantity}
                  onChangeText={setTotalQuantity}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View>
              <Text style={[s.refillLabel, { color: colors.text }]}>Pills per Dose</Text>
              <TextInput
                style={[s.refillInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="e.g. 1"
                placeholderTextColor={colors.textMuted}
                value={pillsPerDose}
                onChangeText={setPillsPerDose}
                keyboardType="numeric"
              />
            </View>
            {totalQuantity && pillsPerDose && !isNaN(parseInt(totalQuantity)) && !isNaN(parseInt(pillsPerDose)) && (
              <Text style={[s.refillEstimate, { color: colors.textSecondary }]}>
                📅 Estimated supply: ~{Math.floor(parseInt(pillsRemaining || totalQuantity) / (parseInt(pillsPerDose) * (times.length || 1)))} days remaining
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[s.saveButton, loading && s.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.primaryText} />
            : <Text style={s.saveButtonText}>Save Changes</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll:    { padding: 24, gap: 12, paddingBottom: 40 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  backButton:{ padding: 4 },
  backText:  { fontSize: 16, color: c.textSecondary },
  title:     { fontSize: 22, fontWeight: 'bold', color: c.text },
  label:     { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 6 },

  photoRow:         { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  photoBox:         { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' },
  photoThumb:       { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.inputBg, gap: 4 },
  photoIcon:        { fontSize: 28 },
  photoHint:        { fontSize: 11, color: c.textMuted, textAlign: 'center' },
  removePhoto:      { padding: 8 },
  removePhotoText:  { fontSize: 13, color: c.error, fontWeight: '600' },

  input: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 14, fontSize: 16, backgroundColor: c.inputBg, marginBottom: 2, color: c.text,
  },
  inputError:  { borderColor: c.error },
  errorText:   { fontSize: 12, color: c.error, marginBottom: 6, marginTop: 2 },
  notesInput:  { height: 80, textAlignVertical: 'top' },
  chipRow:     { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.chip,
  },
  chipSelected:     { backgroundColor: c.primary, borderColor: c.primary },
  chipText:         { fontSize: 14, color: c.chipText },
  chipTextSelected: { color: c.primaryText },
  timesList:          { gap: 8, marginBottom: 4 },
  timeRow:            { flexDirection: 'row', alignItems: 'center', backgroundColor: c.inputBg, borderRadius: 10, borderWidth: 1, borderColor: c.inputBorder, paddingHorizontal: 14, paddingVertical: 12 },
  timeText:           { flex: 1, fontSize: 15, color: c.text, fontWeight: '500' },
  removeTimeBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ef444422', justifyContent: 'center', alignItems: 'center' },
  removeTimeBtnDisabled: { backgroundColor: c.border + '33' },
  removeTimeIcon:     { fontSize: 13, fontWeight: '700', color: '#ef4444' },
  timesHint:          { fontSize: 12, color: c.textMuted, marginBottom: 4 },
  refillToggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, marginBottom: 4 },
  refillToggleLabel:{ fontSize: 15, fontWeight: '500' },
  refillToggleSub:  { fontSize: 12, marginTop: 2 },
  refillCard:       { borderRadius: 14, padding: 14, gap: 12 },
  refillRow:        { flexDirection: 'row', gap: 12 },
  refillLabel:      { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  refillInput: {
    borderWidth: 1, borderRadius: 10,
    padding: 12, fontSize: 16,
  },
  refillEstimate:   { fontSize: 13, fontStyle: 'italic' },
  saveButton: {
    backgroundColor: c.primary, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 16,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText:     { color: c.primaryText, fontSize: 17, fontWeight: '600' },
});
