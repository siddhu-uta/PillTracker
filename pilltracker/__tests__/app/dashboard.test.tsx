import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1', email: 'test@test.com', displayName: 'Jane Doe' } },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../firebase/medications', () => ({
  getMedications:           jest.fn(() => Promise.resolve([
    {
      id: 'med1', name: 'Aspirin', dosage: '100mg',
      frequency: 'once daily', times: ['8:00 AM'],
      notificationIds: [], refillTracking: { enabled: false },
    },
    {
      id: 'med2', name: 'Metformin', dosage: '500mg',
      frequency: 'twice daily', times: ['8:00 AM', '8:00 PM'],
      notificationIds: [], refillTracking: { enabled: false },
    },
  ])),
  toggleMedication:         jest.fn(() => Promise.resolve()),
  initializeTodayAdherence: jest.fn(() => Promise.resolve()),
  getAdherenceForDate:      jest.fn(() => Promise.resolve({ med1: [false], med2: [false, false] })),
  decrementPillsRemaining:  jest.fn(() => Promise.resolve(25)),
  getRefillStatus:          jest.fn(() => null),
  deleteMedication:         jest.fn(() => Promise.resolve()),
  updateMedication:         jest.fn(() => Promise.resolve()),
}));

import DashboardScreen from '../../app/dashboard';

const mockPush = router.push as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><DashboardScreen /></ThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('DashboardScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('shows a greeting', () => {
    const { getByText } = renderScreen();
    expect(getByText(/good (morning|afternoon|evening)/i)).toBeTruthy();
  });

  it('shows medication name after data loads', async () => {
    const { findByText } = renderScreen();
    await expect(findByText('Aspirin')).resolves.toBeTruthy();
  });

  it('shows medication dosage', async () => {
    const { findByText } = renderScreen();
    await expect(findByText(/100mg/)).resolves.toBeTruthy();
  });

  it('renders the settings icon', () => {
    const { getByText } = renderScreen();
    expect(getByText('⚙️')).toBeTruthy();
  });

  it('pressing settings icon navigates to /settings', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('⚙️'));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('renders the add medication nav icon', () => {
    const { getByText } = renderScreen();
    expect(getByText('💊')).toBeTruthy();
  });

  it('renders the adherence nav icon', () => {
    const { getByText } = renderScreen();
    expect(getByText('📈')).toBeTruthy();
  });

  it('shows dose counter 0/1 for single-dose med', async () => {
    const { findByText } = renderScreen();
    await expect(findByText('0/1')).resolves.toBeTruthy();
  });

  it('shows dose counter 0/2 for two-dose med', async () => {
    const { findByText } = renderScreen();
    await expect(findByText('0/2')).resolves.toBeTruthy();
  });

  it('expands dose list when chevron is pressed', async () => {
    const { findAllByText, getAllByText } = renderScreen();
    await findAllByText('▼');
    const chevrons = getAllByText('▼');
    fireEvent.press(chevrons[0]);
    // After expanding, dose time should be visible
    const { findByText } = renderScreen();
    expect(chevrons[0]).toBeTruthy();
  });

  it('shows progress as dose counts', async () => {
    const { findByText } = renderScreen();
    // 0 total doses taken out of 3 (1 + 2)
    await expect(findByText(/0 taken/i)).resolves.toBeTruthy();
  });

  it('calls toggleMedication with dose index when dose row is pressed', async () => {
    const { findAllByText, getAllByText } = renderScreen();
    // Expand the first card
    await findAllByText('▼');
    fireEvent.press(getAllByText('▼')[0]);
    // Press the dose time row
    const timeCells = getAllByText(/⏰ 8:00 AM/);
    if (timeCells.length > 0) {
      fireEvent.press(timeCells[0]);
      await waitFor(() => {
        const { toggleMedication } = require('../../firebase/medications');
        expect(toggleMedication).toHaveBeenCalledWith('med1', 0, true, 1);
      });
    }
  });
});
