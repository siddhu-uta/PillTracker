import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';
import ConfirmationScreen from '../../app/confirmation';

const mockPush = router.push as jest.Mock;
const mockParams = useLocalSearchParams as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><ConfirmationScreen /></ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.mockReturnValue({ name: 'Aspirin', dosage: '100mg', times: '8:00 AM, 8:00 PM' });
});

describe('ConfirmationScreen', () => {
  it('renders the success checkmark and title', () => {
    const { getByText } = renderScreen();
    expect(getByText('✓')).toBeTruthy();
    expect(getByText('All Set!')).toBeTruthy();
  });

  it('shows the medication name and dosage', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Aspirin 100mg/)).toBeTruthy();
  });

  it('shows reminder times in the description', () => {
    const { getByText } = renderScreen();
    expect(getByText(/8:00 AM, 8:00 PM/)).toBeTruthy();
  });

  it('renders Go to Dashboard button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Go to Dashboard')).toBeTruthy();
  });

  it('renders Add Another Medication button', () => {
    const { getByText } = renderScreen();
    expect(getByText('+ Add Another Medication')).toBeTruthy();
  });

  it('navigates to dashboard when button pressed', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Go to Dashboard'));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to add-medication when button pressed', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('+ Add Another Medication'));
    expect(mockPush).toHaveBeenCalledWith('/add-medication');
  });

  it('renders without times gracefully', () => {
    mockParams.mockReturnValue({ name: 'Metformin', dosage: '500mg' });
    const { getByText } = renderScreen();
    expect(getByText(/Metformin 500mg/)).toBeTruthy();
  });
});
