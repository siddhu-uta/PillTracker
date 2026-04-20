// These jest.mock() calls are hoisted by babel-jest to the top of the file,
// before any require() runs, preventing Jest from loading the real ESM modules.

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'test-uid' } },
  db: {},
  storage: {},
}));

jest.mock('firebase/storage', () => ({
  ref:             jest.fn(() => 'mock-storage-ref'),
  uploadBytes:     jest.fn(() => Promise.resolve()),
  getDownloadURL:  jest.fn(() => Promise.resolve('https://storage.example.com/photo.jpg')),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection-ref'),
  addDoc:     jest.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
  getDocs:    jest.fn(() =>
    Promise.resolve({
      docs: [
        { id: 'med1', data: () => ({ name: 'Aspirin',   dosage: '100mg', times: ['8:00 AM'] }) },
        { id: 'med2', data: () => ({ name: 'Metformin', dosage: '500mg', times: ['8:00 AM', '8:00 PM'] }) },
      ],
    })
  ),
  doc:       jest.fn(() => 'mock-doc-ref'),
  updateDoc: jest.fn(() => Promise.resolve()),
  deleteDoc: jest.fn(() => Promise.resolve()),
  setDoc:    jest.fn(() => Promise.resolve()),
  getDoc:    jest.fn(() =>
    Promise.resolve({
      exists: () => true,
      data:   () => ({ med1: true, med2: false }),
      id:     'mock-doc-id',
    })
  ),
}));

const { addDoc, getDocs, updateDoc, deleteDoc, setDoc, getDoc } =
  require('firebase/firestore');

const {
  addMedication,
  getMedications,
  updateMedication,
  deleteMedication,
  markAsTaken,
  getAdherenceForDate,
  toggleMedication,
  initializeTodayAdherence,
  decrementPillsRemaining,
  getRefillStatus,
  uploadMedPhoto,
  getMedicationHistory,
} = require('../../firebase/medications');

beforeEach(() => jest.clearAllMocks());

// ─── addMedication ────────────────────────────────────────────────────────────

describe('addMedication', () => {
  it('calls addDoc and returns the new document ID', async () => {
    addDoc.mockResolvedValueOnce({ id: 'new-med-id' });
    const id = await addMedication({ name: 'Aspirin', dosage: '100mg' });
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(id).toBe('new-med-id');
  });

  it('passes medication data to addDoc', async () => {
    addDoc.mockResolvedValueOnce({ id: 'xyz' });
    const medData = { name: 'Metformin', dosage: '500mg', times: ['8:00 AM'] };
    await addMedication(medData);
    expect(addDoc).toHaveBeenCalledWith(expect.anything(), medData);
  });
});

// ─── getMedications ───────────────────────────────────────────────────────────

describe('getMedications', () => {
  it('returns a list of medications with their IDs', async () => {
    const meds = await getMedications();
    expect(meds).toHaveLength(2);
    expect(meds[0]).toMatchObject({ id: 'med1', name: 'Aspirin', dosage: '100mg' });
    expect(meds[1]).toMatchObject({ id: 'med2', name: 'Metformin', dosage: '500mg' });
  });

  it('calls getDocs once', async () => {
    await getMedications();
    expect(getDocs).toHaveBeenCalledTimes(1);
  });
});

// ─── updateMedication ─────────────────────────────────────────────────────────

describe('updateMedication', () => {
  it('calls updateDoc with the medication ref and updated data', async () => {
    const updatedData = { dosage: '200mg' };
    await updateMedication('med1', updatedData);
    expect(updateDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), updatedData);
  });
});

// ─── deleteMedication ─────────────────────────────────────────────────────────

describe('deleteMedication', () => {
  it('calls deleteDoc once', async () => {
    await deleteMedication('med1');
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });
});

// ─── markAsTaken ──────────────────────────────────────────────────────────────

describe('markAsTaken', () => {
  it('calls setDoc with { [medId]: true } and merge option', async () => {
    await markAsTaken('med1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: true },
      { merge: true }
    );
  });
});

// ─── getAdherenceForDate ──────────────────────────────────────────────────────

