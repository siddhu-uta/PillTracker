import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@pilltracker_theme';

// ─── Color Palettes ───────────────────────────────────────────────────────────

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  error: string;
  success: string;
  warning: string;
  inputBg: string;
  inputBorder: string;
  skeleton: string;
  navBg: string;
  chip: string;
  chipText: string;
  overlay: string;
}

const LIGHT: ThemeColors = {
  background:   '#f9f9f9',
  surface:      '#ffffff',
  card:         '#ffffff',
  text:         '#1a1a1a',
  textSecondary:'#666666',
  textMuted:    '#999999',
  border:       '#dddddd',
  primary:      '#1a1a1a',
  primaryText:  '#ffffff',
  error:        '#ef4444',
  success:      '#22c55e',
  warning:      '#f59e0b',
  inputBg:      '#fafafa',
  inputBorder:  '#dddddd',
  skeleton:     '#e5e7eb',
  navBg:        '#ffffff',
  chip:         '#fafafa',
  chipText:     '#555555',
  overlay:      'rgba(0,0,0,0.35)',
};

const DARK: ThemeColors = {
  background:   '#0f0f0f',
  surface:      '#1c1c1e',
  card:         '#2c2c2e',
  text:         '#f5f5f5',
  textSecondary:'#a0a0a0',
  textMuted:    '#666666',
  border:       '#3a3a3c',
  primary:      '#f5f5f5',
  primaryText:  '#0f0f0f',
  error:        '#ff5b5b',
  success:      '#34d058',
  warning:      '#fbbf24',
  inputBg:      '#2c2c2e',
  inputBorder:  '#3a3a3c',
  skeleton:     '#3a3a3c',
  navBg:        '#1c1c1e',
  chip:         '#3a3a3c',
  chipText:     '#d1d1d1',
  overlay:      'rgba(0,0,0,0.6)',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: LIGHT,
  toggleTheme: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? DARK : LIGHT, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTheme = () => useContext(ThemeContext);
