import { Link, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { downloadCemeteryData } from '@/lib/sync/download';
import { downloadOfflineMap, getOfflineMapStatus } from '@/lib/map/offline';
import { getDb, listCemeteries } from '@/lib/db';
import { useAuth } from '@/stores/auth';
import { useNetwork } from '@/stores/network';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const { role } = useAuth();
  const { isInternetReachable } = useNetwork();
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingMap, setIsDownloadingMap] = useState(false);
  const [hasOfflineMap, setHasOfflineMap] = useState(false);
  const [cemeteryId, setCemeteryId] = useState<string | null>(null);

  const hasDownloadedOnLaunch = useRef(false);

  // Load local data status
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const cemeteries = await listCemeteries(db);
      if (cemeteries.length > 0) {
        setCemeteryId(cemeteries[0].id);
        const status = await getOfflineMapStatus(cemeteries[0].id);
        setHasOfflineMap(status);
      }
    })();
  }, [isDownloadingMap]);

  // Auto-download when network becomes available
  useEffect(() => {
    if (!isInternetReachable) return;

    if (!hasDownloadedOnLaunch.current) {
      hasDownloadedOnLaunch.current = true;
      void handleSilentDownload();
      return;
    }

    // Optional: If you want it to re-download every time the network drops and comes back,
    // you can remove the `hasDownloadedOnLaunch` check above. For now, it only does it once per launch.
  }, [isInternetReachable]);

  async function handleSilentDownload() {
    try {
      await downloadCemeteryData();
    } catch (error) {
      console.warn('Background sync failed:', error);
    }
  }

  async function handleDownload() {
    if (!isInternetReachable) {
      Alert.alert('Offline', 'You need an internet connection to download data.');
      return;
    }
    
    setIsDownloading(true);
    try {
      await downloadCemeteryData();
      // Refresh local ID if it was the first download
      const db = await getDb();
      const cemeteries = await listCemeteries(db);
      if (cemeteries.length > 0) setCemeteryId(cemeteries[0].id);
      
      Alert.alert('Success', 'Cemetery data downloaded and cached locally.');
    } catch (error) {
      Alert.alert('Download failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadMap() {
    if (!cemeteryId) {
      Alert.alert('No Data', 'Download cemetery data first.');
      return;
    }
    
    setIsDownloadingMap(true);
    try {
      await downloadOfflineMap(cemeteryId);
      Alert.alert('Success', 'Offline map downloaded. You can now view the map without internet.');
    } catch (error) {
      Alert.alert('Map Download failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsDownloadingMap(false);
    }
  }

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
            <View style={styles.statusRow}>
               <View style={[styles.statusDot, { backgroundColor: isInternetReachable ? colors.success : colors.warning }]} />
               <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                 {isInternetReachable ? 'Online - Data will sync automatically' : 'Offline - Showing cached data'}
               </Text>
            </View>
          </View>

          {role === 'admin' && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>Admin Session Active</Text>
              <Link href="/admin" asChild>
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                      borderColor: colors.primary,
                      borderWidth: 2,
                    },
                  ]}>
                  <Text style={[styles.cardTitle, { color: colors.primary }]}>Return to Dashboard</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                    Go back to the admin management panel
                  </Text>
                </Pressable>
              </Link>
            </View>
          )}

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
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>System (Dev)</Text>
            <Pressable
              onPress={handleDownload}
              disabled={isDownloading}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}>
              {isDownloading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.cardTitle, { color: colors.primary }]}>
                  Force Download Data
                </Text>
              )}
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Fetch latest records from Supabase
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDownloadMap}
              disabled={isDownloadingMap || !cemeteryId}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
                  borderColor: colors.border,
                  opacity: cemeteryId ? 1 : 0.5,
                },
              ]}>
              {isDownloadingMap ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.cardTitle, { color: colors.primary }]}>
                  {hasOfflineMap ? 'Re-download Offline Map' : 'Download Offline Map'}
                </Text>
              )}
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                Cache map tiles for offline use
              </Text>
            </Pressable>
          </View>

          {role !== 'admin' && (
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
          )}

          <Text style={[styles.footer, { color: colors.textSecondary }]}>
            Map data © MapTiler / OpenStreetMap contributors
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.five,
  },
  hero: { gap: Spacing.two, paddingTop: Spacing.five },
  title: { fontSize: 40, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: 16, lineHeight: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13 },
  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.one },
  card: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, lineHeight: 18 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 'auto', paddingTop: Spacing.four },
});