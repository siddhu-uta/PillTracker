import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  sendEmailVerification: jest.fn(),
}));

import SignUpScreen from '../../app/signup';

const mockCreate   = createUserWithEmailAndPassword as jest.Mock;
const mockUpdate   = updateProfile as jest.Mock;
const mockVerify   = sendEmailVerification as jest.Mock;
const mockReplace  = router.replace as jest.Mock;

function renderSignup() {
  return render(
    <ThemeProvider>
      <SignUpScreen />
    </ThemeProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('SignUpScreen', () => {
  it('renders name, email, and password fields', () => {
    const { getByPlaceholderText } = renderSignup();
    expect(getByPlaceholderText('Jane Doe')).toBeTruthy();
    expect(getByPlaceholderText('jane@email.com')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders the Sign Up button', () => {
    const { getByText } = renderSignup();
    expect(getByText('Sign Up')).toBeTruthy();
  });

  it('shows alert when fields are empty', async () => {
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByText } = renderSignup();
    fireEvent.press(getByText('Sign Up'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Missing fields', expect.any(String));
    });
  });

  it('shows alert when password is too short', async () => {
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = renderSignup();
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane');
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'jane@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), '123');
    fireEvent.press(getByText('Sign Up'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Weak password', expect.any(String));
    });
  });

  it('creates account and sends verification email on valid input', async () => {
    const mockUser = { uid: 'new-uid', email: 'jane@test.com' };
    mockCreate.mockResolvedValueOnce({ user: mockUser });
    mockUpdate.mockResolvedValueOnce(undefined);
    mockVerify.mockResolvedValueOnce(undefined);
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });

    const { getByPlaceholderText, getByText } = renderSignup();
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane Doe');
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'jane@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    fireEvent.press(getByText('Sign Up'));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(expect.anything(), 'jane@test.com', 'password123');
      expect(mockVerify).toHaveBeenCalledWith(mockUser);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('shows error alert on sign up failure', async () => {
    mockCreate.mockRejectedValueOnce({ message: 'Email already in use' });
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByPlaceholderText, getByText } = renderSignup();
    fireEvent.changeText(getByPlaceholderText('Jane Doe'), 'Jane');
    fireEvent.changeText(getByPlaceholderText('jane@email.com'), 'taken@test.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
    fireEvent.press(getByText('Sign Up'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Sign up failed', 'Email already in use');
    });
  });

  it('renders a link to login screen', () => {
    const { getByText } = renderSignup();
    expect(getByText('Already have an account? Log in')).toBeTruthy();
  });
});
