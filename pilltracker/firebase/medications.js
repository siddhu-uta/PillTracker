import { db, auth } from './config';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc
} from 'firebase/firestore';

// Get the current user's ID
const getUID = () => auth.currentUser?.uid;

// ─── MEDICATIONS ────────────────────────────────────────────

// Add a new medication
export const addMedication = async (medicationData) => {
  const uid = getUID();
  const ref = collection(db, 'users', uid, 'medications');
  const docRef = await addDoc(ref, medicationData);
  return docRef.id;
};

// Get all medications for the current user
export const getMedications = async () => {
  const uid = getUID();
  const ref = collection(db, 'users', uid, 'medications');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Update an existing medication
export const updateMedication = async (medId, updatedData) => {
  const uid = getUID();
  const ref = doc(db, 'users', uid, 'medications', medId);
  await updateDoc(ref, updatedData);
};

// Delete a medication
export const deleteMedication = async (medId) => {
  const uid = getUID();
  await deleteDoc(doc(db, 'users', uid, 'medications', medId));
};

// ─── ADHERENCE ──────────────────────────────────────────────

// Mark a medication as taken for today
export const markAsTaken = async (medId) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0]; // e.g. "2026-02-27"
  const ref = doc(db, 'users', uid, 'adherence', today);
  await setDoc(ref, { [medId]: true }, { merge: true });
};

// Get adherence data for a specific date
export const getAdherenceForDate = async (date) => {
  const uid = getUID();
  const ref = doc(db, 'users', uid, 'adherence', date);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? snapshot.data() : {};
};

// Get adherence for the past 7 days (for the dashboard chart)
export const getWeeklyAdherence = async () => {
  const uid = getUID();
  const results = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const data = await getAdherenceForDate(dateStr);
    results.push({ date: dateStr, data });
  }

  return results;
};


export const toggleMedication = async (medId, value) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'users', uid, 'adherence', today);
  await setDoc(ref, { [medId]: value }, { merge: true });
};

// Write false for any med that has no entry for today yet (so history shows "Missed")
export const initializeTodayAdherence = async (medIds) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'users', uid, 'adherence', today);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};

  const updates = {};
  for (const id of medIds) {
    if (!(id in existing)) {
      updates[id] = false; // default to missed until marked taken
    }
  }

  if (Object.keys(updates).length > 0) {
    await setDoc(ref, updates, { merge: true });
  }
};

// ─── REFILL TRACKING ────────────────────────────────────────────────────────

// Decrement pillsRemaining by pillsPerDose when a medication is marked taken.
// Only acts if refill tracking is enabled for that medication.
export const decrementPillsRemaining = async (medId) => {
  const uid = getUID();
  const ref = doc(db, 'users', uid, 'medications', medId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const refill = data.refillTracking;
  if (!refill?.enabled) return;

  const current = typeof refill.pillsRemaining === 'number' ? refill.pillsRemaining : refill.totalQuantity;
  const perDose = refill.pillsPerDose ?? 1;
  const next = Math.max(0, current - perDose);

  await updateDoc(ref, { 'refillTracking.pillsRemaining': next });
  return next;
};

// Calculate days of supply remaining from a medication's refill data.
// Returns { daysRemaining, shouldAlert } or null if tracking is disabled.
export const getRefillStatus = (med) => {
  const refill = med?.refillTracking;
  if (!refill?.enabled) return null;

  const remaining  = typeof refill.pillsRemaining === 'number' ? refill.pillsRemaining : refill.totalQuantity;
  const perDose    = refill.pillsPerDose ?? 1;
  const dosesPerDay = med.times?.length ?? 1;
  const pillsPerDay = perDose * dosesPerDay;

  if (pillsPerDay <= 0) return null;

  const daysRemaining = Math.floor(remaining / pillsPerDay);
  return { daysRemaining, pillsRemaining: remaining, shouldAlert: daysRemaining <= 7 };
};

// Get medication history for the past N days, merged with medication names
export const getMedicationHistory = async (days = 30) => {
  const uid = getUID();

  // Fetch all medications to get their names
  const medsSnapshot = await getDocs(collection(db, 'users', uid, 'medications'));
  const medMap = {};
  medsSnapshot.docs.forEach(d => {
    medMap[d.id] = { id: d.id, ...d.data() };
  });

  const results = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const adherenceRef = doc(db, 'users', uid, 'adherence', dateStr);
    const adherenceSnap = await getDoc(adherenceRef);
    const adherenceData = adherenceSnap.exists() ? adherenceSnap.data() : {};

    // Only include days that have at least one entry
    const entries = Object.entries(adherenceData).map(([medId, taken]) => ({
      medId,
      name: medMap[medId]?.name ?? 'Deleted medication',
      dosage: medMap[medId]?.dosage ?? '',
      taken: Boolean(taken),
    }));

    if (entries.length > 0) {
      results.push({ date: dateStr, entries });
    }
  }

  return results;
};