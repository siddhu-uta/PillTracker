import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform, ScrollView, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { auth } from '../firebase/config';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useTheme } from '../utils/theme';

export default function SignUpScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);

  const [fullName, setFullName] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSignUp = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: fullName });
      router.replace('/dashboard' as any);
    } catch (error: any) {
      Alert.alert('Sign up failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Animated.ScrollView
          contentContainerStyle={s.scroll}
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <Text style={s.logo}>💊</Text>
          <Text style={s.title}>Create Account</Text>
          <Text style={s.subtitle}>Start tracking your medications today</Text>

          <Text style={s.label}>Full Name</Text>
          <TextInput
            style={s.input}
            placeholder="Jane Doe"
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <Text style={s.label}>Email</Text>
          <TextInput
            style={s.input}
            placeholder="jane@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={s.label}>Password</Text>
          <TextInput
            style={s.input}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[s.primaryButton, loading && { opacity: 0.6 }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={s.primaryButtonText}>{loading ? 'Creating account...' : 'Sign Up'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/login' as any)}>
            <Text style={s.linkText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container:         { flex: 1, backgroundColor: c.background },
  scroll:            { padding: 24, gap: 12, flexGrow: 1, justifyContent: 'center' },
  logo:              { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title:             { fontSize: 28, fontWeight: 'bold', color: c.text, marginBottom: 4 },
  subtitle:          { fontSize: 15, color: c.textSecondary, marginBottom: 16 },
  label:             { fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: c.inputBorder, borderRadius: 10,
    padding: 14, fontSize: 16, marginBottom: 8, backgroundColor: c.inputBg, color: c.text,
  },
  primaryButton:     { backgroundColor: c.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: c.primaryText, fontSize: 17, fontWeight: '600' },
  linkText:          { textAlign: 'center', color: c.textSecondary, marginTop: 8, fontSize: 14 },
});
