import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

jest.mock('../../firebase/medications', () => ({
  addMedication: jest.fn(() => Promise.resolve('new-id')),
}));

import SetRemindersScreen from '../../app/set-reminders';

const mockPush   = router.push as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><SetRemindersScreen /></ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.mockReturnValue({
    name: 'Aspirin', dosage: '100mg', form: 'tablet',
    frequency: 'once daily', notes: '', photoUri: '',
  });
});

describe('SetRemindersScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the Set Reminders title', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Set Reminders/i)).toBeTruthy();
  });

  it('shows the medication name from params', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Aspirin/)).toBeTruthy();
  });

  it('shows initial time slot for once daily', () => {
    const { getByText } = renderScreen();
    expect(getByText(/8:00 AM/)).toBeTruthy();
  });

  it('shows two time slots for twice daily', () => {
    mockParams.mockReturnValue({
      name: 'Metformin', dosage: '500mg', form: 'tablet',
      frequency: 'twice daily', notes: '', photoUri: '',
    });
    const { getAllByText } = renderScreen();
    expect(getAllByText(/Dose/).length).toBe(2);
  });

  it('renders Push Notifications toggle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Push Notifications')).toBeTruthy();
  });

  it('renders Sound Alert toggle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Sound Alert')).toBeTruthy();
  });

  it('renders Snooze toggle', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Snooze/i)).toBeTruthy();
  });

  it('renders the Save Reminders button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Save Reminders')).toBeTruthy();
  });

  it('can add another time slot', () => {
    const { getByText, getAllByText } = renderScreen();
    fireEvent.press(getByText('+ Add another time'));
    expect(getAllByText(/Dose/).length).toBe(2);
  });

  it('renders the refill tracking toggle', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Track Pill Inventory/i)).toBeTruthy();
  });

  it('saves medication and navigates to confirmation on submit', async () => {
    const { getByText } = renderScreen();
    await act(async () => {
      fireEvent.press(getByText('Save Reminders'));
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/confirmation' })
      );
    });
  });
});
