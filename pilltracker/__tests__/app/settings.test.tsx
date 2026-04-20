import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';
import { ThemeProvider } from '../../utils/theme';

jest.mock('../../firebase/config', () => ({
  auth: { currentUser: { uid: 'u1', email: 'test@test.com', displayName: 'Test User' } },
  db: {},
}));

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../firebase/medications', () => ({}));

import SettingsScreen from '../../app/settings';

const mockSignOut = signOut as jest.Mock;
const mockReplace = router.replace as jest.Mock;
const mockBack    = router.back as jest.Mock;

function renderScreen() {
  return render(<ThemeProvider><SettingsScreen /></ThemeProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('SettingsScreen', () => {
  it('renders the Settings title', () => {
    const { getByText } = renderScreen();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('renders the Dark Mode toggle', () => {
    const { getByText } = renderScreen();
    expect(getByText('Dark Mode')).toBeTruthy();
  });

  it('renders the notification settings section', () => {
    const { getByText } = renderScreen();
    expect(getByText('Notification Permissions')).toBeTruthy();
  });

  it('renders the Log Out button', () => {
    const { getByText } = renderScreen();
    expect(getByText('Log Out')).toBeTruthy();
  });

  it('pressing Back calls router.back()', () => {
    const { getByText } = renderScreen();
    fireEvent.press(getByText('← Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('pressing Log Out shows confirmation alert', async () => {
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert');
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Log Out'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Log Out', expect.any(String), expect.any(Array));
    });
  });

  it('confirms logout — calls signOut and navigates to login', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const Alert = require('react-native').Alert;
    jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _msg, buttons) => {
      const logoutBtn = buttons?.find((b: any) => b.text === 'Log Out');
      logoutBtn?.onPress?.();
    });
    const { getByText } = renderScreen();
    fireEvent.press(getByText('Log Out'));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
