import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/stores/auth';

export default function AdminLoginScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const { signIn, isSigningIn, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInputInstance>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSigningIn;

  async function handleSubmit() {
    if (!canSubmit) return;
    const ok = await signIn(email.trim(), password);
    if (ok) {
      router.replace('/admin');
    }
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Admin sign in</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Authorized cemetery personnel only
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}
                value={email}
                onChangeText={(text) => {
                  if (error) clearError();
                  setEmail(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                enterKeyHint="next"
                returnKeyType="next"
                editable={!isSigningIn}
                placeholder="admin@example.com"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={() => passwordRef.current?.focus()}
                submitBehavior="submit"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
              <TextInput
                ref={passwordRef}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}
                value={password}
                onChangeText={(text) => {
                  if (error) clearError();
                  setPassword(text);
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                enterKeyHint="go"
                returnKeyType="go"
                editable={!isSigningIn}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={handleSubmit}
              />
            </View>

            {error ? (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor:
                      scheme === 'dark' ? 'rgba(248, 81, 73, 0.12)' : 'rgba(207, 34, 46, 0.08)',
                    borderColor: colors.danger,
                  },
                ]}>
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              android_ripple={{ color: colors.primaryText, borderless: false }}
              style={({ pressed }) => [
                styles.submit,
                {
                  backgroundColor: canSubmit ? colors.primary : colors.backgroundSelected,
                  opacity: pressed && !canSubmit ? 0.7 : 1,
                },
              ]}>
              {isSigningIn ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text
                  style={[
                    styles.submitText,
                    { color: canSubmit ? colors.primaryText : colors.textSecondary },
                  ]}>
                  Sign in
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => router.back()}
              android_ripple={{ color: colors.border, borderless: true }}
              hitSlop={Spacing.two}
              style={styles.backButton}>
              <Text style={[styles.backText, { color: colors.primary }]}>Return to home</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.five,
  },
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    minHeight: 48,
  },
  errorBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  submit: {
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: Spacing.five,
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
  },
});