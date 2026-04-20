import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

jest.mock('../../firebase/medications', () => ({
  getMedicationHistory: jest.fn(() =>
    Promise.resolve([
      {
        date: '2026-04-14',
        entries: [
          { medId: 'm1', name: 'Aspirin',   dosage: '100mg', taken: true  },
          { medId: 'm2', name: 'Metformin', dosage: '500mg', taken: false },
        ],
      },
      {
        date: '2026-04-13',
        entries: [
          { medId: 'm1', name: 'Aspirin', dosage: '100mg', taken: true },
        ],
      },
    ])
  ),
}));

import AdherenceScreen from '../../app/adherence';

const mockBack = router.back as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><AdherenceScreen /></ThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('AdherenceScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders a title containing Adherence or History', () => {
    const { getByText } = renderScreen();
    expect(getByText(/adherence|history/i)).toBeTruthy();
  });

  it('shows medication names after data loads', async () => {
    const { findAllByText } = renderScreen();
    const items = await findAllByText('Aspirin');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders the stats tab button', () => {
    const { getByText } = renderScreen();
    expect(getByText(/stats/i)).toBeTruthy();
  });

  it('can switch to stats view', async () => {
    const { getByText, getAllByText } = renderScreen();
    const statsTab = getByText(/stats/i);
    fireEvent.press(statsTab);
    await waitFor(() => {
      expect(getAllByText(/adherence|taken|missed|streak/i).length).toBeGreaterThan(0);
    });
  });

  it('renders the export emoji button', () => {
    const { getByText } = renderScreen();
    expect(getByText('📤')).toBeTruthy();
  });

  it('renders a back/close button', () => {
    const { getByText } = renderScreen();
    expect(getByText(/←|back|close/i)).toBeTruthy();
  });

  it('pressing back button calls router.back', () => {
    const { getByText } = renderScreen();
    const backBtn = getByText(/←|back|close/i);
    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
