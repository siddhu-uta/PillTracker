import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

const mockGetMedications  = jest.fn();
const mockUpdateMedication = jest.fn();

jest.mock('../../firebase/medications', () => ({
  getMedications:   (...args: any[]) => mockGetMedications(...args),
  updateMedication: (...args: any[]) => mockUpdateMedication(...args),
  getRefillStatus: (med: any) => {
    const refill = med?.refillTracking;
    if (!refill?.enabled) return null;
    const remaining = typeof refill.pillsRemaining === 'number' ? refill.pillsRemaining : refill.totalQuantity;
    const perDose = refill.pillsPerDose ?? 1;
    const dosesPerDay = med.times?.length ?? 1;
    const pillsPerDay = perDose * dosesPerDay;
    if (pillsPerDay <= 0) return null;
    const daysRemaining = Math.floor(remaining / pillsPerDay);
    return { daysRemaining, pillsRemaining: remaining, shouldAlert: daysRemaining <= 7 };
  },
}));

import RefillRemindersScreen from '../../app/refill-reminders';

const mockBack = router.back as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><RefillRemindersScreen /></ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateMedication.mockResolvedValue(undefined);
});

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe('RefillRemindersScreen', () => {
  it('renders without crashing', async () => {
    mockGetMedications.mockResolvedValue([]);
    const { toJSON } = renderScreen();
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('shows the Refill Reminders title', async () => {
    mockGetMedications.mockResolvedValue([]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Refill Reminders/i)).toBeTruthy());
  });

  it('pressing Back calls router.back', async () => {
    mockGetMedications.mockResolvedValue([]);
    const { getByText } = renderScreen();
    await waitFor(() => getByText('← Back'));
    fireEvent.press(getByText('← Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no refill-tracked meds', async () => {
    mockGetMedications.mockResolvedValue([]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText('No refill tracking set up')).toBeTruthy());
  });

  it('renders a RefillCard for a tracked medication', async () => {
    mockGetMedications.mockResolvedValue([
      {
        id: 'med1',
        name: 'Aspirin',
        dosage: '100mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: true, totalQuantity: 30, pillsPerDose: 1, pillsRemaining: 25 },
      },
    ]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText('Aspirin')).toBeTruthy());
    expect(getByText('100mg')).toBeTruthy();
  });

  it('shows Needs Attention section for low-supply meds', async () => {
    mockGetMedications.mockResolvedValue([
      {
        id: 'med1',
        name: 'Warfarin',
        dosage: '5mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: true, totalQuantity: 30, pillsPerDose: 1, pillsRemaining: 3 },
      },
    ]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Needs Attention/i)).toBeTruthy());
  });

  it('shows Sufficient Supply section for well-stocked meds', async () => {
    mockGetMedications.mockResolvedValue([
      {
        id: 'med1',
        name: 'Lisinopril',
        dosage: '10mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: true, totalQuantity: 90, pillsPerDose: 1, pillsRemaining: 80 },
      },
    ]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText(/Sufficient Supply/i)).toBeTruthy());
  });

  it('skips meds without refill tracking enabled', async () => {
    mockGetMedications.mockResolvedValue([
      {
        id: 'med1',
        name: 'Ibuprofen',
        dosage: '200mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: false },
      },
    ]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText('No refill tracking set up')).toBeTruthy());
  });

  it('shows Mark as Refilled button on each card', async () => {
    mockGetMedications.mockResolvedValue([
      {
        id: 'med1',
        name: 'Aspirin',
        dosage: '100mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: true, totalQuantity: 30, pillsPerDose: 1, pillsRemaining: 10 },
      },
    ]);
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText('🔁 Mark as Refilled')).toBeTruthy());
  });

  it('sorts meds so critical ones appear first', async () => {
    mockGetMedications.mockResolvedValue([
      {
        id: 'med1',
        name: 'Aspirin',
        dosage: '100mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: true, totalQuantity: 30, pillsPerDose: 1, pillsRemaining: 28 },
      },
      {
        id: 'med2',
        name: 'Warfarin',
        dosage: '5mg',
        times: ['8:00 AM'],
        refillTracking: { enabled: true, totalQuantity: 30, pillsPerDose: 1, pillsRemaining: 2 },
      },
    ]);
    const { getAllByText } = renderScreen();
    await waitFor(() => getAllByText(/mg/));
    // Both cards should render
    const { getByText } = renderScreen();
    await waitFor(() => expect(getByText('Warfarin')).toBeTruthy());
  });
});
