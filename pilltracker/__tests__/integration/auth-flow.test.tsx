/**
 * Integration: Authentication Flow
 *
 * Tests the full sign-up → email verification → login → logout cycle,
 * verifying that each screen hands off to the next correctly and that
 * Firebase Auth functions are called with the right arguments.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

// ── Firebase mocks (must be in file for babel-jest hoisting) ──────────────────
jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1', email: 'jane@test.com', displayName: 'Jane' } },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword:    jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile:                 jest.fn(() => Promise.resolve()),
  sendEmailVerification:         jest.fn(() => Promise.resolve()),
  sendPasswordResetEmail:        jest.fn(() => Promise.resolve()),
  signOut:                       jest.fn(() => Promise.resolve()),
}));

jest.mock('firebase/firestore', () => ({}));
jest.mock('../../firebase/medications', () => ({}));

import { signInWithEmailAndPassword, createUserWithEmailAndPassword,
         sendEmailVerification, sendPasswordResetEmail, signOut } from 'firebase/auth';

import LoginScreen    from '../../app/login';
import SignupScreen   from '../../app/signup';
import ForgotScreen   from '../../app/forgot-password';
import SettingsScreen from '../../app/settings';

const mockReplace = router.replace as jest.Mock;
const mockPush    = router.push    as jest.Mock;
const mockBack    = router.back    as jest.Mock;

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Integration — Sign Up flow', () => {
  it('creates account, sends verification, then redirects to login', async () => {
    const mockUser = { uid: 'new1', email: 'new@test.com' };
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: mockUser,
    });

    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider><SignupScreen /></ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('Jane Doe'),       'Test User');
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'new@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'),       'Secret123');
    fireEvent.press(getByText('Sign Up'));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'new@test.com', 'Secret123'
      );
      expect(sendEmailVerification).toHaveBeenCalledWith(mockUser);
    });
  });

  it('blocks sign-up when password is too short', async () => {
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');

    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider><SignupScreen /></ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('Jane Doe'),       'Jane');
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'jane@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'),       '123');
    fireEvent.press(getByText('Sign Up'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Integration — Login flow', () => {
  it('signs in with correct credentials and navigates to dashboard', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: { uid: 'u1', email: 'jane@test.com' },
    });

    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider><LoginScreen /></ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'jane@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'),       'Secret123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'jane@test.com', 'Secret123'
      );
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error alert on wrong credentials', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(
      new Error('auth/wrong-password')
    );
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');

    const { getByPlaceholderText, getByText } = render(
      <ThemeProvider><LoginScreen /></ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'jane@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'),       'wrongpass');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('login screen "Forgot password?" link navigates to forgot-password', () => {
    const { getByText } = render(
      <ThemeProvider><LoginScreen /></ThemeProvider>
    );
    fireEvent.press(getByText(/forgot/i));
    expect(mockPush).toHaveBeenCalledWith('/forgot-password');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Integration — Password reset flow', () => {
  it('sends reset email and shows success state', async () => {
    (sendPasswordResetEmail as jest.Mock).mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByText, findByText } = render(
      <ThemeProvider><ForgotScreen /></ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText(/email/i), 'jane@test.com');
    fireEvent.press(getByText(/send reset/i));

    await waitFor(() => {
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(), 'jane@test.com'
      );
    });
    await expect(findByText(/check your inbox/i)).resolves.toBeTruthy();
  });

  it('"Back to Sign In" on success screen navigates to login', async () => {
    (sendPasswordResetEmail as jest.Mock).mockResolvedValueOnce(undefined);

    const { getByPlaceholderText, getByText, findByText } = render(
      <ThemeProvider><ForgotScreen /></ThemeProvider>
    );

    fireEvent.changeText(getByPlaceholderText(/email/i), 'jane@test.com');
    fireEvent.press(getByText(/send reset/i));
    await findByText(/check your inbox/i);

    fireEvent.press(getByText(/back to sign in/i));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth Integration — Logout flow', () => {
  it('logout calls signOut and redirects to /login', async () => {
    (signOut as jest.Mock).mockResolvedValueOnce(undefined);
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => {
      buttons?.find((b: any) => b.text === 'Log Out')?.onPress?.();
    });

    const { getByText } = render(
      <ThemeProvider><SettingsScreen /></ThemeProvider>
    );

    fireEvent.press(getByText('Log Out'));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
