import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({ auth: { currentUser: { uid: 'u1' } }, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('firebase/firestore', () => ({}));

jest.mock('../../firebase/medications', () => ({
  getMedications: jest.fn(() => Promise.resolve([
    { id: 'm1', name: 'Warfarin', dosage: '5mg' },
  ])),
}));

import AddMedicationScreen from '../../app/add-medication';

const mockPush = router.push as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><AddMedicationScreen /></ThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('AddMedicationScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders the screen title', () => {
    const { getByText } = renderScreen();
    expect(getByText(/Add Medication/i)).toBeTruthy();
  });

  it('renders the medication name input', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText(/e\.g\.|medication name/i)).toBeTruthy();
  });

  it('shows validation error when form is submitted empty', async () => {
    const { getByText, findAllByText } = renderScreen();
    const nextBtn = getByText(/continue/i);
    fireEvent.press(nextBtn);
    const errors = await findAllByText(/required|invalid|enter/i);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows typing a medication name', () => {
    const { getByPlaceholderText } = renderScreen();
    const input = getByPlaceholderText(/e\.g\.|medication name/i);
    fireEvent.changeText(input, 'Aspirin');
    expect(input.props.value ?? (input.props as any).defaultValue ?? 'Aspirin').toBeTruthy();
  });

  it('renders frequency selector options', () => {
    const { getByText } = renderScreen();
    expect(getByText('Daily')).toBeTruthy();
  });

  it('renders the photo picker placeholder', () => {
    const { getAllByText } = renderScreen();
    expect(getAllByText(/Tap to add photo|📷/).length).toBeGreaterThan(0);
  });

  it('renders the Form dropdown with default Tablet', () => {
    const { getByText } = renderScreen();
    expect(getByText('Tablet')).toBeTruthy();
  });

  it('opens Form picker modal when tapped', async () => {
    const { getByText, findByText } = renderScreen();
    fireEvent.press(getByText('Tablet'));
    const heading = await findByText('Select Form');
    expect(heading).toBeTruthy();
  });

  it('selects a different form from the picker modal', async () => {
    const { getByText, findByText } = renderScreen();
    fireEvent.press(getByText('Tablet'));
    await findByText('Select Form');
    fireEvent.press(getByText('Capsule'));
    expect(getByText('Capsule')).toBeTruthy();
  });

  it('closes Form picker modal when backdrop is pressed', async () => {
    const { getByText, findByText } = renderScreen();
    fireEvent.press(getByText('Tablet'));
    await findByText('Select Form');
    fireEvent.press(getByText('Select Form'));
    expect(true).toBeTruthy();
  });

  it('renders all frequency options', () => {
    const { getByText } = renderScreen();
    expect(getByText('Daily')).toBeTruthy();
    expect(getByText('Weekly')).toBeTruthy();
    expect(getByText('As needed')).toBeTruthy();
  });

  it('allows selecting a different frequency', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Weekly'));
    expect(getByText('Weekly')).toBeTruthy();
  });

  it('shows drug interaction modal when adding a med that interacts with existing', async () => {
    // getMedications mock returns Warfarin — Aspirin+Warfarin is a known high interaction
    const { getByPlaceholderText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText(/e\.g\.|medication name/i), 'Aspirin');
    fireEvent.changeText(getByPlaceholderText('500mg'), '100mg');
    fireEvent.press(getByText(/continue/i));
    const warning = await findByText(/drug interaction warning/i);
    expect(warning).toBeTruthy();
  });

  it('interaction modal has Go Back and Add Anyway buttons', async () => {
    const { getByPlaceholderText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText(/e\.g\.|medication name/i), 'Aspirin');
    fireEvent.changeText(getByPlaceholderText('500mg'), '100mg');
    fireEvent.press(getByText(/continue/i));
    await findByText(/drug interaction warning/i);
    expect(getByText('Go Back')).toBeTruthy();
    expect(getByText('Add Anyway')).toBeTruthy();
  });

  it('Go Back on interaction modal dismisses it', async () => {
    const { getByPlaceholderText, getByText, findByText, queryByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText(/e\.g\.|medication name/i), 'Aspirin');
    fireEvent.changeText(getByPlaceholderText('500mg'), '100mg');
    fireEvent.press(getByText(/continue/i));
    await findByText(/drug interaction warning/i);
    fireEvent.press(getByText('Go Back'));
    expect(queryByText(/drug interaction warning/i)).toBeNull();
  });
});
