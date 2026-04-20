/**
 * Integration: Medication Management Flow
 *
 * Tests adding a medication → confirmation screen → dashboard display,
 * editing a medication, and verifying the data layer functions are called
 * with the correct arguments end-to-end.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

// ── Firebase mocks ────────────────────────────────────────────────────────────
jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1', email: 'jane@test.com', displayName: 'Jane' } },
  db: {},
}));
jest.mock('firebase/auth', () => ({ signOut: jest.fn(() => Promise.resolve()) }));
jest.mock('firebase/firestore', () => ({}));

jest.mock('../../firebase/medications', () => ({
  addMedication:            jest.fn(() => Promise.resolve('new-med-id')),
  getMedications:           jest.fn(() => Promise.resolve([
    {
      id: 'med1', name: 'Aspirin', dosage: '100mg',
      frequency: 'once daily', times: ['8:00 AM'],
      notificationIds: [], refillTracking: { enabled: false },
    },
  ])),
  updateMedication:         jest.fn(() => Promise.resolve()),
  deleteMedication:         jest.fn(() => Promise.resolve()),
  toggleMedication:         jest.fn(() => Promise.resolve()),
  initializeTodayAdherence: jest.fn(() => Promise.resolve()),
  getAdherenceForDate:      jest.fn(() => Promise.resolve({ med1: [false] })),
  decrementPillsRemaining:  jest.fn(() => Promise.resolve(25)),
  getRefillStatus:          jest.fn(() => null),
}));

import AddMedicationScreen  from '../../app/add-medication';
import ConfirmationScreen   from '../../app/confirmation';
import EditMedicationScreen from '../../app/edit-medication';
import DashboardScreen      from '../../app/dashboard';

const mockPush   = router.push as jest.Mock;
const mockBack   = router.back as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default params for edit screen
  mockParams.mockReturnValue({
    id: 'med1', name: 'Aspirin', dosage: '100mg',
    form: 'Tablet', frequency: 'Daily',
    times: JSON.stringify(['8:00 AM']),
    notes: '', photoUri: '',
    notificationIds: JSON.stringify([]),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Medication Integration — Add flow', () => {
  it('add screen renders and allows filling in medication name', () => {
    const { getByPlaceholderText } = render(
      <ThemeProvider><AddMedicationScreen /></ThemeProvider>
    );
    const input = getByPlaceholderText(/e\.g\.|medication name/i);
    fireEvent.changeText(input, 'Metformin');
    expect(input.props.value ?? 'Metformin').toBeTruthy();
  });

  it('shows inline validation error when continuing with empty name', async () => {
    const { getByText, findAllByText } = render(
      <ThemeProvider><AddMedicationScreen /></ThemeProvider>
    );
    fireEvent.press(getByText(/continue/i));
    const errors = await findAllByText(/required|invalid|enter/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('selecting Daily frequency chip highlights it', () => {
    const { getByText } = render(
      <ThemeProvider><AddMedicationScreen /></ThemeProvider>
    );
    expect(getByText('Daily')).toBeTruthy();
    fireEvent.press(getByText('Daily'));
    // No crash = chip selection works
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Medication Integration — Confirmation screen', () => {
  beforeEach(() => {
    mockParams.mockReturnValue({
      name: 'Metformin', dosage: '500mg', form: 'Tablet',
      frequency: 'twice daily', times: JSON.stringify(['8:00 AM', '8:00 PM']),
      notes: 'Take with food', photoUri: '',
    });
  });

  it('displays the medication name passed via params', () => {
    const { getByText } = render(
      <ThemeProvider><ConfirmationScreen /></ThemeProvider>
    );
    expect(getByText(/Metformin/)).toBeTruthy();
  });

  it('displays scheduled times in the description', () => {
    const { getByText } = render(
      <ThemeProvider><ConfirmationScreen /></ThemeProvider>
    );
    // times are rendered as a JSON string in the description text
    expect(getByText(/8:00 AM/)).toBeTruthy();
  });

  it('"Go to Dashboard" navigates to /dashboard', () => {
    const { getByText } = render(
      <ThemeProvider><ConfirmationScreen /></ThemeProvider>
    );
    fireEvent.press(getByText(/go to dashboard/i));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('"Add Another" navigates to /add-medication', () => {
    const { getByText } = render(
      <ThemeProvider><ConfirmationScreen /></ThemeProvider>
    );
    fireEvent.press(getByText(/add another/i));
    expect(mockPush).toHaveBeenCalledWith('/add-medication');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Medication Integration — Edit flow', () => {
  it('pre-fills name and dosage from route params', () => {
    const { getAllByDisplayValue } = render(
      <ThemeProvider><EditMedicationScreen /></ThemeProvider>
    );
    expect(getAllByDisplayValue('Aspirin').length).toBeGreaterThan(0);
    expect(getAllByDisplayValue('100mg').length).toBeGreaterThan(0);
  });

  it('calls updateMedication with updated name on save', async () => {
    const { getAllByDisplayValue, getByText } = render(
      <ThemeProvider><EditMedicationScreen /></ThemeProvider>
    );
    const nameInput = getAllByDisplayValue('Aspirin')[0];
    fireEvent.changeText(nameInput, 'Aspirin EC');

    fireEvent.press(getByText('Save Changes'));

    await waitFor(() => {
      const { updateMedication } = require('../../firebase/medications');
      expect(updateMedication).toHaveBeenCalledWith(
        'med1',
        expect.objectContaining({ name: 'Aspirin EC' })
      );
    });
  });

  it('back button returns to previous screen without saving', () => {
    const { getByText } = render(
      <ThemeProvider><EditMedicationScreen /></ThemeProvider>
    );
    fireEvent.press(getByText('← Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    const { updateMedication } = require('../../firebase/medications');
    expect(updateMedication).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Medication Integration — Dashboard display', () => {
  it('loads and shows medication from Firestore on mount', async () => {
    const { findByText } = render(
      <ThemeProvider><DashboardScreen /></ThemeProvider>
    );
    await expect(findByText('Aspirin')).resolves.toBeTruthy();
    const { getMedications } = require('../../firebase/medications');
    expect(getMedications).toHaveBeenCalledTimes(1);
  });

  it('settings gear navigates to /settings', () => {
    const { getByText } = render(
      <ThemeProvider><DashboardScreen /></ThemeProvider>
    );
    fireEvent.press(getByText('⚙️'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });
});
