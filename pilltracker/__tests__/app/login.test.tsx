import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
}));

import LoginScreen from '../../app/login';

const mockSignIn = signInWithEmailAndPassword as jest.Mock;
const mockReplace = router.replace as jest.Mock;

function renderLogin() {
  return render(
    <ThemeProvider>
      <LoginScreen />
    </ThemeProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('LoginScreen', () => {
  it('renders email and password inputs', () => {
    const { getByPlaceholderText } = renderLogin();
    expect(getByPlaceholderText('jane@email.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders the Sign In button', () => {
    const { getByText } = renderLogin();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('renders a link to sign up', () => {
    const { getByText } = renderLogin();
    expect(getByText("Don't have an account? Sign up")).toBeTruthy();
  });

  it('renders a forgot password link', () => {
    const { getByText } = renderLogin();
    expect(getByText('Forgot password?')).toBeTruthy();
  });

  it('shows an alert when fields are empty', async () => {
    const { getByText } = renderLogin();
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Missing fields', expect.any(String));
    });
  });

  it('calls signInWithEmailAndPassword with entered credentials', async () => {
    mockSignIn.mockResolvedValueOnce({ user: { uid: 'u1' } });
    const { getByPlaceholderText, getByText } = renderLogin();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'test@email.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(expect.anything(), 'test@email.com', 'password123');
    });
  });

  it('navigates to dashboard on successful login', async () => {
    mockSignIn.mockResolvedValueOnce({ user: { uid: 'u1' } });
    const { getByPlaceholderText, getByText } = renderLogin();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'test@email.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows an alert on failed login', async () => {
    mockSignIn.mockRejectedValueOnce({ message: 'Invalid credentials' });
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = renderLogin();
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'bad@email.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'wrongpass');
    fireEvent.press(getByText('Sign In'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Login failed', 'Invalid credentials');
    });
  });
});
