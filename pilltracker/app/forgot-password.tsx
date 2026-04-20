import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useRef, useEffect } from 'react';
import { auth } from '../firebase/config';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useTheme } from '../utils/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Missing email', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.View
          style={[s.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <Text style={s.logo}>🔑</Text>
          <Text style={s.title}>Reset Password</Text>

          {sent ? (
            <View style={s.successCard}>
              <Text style={s.successIcon}>✉️</Text>
              <Text style={s.successTitle}>Check your inbox</Text>
              <Text style={s.successBody}>
                We sent a password reset link to{'\n'}
                <Text style={s.successEmail}>{email}</Text>
              </Text>
              <Text style={s.successHint}>
                Didn't receive it? Check your spam folder or try again.
              </Text>
              <TouchableOpacity style={s.primaryButton} onPress={() => router.replace('/login' as any)}>
                <Text style={s.primaryButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSent(false)}>
                <Text style={s.linkText}>Resend email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={s.subtitle}>
                Enter the email address associated with your account and we'll send you a link to reset your password.
              </Text>

              <Text style={s.label}>Email Address</Text>
              <TextInput
                style={s.input}
                placeholder="jane@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[s.primaryButton, loading && { opacity: 0.6 }]}
                onPress={handleSend}
                disabled={loading}
              >
                <Text style={s.primaryButtonText}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()}>
                <Text style={s.linkText}>Remember your password? Sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:         { flex: 1, backgroundColor: c.background },
  inner:             { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  backBtn:           { position: 'absolute', top: 16, left: 0 },
  backBtnText:       { fontSize: 16, color: c.textSecondary, fontWeight: '600' },
  logo:              { fontSize: 48, textAlign: 'center', marginBottom: 4 },
  title:             { fontSize: 28, fontWeight: 'bold', color: c.text, marginBottom: 4 },
  subtitle:          { fontSize: 14, color: c.textSecondary, lineHeight: 21, marginBottom: 8 },
  label:             { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 14, fontSize: 16, marginBottom: 8, backgroundColor: c.inputBg, color: c.text,
  },
  primaryButton:     { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  primaryButtonText: { color: c.primaryText, fontSize: 17, fontWeight: '600' },
  linkText:          { textAlign: 'center', color: c.textSecondary, marginTop: 8, fontSize: 14 },

  // Success state
  successCard:  { gap: 12, alignItems: 'center', paddingTop: 16 },
  successIcon:  { fontSize: 52 },
  successTitle: { fontSize: 22, fontWeight: 'bold', color: c.text },
  successBody:  { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
  successEmail: { fontWeight: '700', color: c.text },
  successHint:  { fontSize: 13, color: c.textMuted, textAlign: 'center', lineHeight: 19 },
});
