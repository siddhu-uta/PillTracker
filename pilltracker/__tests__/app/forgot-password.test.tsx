import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

import ForgotPasswordScreen from '../../app/forgot-password';

const mockSendReset = sendPasswordResetEmail as jest.Mock;
const mockBack      = router.back as jest.Mock;
const mockReplace   = router.replace as jest.Mock;

function renderScreen() {
  return render(
    <ThemeProvider>
      <ForgotPasswordScreen />
    </ThemeProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('ForgotPasswordScreen', () => {
  it('renders the email input', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText('jane@email.com')).toBeTruthy();
  });

  it('renders the Send Reset Link button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Send Reset Link')).toBeTruthy();
  });

  it('renders the back button', () => {
    const { getByText } = renderScreen();
    expect(getByText('← Back')).toBeTruthy();
  });

  it('pressing Back calls router.back()', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('← Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('shows alert when email is empty', async () => {
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Send Reset Link'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Missing email', expect.any(String));
    });
  });

  it('calls sendPasswordResetEmail with entered email', async () => {
    mockSendReset.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));
    await waitFor(() => {
      expect(mockSendReset).toHaveBeenCalledWith(expect.anything(), 'user@test.com');
    });
  });

  it('shows success state after sending reset email', async () => {
    mockSendReset.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));
    await findByText('Check your inbox');
    expect(getByText('Back to Sign In')).toBeTruthy();
  });

  it('navigates to login when Back to Sign In is pressed', async () => {
    mockSendReset.mockResolvedValueOnce(undefined);
    const { getByPlaceholderText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));
    await findByText('Check your inbox');
    fireEvent.press(getByText('Back to Sign In'));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('allows resending — tapping Resend goes back to form', async () => {
    mockSendReset.mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText, findByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'user@test.com');
    fireEvent.press(getByText('Send Reset Link'));
    await findByText('Check your inbox');
    fireEvent.press(getByText('Resend email'));
    await waitFor(() => {
      expect(getByText('Send Reset Link')).toBeTruthy();
    });
  });

  it('shows error alert when sendPasswordResetEmail fails', async () => {
    mockSendReset.mockRejectedValueOnce({ message: 'User not found' });
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = renderScreen();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'ghost@test.com');
    fireEvent.press(getByText('Send Reset Link'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'User not found');
    });
  });
});
