import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { Link } from 'expo-router';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.container}>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>💊</Text>
        </View>
        <Text style={styles.appName}>PillTracker</Text>
        <Text style={styles.tagline}>Your daily medication companion</Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>

        {/* Link component handles navigation type-safely in Expo Router */}
        <Link href={"/signup" as any} asChild>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        </Link>

        <Link href={"/login" as any} asChild>
          <TouchableOpacity>
            <Text style={styles.loginText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </Link>

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: { fontSize: 48 },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  tagline: { fontSize: 16, color: '#666' },
  buttonContainer: {
    gap: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loginText: { color: '#666', fontSize: 15 },
});