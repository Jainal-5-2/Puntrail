import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={[styles.title, { color: colors.text }]}>Puntrail</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Cemetery mapping and burial information for Isabela City, Basilan
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Visitor</Text>

            <Link href="/search" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Find a burial</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Search by name and view the plot on the map
                </Text>
              </Pressable>
            </Link>

            <Link href="/map" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>View cemetery map</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Explore the mapped cemetery and plots
                </Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Administrator</Text>

            <Link href="/admin/login" asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Admin sign in</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  Manage cemeteries, plots, and burial records
                </Text>
              </Pressable>
            </Link>
          </View>

          <Text style={[styles.footer, { color: colors.textSecondary }]}>
            Map data © MapTiler / OpenStreetMap contributors
          </Text>
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
  hero: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
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
    fontSize: 11,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: Spacing.four,
  },
});