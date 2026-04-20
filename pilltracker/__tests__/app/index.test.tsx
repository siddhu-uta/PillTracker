import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../firebase/config', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({}));
jest.mock('../../firebase/medications', () => ({}));

import WelcomeScreen from '../../app/index';

function renderScreen() {
  return render(<WelcomeScreen />);
}

describe('WelcomeScreen', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderScreen();
    expect(toJSON()).toBeTruthy();
  });

  it('renders app name PillTracker', () => {
    const { getByText } = renderScreen();
    expect(getByText('PillTracker')).toBeTruthy();
  });

  it('renders the tagline', () => {
    const { getByText } = renderScreen();
    expect(getByText('Never miss a dose again')).toBeTruthy();
  });

  it('renders the Get Started button', () => {
    const { getByText } = renderScreen();
    expect(getByText(/get started/i)).toBeTruthy();
  });

  it('renders the Log in link', () => {
    const { getByText } = renderScreen();
    expect(getByText(/log in/i)).toBeTruthy();
  });
});
