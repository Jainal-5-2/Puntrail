import { router } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDb, listCemeteries, searchBurials } from '@/lib/db';
import type { BurialSearchResult, CachedCemetery } from '@/types';

const DEBOUNCE_MS = 300;

const SearchResultRow = memo(
  ({
    item,
    onPress,
    colors,
  }: {
    item: BurialSearchResult;
    onPress: (item: BurialSearchResult) => void;
    colors: typeof Colors.light;
  }) => (
    <Pressable
      onPress={() => onPress(item)}
      android_ripple={{ color: colors.backgroundSelected }}
      style={({ pressed }) => [
        styles.result,
        {
          backgroundColor: pressed ? colors.backgroundSelected : colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}>
      <View style={styles.resultHeader}>
        <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
          {item.full_name}
        </Text>
        <View style={[styles.badge, { backgroundColor: colors.background }]}>
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
            {item.plot_identifier}
          </Text>
        </View>
      </View>
      {item.date_of_burial ? (
        <Text style={[styles.resultMeta, { color: colors.textSecondary }]}>
          Buried: {item.date_of_burial}
        </Text>
      ) : null}
    </Pressable>
  ),
);

export default function SearchScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const [cemetery, setCemetery] = useState<CachedCemetery | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BurialSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDb();
        const cemeteries = await listCemeteries(db);
        if (cancelled) return;
        if (cemeteries.length === 0) {
          setBootError(
            'No cemetery data is available on this device yet. Connect to the internet and download data first.',
          );
        } else {
          setCemetery(cemeteries[0]);
        }
      } catch (error) {
        if (!cancelled) {
          setBootError(
            error instanceof Error ? error.message : 'Failed to open the local database.',
          );
        }
      } finally {
        if (!cancelled) setIsBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(
    async (text: string) => {
      if (!cemetery) return;
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setResults([]);
        setSearchError(null);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      setSearchError(null);
      try {
        const db = await getDb();
        const rows = await searchBurials(db, cemetery.id, trimmed);
        setResults(rows);
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : 'Search failed. Please try again.',
        );
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [cemetery],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, runSearch]);

  const handleSelect = useCallback((result: BurialSearchResult) => {
    router.push({
      pathname: '/map',
      params: { plotId: result.plot_id, burialId: result.burial_id },
    });
  }, []);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  if (isBooting) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (bootError) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background }]}
        edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Cannot search</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{bootError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}>
      <View style={styles.headerContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            enterKeyHint="search"
          />
          {isSearching ? (
            <ActivityIndicator
              size="small"
              color={colors.textSecondary}
              style={styles.rightIcon}
            />
          ) : query.length > 0 ? (
            <Pressable
              onPress={handleClear}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.rightIcon}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Searching in: {cemetery?.name ?? ''}
        </Text>
      </View>

      {searchError ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor:
                scheme === 'dark' ? 'rgba(248, 81, 73, 0.12)' : 'rgba(207, 34, 46, 0.08)',
              borderColor: colors.danger,
            },
          ]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{searchError}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.burial_id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={30}
        initialNumToRender={8}
        ListEmptyComponent={
          query.trim().length > 0 && !isSearching ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches found</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Try adjusting the spelling or using a partial name.
              </Text>
            </View>
          ) : query.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Find a burial</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Enter a name above to locate the resting place.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <SearchResultRow item={item} onPress={handleSelect} colors={colors} />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  errorTitle: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  errorText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  headerContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four, // Added breathing room below the status bar
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    minHeight: 48, 
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  rightIcon: {
    paddingLeft: Spacing.two,
    paddingVertical: Spacing.two,
    minWidth: 48, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, paddingHorizontal: Spacing.one },
  errorBanner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.six,
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#888',
  },
  result: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    gap: Spacing.one,
    overflow: 'hidden',
    minHeight: 48, 
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: { fontSize: 16, fontWeight: '600', flex: 1 },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
    marginLeft: Spacing.two,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  resultMeta: { fontSize: 13, lineHeight: 18 },
});