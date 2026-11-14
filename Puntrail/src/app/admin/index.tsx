import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/stores/auth';

export default function AdminDashboardScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { displayName, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Admin dashboard</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {displayName ? `Signed in as ${displayName}` : 'Signed in'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Manage</Text>

            <Pressable
              onPress={() => router.push('/admin/cemeteries')}
              android_ripple={{ color: colors.backgroundSelected }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Cemeteries</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                View, add, and edit cemetery records
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/admin/plots')}
              android_ripple={{ color: colors.backgroundSelected }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Plots</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Draw and verify burial plot polygons on the map
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/admin/burials')}
              android_ripple={{ color: colors.backgroundSelected }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Burials</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Create, update, and verify burial records
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>System</Text>

            <Pressable
              onPress={() => router.push('/admin/sync')}
              android_ripple={{ color: colors.backgroundSelected }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Sync status</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                View pending changes and resolve conflicts
              </Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleSignOut}
              android_ripple={{ color: colors.border, borderless: true }}
              hitSlop={Spacing.two}
              style={styles.signOutButton}>
              <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
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
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
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
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.one,
  },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: Spacing.five,
    alignItems: 'center',
  },
  signOutButton: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});