describe('getAdherenceForDate', () => {
  it('returns data when the document exists', async () => {
    const data = await getAdherenceForDate('2026-04-14');
    expect(data).toEqual({ med1: true, med2: false });
  });

  it('returns empty object when the document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => null });
    const data = await getAdherenceForDate('2026-01-01');
    expect(data).toEqual({});
  });
});

// ─── toggleMedication ────────────────────────────────────────────────────────

describe('toggleMedication', () => {
  it('sets dose index in a boolean array with merge', async () => {
    // existing doc has no entry for med1 → creates new array
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({}) });
    await toggleMedication('med1', 0, false, 1);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: [false] },
      { merge: true }
    );
  });

  it('can mark a specific dose as taken (true)', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({}) });
    await toggleMedication('med2', 1, true, 2);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med2: [false, true] },
      { merge: true }
    );
  });

  it('updates an existing array at the correct index', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ med1: [false, false, false] }),
    });
    await toggleMedication('med1', 1, true, 3);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: [false, true, false] },
      { merge: true }
    );
  });
});

// ─── initializeTodayAdherence ─────────────────────────────────────────────────

describe('initializeTodayAdherence', () => {
  it('writes [false] arrays for meds not yet recorded today', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data:   () => ({ med1: [true] }),
    });
    await initializeTodayAdherence([
      { id: 'med1', times: ['8:00 AM'] },
      { id: 'med2', times: ['8:00 AM', '8:00 PM'] },
      { id: 'med3', times: [] },
    ]);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med2: [false, false], med3: [false] },
      { merge: true }
    );
  });

  it('does not call setDoc when all meds are already recorded', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data:   () => ({ med1: [true], med2: [false, false] }),
    });
    await initializeTodayAdherence([
      { id: 'med1', times: ['8:00 AM'] },
      { id: 'med2', times: ['8:00 AM', '8:00 PM'] },
    ]);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('initializes all meds when no record exists yet', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false, data: () => ({}) });
    await initializeTodayAdherence([
      { id: 'med1', times: ['8:00 AM'] },
      { id: 'med2', times: ['8:00 AM', '8:00 PM'] },
    ]);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { med1: [false], med2: [false, false] },
      { merge: true }
    );
  });
});

// ─── decrementPillsRemaining ──────────────────────────────────────────────────

describe('decrementPillsRemaining', () => {
  it('decrements pillsRemaining by pillsPerDose', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        refillTracking: { enabled: true, pillsRemaining: 30, pillsPerDose: 2, totalQuantity: 60 },
      }),
    });
    const next = await decrementPillsRemaining('med1');
    expect(next).toBe(28);
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      { 'refillTracking.pillsRemaining': 28 }
    );
  });

  it('does not go below 0', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        refillTracking: { enabled: true, pillsRemaining: 1, pillsPerDose: 2, totalQuantity: 60 },
      }),
    });
    const next = await decrementPillsRemaining('med1');
    expect(next).toBe(0);
  });

  it('does nothing when refill tracking is disabled', async () => {
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ refillTracking: { enabled: false } }),
    });
    await decrementPillsRemaining('med1');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('does nothing when the document does not exist', async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    await decrementPillsRemaining('med-ghost');
    expect(updateDoc).not.toHaveBeenCalled();
  });
});

// ─── getRefillStatus ──────────────────────────────────────────────────────────

