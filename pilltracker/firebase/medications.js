import { db, auth, storage } from './config';
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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Get the current user's ID
const getUID = () => auth.currentUser?.uid;

// ─── PHOTO UPLOAD ────────────────────────────────────────────

// Upload a local photo URI to Firebase Storage and return the remote download URL.
// Path: users/{uid}/meds/{medId}.jpg
export const uploadMedPhoto = async (localUri, medId) => {
  const uid = getUID();
  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `users/${uid}/meds/${medId}.jpg`);
  await uploadBytes(storageRef, blob);
  return await getDownloadURL(storageRef);
};

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


// Toggle a single dose by index.
// takenDoses is stored as boolean[] — one entry per time slot.
export const toggleMedication = async (medId, doseIndex, value, totalDoses = 1) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'users', uid, 'adherence', today);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};

  // Normalise: old boolean format → single-element array
  let arr = Array.isArray(existing[medId])
    ? [...existing[medId]]
    : new Array(totalDoses).fill(false);

  while (arr.length < totalDoses) arr.push(false);
  arr[doseIndex] = value;
  await setDoc(ref, { [medId]: arr }, { merge: true });
};

// Initialise today's adherence for every med as [false, false, …] (one per dose)
export const initializeTodayAdherence = async (meds) => {
  const uid = getUID();
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'users', uid, 'adherence', today);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};

  const updates = {};
  for (const med of meds) {
    if (!(med.id in existing)) {
      const count = Array.isArray(med.times) && med.times.length > 0 ? med.times.length : 1;
      updates[med.id] = new Array(count).fill(false);
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

    const entries = [];
    for (const [medId, takenData] of Object.entries(adherenceData)) {
      const med = medMap[medId];
      if (!med) continue; // deleted medication — skip entirely

      // adherence stores boolean[] (per-dose) or legacy boolean
      const takenArr = Array.isArray(takenData) ? takenData : [Boolean(takenData)];
      const multiDose = takenArr.length > 1;
      takenArr.forEach((t, i) => {
        entries.push({
          medId,
          name: multiDose ? `${med.name} · ${i + 1}/${takenArr.length}` : med.name,
          dosage: med.dosage ?? '',
          taken: Boolean(t),
        });
      });
    }

    if (entries.length > 0) {
      results.push({ date: dateStr, entries });
    }
  }

  return results;
};