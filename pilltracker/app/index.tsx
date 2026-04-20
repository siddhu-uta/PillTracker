import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Animated,
} from 'react-native';
import { Link } from 'expo-router';

const FEATURES = [
  { icon: '🔔', label: 'Smart Reminders' },
  { icon: '📊', label: 'Track Adherence' },
  { icon: '💊', label: 'Manage Meds' },
];

export default function WelcomeScreen() {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Branding ── */}
        <View style={styles.brandSection}>
          <View style={styles.logoWrapper}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>💊</Text>
            </View>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>Rx</Text>
            </View>
          </View>

          <Text style={styles.appName}>PillTracker</Text>
          <Text style={styles.tagline}>Never miss a dose again</Text>

          {/* Feature pills */}
          <View style={styles.featureRow}>
            {FEATURES.map(f => (
              <View key={f.label} style={styles.featurePill}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={styles.ctaSection}>
          <Link href={'/signup' as any} asChild>
            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Get Started  →</Text>
            </TouchableOpacity>
          </Link>

          <Link href={'/login' as any} asChild>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Already have an account? <Text style={styles.loginLink}>Log in</Text></Text>
            </TouchableOpacity>
          </Link>

          <Text style={styles.disclaimer}>
            Free to use · Secure · Works offline
          </Text>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  inner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 48,
  },

  // ── Branding
  brandSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  logoWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 32,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1a1a1a',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoIcon: { fontSize: 52 },
  logoBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fafafa',
  },
  logoBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -1,
    marginTop: 4,
  },
  tagline: {
    fontSize: 17,
    color: '#666',
    fontWeight: '400',
    letterSpacing: 0.2,
  },

  featureRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featureIcon: { fontSize: 14 },
  featureLabel: { fontSize: 13, fontWeight: '600', color: '#444' },

  // ── CTA
  ctaSection: {
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 17,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#1a1a1a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 15,
  },
  loginLink: {
    color: '#1a1a1a',
    fontWeight: '700',
  },
  disclaimer: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});
