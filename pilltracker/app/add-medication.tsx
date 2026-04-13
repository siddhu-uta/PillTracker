import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator, Animated,
  Image, Alert, Modal,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getMedications } from '../firebase/medications';
import { checkDrugInteractions, severityColor, severityLabel, type DrugInteraction } from '../utils/drugInteractions';
import { useTheme } from '../utils/theme';

const FREQUENCIES = ['Daily', 'Weekly', 'As needed'];
const FORMS = ['Tablet', 'Capsule', 'Liquid', 'Injection'];
const DOSAGE_REGEX = /^\d+(\.\d+)?\s*(mg|ml|mcg|g|iu|units?|drops?|puffs?|%)/i;

type Errors = { name?: string; dosage?: string };

// ─── Drug Interaction Alert Modal ─────────────────────────────────────────────
function InteractionModal({
  visible,
  interactions,
  onProceed,
  onCancel,
  colors,
}: {
  visible: boolean;
  interactions: DrugInteraction[];
  onProceed: () => void;
  onCancel: () => void;
  colors: any;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, gap: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.error }}>
            ⚠️ Drug Interaction Warning
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
            The following interactions were detected with your current medications. This is advisory — consult your doctor or pharmacist before proceeding.
          </Text>

          {interactions.map((inter, i) => (
            <View
              key={i}
              style={{
                backgroundColor: severityColor(inter.severity) + '15',
                borderLeftWidth: 4,
                borderLeftColor: severityColor(inter.severity),
                borderRadius: 10,
                padding: 12,
                gap: 4,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: severityColor(inter.severity), letterSpacing: 0.5 }}>
                {severityLabel(inter.severity)} INTERACTION
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                {inter.drugs[0].charAt(0).toUpperCase() + inter.drugs[0].slice(1)} + {inter.drugs[1].charAt(0).toUpperCase() + inter.drugs[1].slice(1)}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                {inter.description}
              </Text>
              <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600', marginTop: 4 }}>
                Recommendation: {inter.recommendation}
              </Text>
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity
              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center' }}
              onPress={onCancel}
            >
              <Text style={{ fontSize: 15, color: colors.textSecondary, fontWeight: '600' }}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: colors.error, borderRadius: 12, padding: 14, alignItems: 'center' }}
              onPress={onProceed}
            >
              <Text style={{ fontSize: 15, color: '#fff', fontWeight: '700' }}>Add Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AddMedicationScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [name, setName]           = useState('');
  const [dosage, setDosage]       = useState('');
  const [form, setForm]           = useState('Tablet');
  const [frequency, setFrequency] = useState('Daily');
  const [notes, setNotes]         = useState('');
  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [errors, setErrors]       = useState<Errors>({});
  const [loading, setLoading]     = useState(false);

  const [pendingInteractions, setPendingInteractions] = useState<DrugInteraction[]>([]);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [pendingParams, setPendingParams]   = useState<any>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Camera / Gallery ──────────────────────────────────────────────────────
  const handlePickPhoto = () => {
    Alert.alert('Add Photo', 'Choose a source', [
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

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = async (): Promise<boolean> => {
    const newErrors: Errors = {};
    if (!name.trim()) {
      newErrors.name = 'Medication name is required.';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    } else {
      const existing = await getMedications();
      const duplicate = existing.some(
        (m: any) => m.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicate) newErrors.name = `"${name.trim()}" is already in your medications.`;
    }
    if (!dosage.trim()) {
      newErrors.dosage = 'Dosage is required.';
    } else if (!DOSAGE_REGEX.test(dosage.trim())) {
      newErrors.dosage = 'Enter a valid dosage (e.g. 500mg, 10ml, 5mcg).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    setLoading(true);
    const valid = await validate();
    if (!valid) { setLoading(false); return; }

    // ── Drug interaction check ──────────────────────────────────────────────
    try {
      const existing = await getMedications();
      const existingNames = existing.map((m: any) => m.name);
      const interactions  = checkDrugInteractions(name.trim(), existingNames);

      const params = {
        name: name.trim(), dosage: dosage.trim(), form, frequency, notes, photoUri: photoUri ?? '',
      };

      setLoading(false);

      if (interactions.length > 0) {
        setPendingInteractions(interactions);
        setPendingParams(params);
        setShowInteractionModal(true);
        return;
      }

      navigateToReminders(params);
    } catch {
      setLoading(false);
      Alert.alert('Error', 'Could not check interactions. Please try again.');
    }
  };

  const navigateToReminders = (params: any) => {
    setShowInteractionModal(false);
    router.push({ pathname: '/set-reminders' as any, params });
  };

  return (
    <SafeAreaView style={s.container}>
      <Animated.ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
      >
        <Text style={s.title}>+ Add Medication</Text>

        {/* ── Photo picker ── */}
        <Text style={s.label}>Pill Photo (optional)</Text>
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
          onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: undefined })); }}
          autoCapitalize="words"
        />
        {errors.name && <Text style={s.errorText}>⚠ {errors.name}</Text>}

        <View style={s.row}>
          {/* ── Dosage ── */}
          <View style={s.halfWidth}>
            <Text style={s.label}>Dosage</Text>
            <TextInput
              style={[s.input, errors.dosage && s.inputError]}
              placeholder="500mg"
              placeholderTextColor={colors.textMuted}
              value={dosage}
              onChangeText={t => { setDosage(t); setErrors(e => ({ ...e, dosage: undefined })); }}
              autoCapitalize="none"
            />
            {errors.dosage && <Text style={s.errorText}>⚠ {errors.dosage}</Text>}
          </View>

          {/* ── Form ── */}
          <View style={s.halfWidth}>
            <Text style={s.label}>Form</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FORMS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.chip, form === f && s.chipSelected]}
                  onPress={() => setForm(f)}
                >
                  <Text style={[s.chipText, form === f && s.chipTextSelected]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
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
          placeholder="Take with food..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[s.primaryButton, loading && s.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={colors.primaryText} />
            : <Text style={s.primaryButtonText}>Continue</Text>
          }
        </TouchableOpacity>
      </Animated.ScrollView>

      {/* Drug interaction warning */}
      <InteractionModal
        visible={showInteractionModal}
        interactions={pendingInteractions}
        colors={colors}
        onCancel={() => setShowInteractionModal(false)}
        onProceed={() => navigateToReminders(pendingParams)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll:    { padding: 24, gap: 12 },
  title:     { fontSize: 26, fontWeight: 'bold', color: c.text, marginBottom: 8 },
  label:     { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 6 },

  photoRow:        { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  photoBox:        { width: 100, height: 100, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' },
  photoThumb:      { width: '100%', height: '100%' },
  photoPlaceholder:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.inputBg, gap: 4 },
  photoIcon:       { fontSize: 28 },
  photoHint:       { fontSize: 11, color: c.textMuted, textAlign: 'center' },
  removePhoto:     { padding: 8 },
  removePhotoText: { fontSize: 13, color: c.error, fontWeight: '600' },

  input: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 14, fontSize: 16, backgroundColor: c.inputBg, marginBottom: 2, color: c.text,
  },
  inputError:    { borderColor: c.error },
  errorText:     { fontSize: 12, color: c.error, marginBottom: 6, marginTop: 2 },
  notesInput:    { height: 80, textAlignVertical: 'top' },
  row:           { flexDirection: 'row', gap: 12 },
  halfWidth:     { flex: 1 },
  chipRow:       { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.chip,
  },
  chipSelected:      { backgroundColor: c.primary, borderColor: c.primary },
  chipText:          { fontSize: 14, color: c.chipText },
  chipTextSelected:  { color: c.primaryText },
  primaryButton: {
    backgroundColor: c.primary, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 16,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText:     { color: c.primaryText, fontSize: 17, fontWeight: '600' },
});