describe('getRefillStatus', () => {
  it('returns null when refill tracking is disabled', () => {
    expect(getRefillStatus({ refillTracking: { enabled: false } })).toBeNull();
  });

  it('returns null when med has no refillTracking', () => {
    expect(getRefillStatus({})).toBeNull();
    expect(getRefillStatus(null)).toBeNull();
  });

  it('calculates daysRemaining correctly for a once-daily med', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, pillsRemaining: 30, pillsPerDose: 1, totalQuantity: 30 },
    };
    const status = getRefillStatus(med);
    expect(status.daysRemaining).toBe(30);
    expect(status.pillsRemaining).toBe(30);
  });

  it('calculates daysRemaining correctly for a twice-daily med', () => {
    const med = {
      times: ['8:00 AM', '8:00 PM'],
      refillTracking: { enabled: true, pillsRemaining: 28, pillsPerDose: 1, totalQuantity: 60 },
    };
    expect(getRefillStatus(med).daysRemaining).toBe(14); // 28 / (1 × 2)
  });

  it('sets shouldAlert true when ≤7 days remain', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, pillsRemaining: 5, pillsPerDose: 1, totalQuantity: 30 },
    };
    expect(getRefillStatus(med).shouldAlert).toBe(true);
  });

  it('sets shouldAlert false when >7 days remain', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, pillsRemaining: 30, pillsPerDose: 1, totalQuantity: 30 },
    };
    expect(getRefillStatus(med).shouldAlert).toBe(false);
  });

  it('uses totalQuantity when pillsRemaining is not set', () => {
    const med = {
      times: ['8:00 AM'],
      refillTracking: { enabled: true, totalQuantity: 20, pillsPerDose: 1 },
    };
    expect(getRefillStatus(med).daysRemaining).toBe(20);
  });
});

// ─── uploadMedPhoto ───────────────────────────────────────────────────────────

describe('uploadMedPhoto', () => {
  const { ref, uploadBytes, getDownloadURL } = require('firebase/storage');

  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ blob: () => Promise.resolve('mock-blob') })
    );
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('fetches the local URI, uploads the blob, and returns the download URL', async () => {
    const url = await uploadMedPhoto('file://local/photo.jpg', 'med123');
    expect(fetch).toHaveBeenCalledWith('file://local/photo.jpg');
    expect(uploadBytes).toHaveBeenCalledWith('mock-storage-ref', 'mock-blob');
    expect(getDownloadURL).toHaveBeenCalledWith('mock-storage-ref');
    expect(url).toBe('https://storage.example.com/photo.jpg');
  });

  it('builds the correct storage path for the user and med', async () => {
    await uploadMedPhoto('file://local/img.jpg', 'med-xyz');
    expect(ref).toHaveBeenCalledWith({}, 'users/test-uid/meds/med-xyz.jpg');
  });
});

// ─── getMedicationHistory ─────────────────────────────────────────────────────

describe('getMedicationHistory', () => {
  it('returns entries for dates with adherence data', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'med1', data: () => ({ name: 'Aspirin', dosage: '100mg' }) },
      ],
    });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ med1: [true] }),
    });
    // Remaining days return empty
    getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    const history = await getMedicationHistory(1);
    expect(history).toHaveLength(1);
    expect(history[0].entries[0]).toMatchObject({ name: 'Aspirin', taken: true });
  });

  it('skips deleted medications (no entry in medMap)', async () => {
    getDocs.mockResolvedValueOnce({ docs: [] }); // no meds
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ghost_med: [true] }), // adherence for a deleted med
    });
    getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    const history = await getMedicationHistory(1);
    expect(history).toHaveLength(0);
  });

  it('expands boolean[] into per-dose entries with labels for multi-dose meds', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [
        { id: 'med2', data: () => ({ name: 'Metformin', dosage: '500mg' }) },
      ],
    });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ med2: [true, false] }),
    });
    getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    const history = await getMedicationHistory(1);
    expect(history[0].entries).toHaveLength(2);
    expect(history[0].entries[0].name).toBe('Metformin · 1/2');
    expect(history[0].entries[1].name).toBe('Metformin · 2/2');
    expect(history[0].entries[0].taken).toBe(true);
    expect(history[0].entries[1].taken).toBe(false);
  });

  it('handles legacy boolean (not array) adherence data', async () => {
    getDocs.mockResolvedValueOnce({
      docs: [{ id: 'med1', data: () => ({ name: 'Aspirin', dosage: '100mg' }) }],
    });
    getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ med1: true }), // legacy boolean
    });
    getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    const history = await getMedicationHistory(1);
    expect(history[0].entries[0]).toMatchObject({ name: 'Aspirin', taken: true });
  });

  it('omits dates with no adherence entries', async () => {
    getDocs.mockResolvedValueOnce({ docs: [] });
    getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });

    const history = await getMedicationHistory(3);
    expect(history).toHaveLength(0);
  });
});
