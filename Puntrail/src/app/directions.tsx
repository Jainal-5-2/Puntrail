import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import Geolocation, {
  type GeolocationResponse,
} from '@react-native-community/geolocation';
import { Magnetometer } from 'expo-sensors';
import polyline from '@mapbox/polyline';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useNetwork } from '@/stores/network';

const MAP_STYLE = process.env.EXPO_PUBLIC_MAPTILER_STYLE_URL;
const OSRM_BASE_URL = 'https://router.project-osrm.org';

// Accept coarse fixes — Infinix reports 25-40m often.
const ACCURACY_THRESHOLD_M = 60;
// Re-fetch route only after moving this far from the last origin.
const ROUTE_REFETCH_DISTANCE_M = 25;

type SimpleLocation = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
  };
};

type PermissionState = 'checking' | 'granted' | 'denied' | 'blocked';

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCompassDirection(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(heading / 45) % 8];
}

function decodeToGeoJson(encoded: string): [number, number][] {
  const decoded = polyline.decode(encoded);
  return decoded.map(([lat, lng]) => [lng, lat] as [number, number]);
}

function toSimpleLocation(pos: GeolocationResponse): SimpleLocation {
  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
      heading:
        typeof pos.coords.heading === 'number' &&
        !Number.isNaN(pos.coords.heading)
          ? pos.coords.heading
          : null,
    },
  };
}

export default function DirectionsScreen() {
  const { destLng, destLat, plotIdentifier } = useLocalSearchParams<{
    destLng: string;
    destLat: string;
    plotIdentifier: string;
  }>();

  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { isInternetReachable } = useNetwork();

  const cameraRef = useRef<CameraRef>(null);
  const lastRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const isFetchingRouteRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [userLocation, setUserLocation] = useState<SimpleLocation | null>(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [isLocating, setIsLocating] = useState(true);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [geoJsonKey, setGeoJsonKey] = useState(0);
  const [fixErrorCount, setFixErrorCount] = useState(0);
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);

  const destLngNum = parseFloat(destLng || '0');
  const destLatNum = parseFloat(destLat || '0');

  const fetchRoute = useCallback(
    async (startLng: number, startLat: number) => {
      if (!isInternetReachable) return;
      if (isFetchingRouteRef.current) return;

      isFetchingRouteRef.current = true;
      setIsFetchingRoute(true);

      try {
        const url =
          `${OSRM_BASE_URL}/route/v1/driving/` +
          `${startLng},${startLat};${destLngNum},${destLatNum}` +
          `?overview=full&geometries=polyline`;

        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        const route = data?.routes?.[0];
        if (!route) {
          setRouteGeometry([]);
          setRouteDistance(null);
          return;
        }

        const coords = decodeToGeoJson(route.geometry);
        if (coords.length >= 2) {
          setRouteGeometry(coords);
          setRouteDistance(typeof route.distance === 'number' ? route.distance : null);
          setGeoJsonKey((k) => k + 1);
          lastRouteOriginRef.current = { lat: startLat, lng: startLng };
        }
      } catch (error) {
        console.warn('OSRM routing failed:', error);
      } finally {
        isFetchingRouteRef.current = false;
        setIsFetchingRoute(false);
      }
    },
    [destLatNum, destLngNum, isInternetReachable],
  );

  // Handle each incoming geolocation fix. Accepts every fix that passes the
  // accuracy check — no dead-band, no filtering. The dot follows raw position.
  const handlePosition = useCallback(
    (next: SimpleLocation) => {
      const accuracy = next.coords.accuracy;
      if (accuracy != null && accuracy > ACCURACY_THRESHOLD_M) {
        setFixErrorCount((c) => c + 1);
        return;
      }

      setUserLocation(next);
      setIsLocating(false);
      setFixErrorCount(0);
      setLastFixAt(Date.now());

      const lastOrigin = lastRouteOriginRef.current;
      if (
        !lastOrigin ||
        haversineMeters(
          lastOrigin.lat,
          lastOrigin.lng,
          next.coords.latitude,
          next.coords.longitude,
        ) > ROUTE_REFETCH_DISTANCE_M
      ) {
        void fetchRoute(next.coords.longitude, next.coords.latitude);
      }
    },
    [fetchRoute],
  );

  const stopLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      Geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startLocation = useCallback(() => {
    setIsLocating(true);
    setFixErrorCount(0);

    // IMPORTANT: use 'auto' (not 'android'). On the Infinix, the native
    // LocationManager alone returns nothing; 'auto' lets the library pick
    // whichever provider actually delivers fixes.
    Geolocation.setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
      locationProvider: 'auto',
    });

    watchIdRef.current = Geolocation.watchPosition(
      (position) => {
        if (!isMountedRef.current) return;
        handlePosition(toSimpleLocation(position));
      },
      (error) => {
        if (!isMountedRef.current) return;
        console.warn('Geolocation error:', error);
        setFixErrorCount((c) => c + 1);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: false, // less battery, more likely to deliver on poor GPS
        distanceFilter: 0, // deliver every fix; JS decides what to draw
        interval: 1000,
        fastestInterval: 500,
      },
    );
  }, [handlePosition]);

  // Compass from magnetometer — independent of GPS.
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    const startCompass = async () => {
      const available = await Magnetometer.isAvailableAsync();
      if (!available) {
        console.warn('Magnetometer not available');
        return;
      }
      Magnetometer.setUpdateInterval(200);
      sub = Magnetometer.addListener(({ x, y }) => {
        if (!isMountedRef.current) return;
        let angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = (angle + 360) % 360;
        setCompassHeading(angle);
      });
    };

    void startCompass();
    return () => {
      sub?.remove();
    };
  }, []);

  // Permission + start
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Puntrail needs your location to give directions.',
            buttonPositive: 'Allow',
          },
        );
        if (cancelled) return;
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setPermissionState('denied');
          setIsLocating(false);
          return;
        }
      } else {
        Geolocation.requestAuthorization();
      }

      if (cancelled) return;
      setPermissionState('granted');
      startLocation();
    };

    void init();

    return () => {
      cancelled = true;
      stopLocation();
    };
  }, [startLocation, stopLocation]);

  // Re-check permission after returning from Settings.
  useEffect(() => {
    if (permissionState !== 'denied') return;

    const sub = require('react-native').AppState.addEventListener(
      'change',
      async (next: string) => {
        if (next !== 'active') return;
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (granted) {
            setPermissionState('granted');
            startLocation();
          }
        }
      },
    );

    return () => sub.remove();
  }, [permissionState, startLocation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const displayGeometry: [number, number][] =
    routeGeometry.length > 0
      ? routeGeometry
      : userLocation
      ? [
          [userLocation.coords.longitude, userLocation.coords.latitude],
          [destLngNum, destLatNum],
        ]
      : [];

  const hasRealRoute = routeGeometry.length > 0;

  const directionsGeojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      ...(displayGeometry.length >= 2
        ? [
            {
              type: 'Feature' as const,
              properties: { type: 'line', isReal: hasRealRoute },
              geometry: { type: 'LineString' as const, coordinates: displayGeometry },
            },
          ]
        : []),
      {
        type: 'Feature' as const,
        properties: { type: 'dest' },
        geometry: { type: 'Point' as const, coordinates: [destLngNum, destLatNum] },
      },
      ...(userLocation
        ? [
            {
              type: 'Feature' as const,
              properties: { type: 'user' },
              geometry: {
                type: 'Point' as const,
                coordinates: [
                  userLocation.coords.longitude,
                  userLocation.coords.latitude,
                ],
              },
            },
          ]
        : []),
    ],
  };

  const headingText = getCompassDirection(compassHeading);
  const secondsSinceFix =
    lastFixAt !== null ? Math.round((Date.now() - lastFixAt) / 1000) : null;

  if (!MAP_STYLE) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>
          EXPO_PUBLIC_MAPTILER_STYLE_URL missing in .env
        </Text>
      </View>
    );
  }

  if (permissionState === 'denied') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Location permission needed
        </Text>
        <Text style={[styles.permissionBody, { color: colors.textSecondary }]}>
          We need access to your location to give turn-by-turn directions.
        </Text>
        <Pressable
          onPress={() => {
            if (Platform.OS === 'ios') void Linking.openURL('app-settings:');
            else void Linking.openSettings();
          }}
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.permissionButtonText}>Open Settings</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.permissionBackButton}>
          <Text style={[styles.permissionBackText, { color: colors.textSecondary }]}>
            {'<'} Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={MAP_STYLE}>
        <Camera ref={cameraRef} trackUserLocation="default" zoom={17} />

        <GeoJSONSource
          key={`directions-${geoJsonKey}`}
          id="directions"
          data={directionsGeojson}
        >
          <Layer
            type="line"
            id="route-line-real"
            filter={['all', ['==', ['get', 'type'], 'line'], ['==', ['get', 'isReal'], true]]}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#2F81F7', 'line-width': 5 }}
          />
          <Layer
            type="line"
            id="route-line-fallback"
            filter={['all', ['==', ['get', 'type'], 'line'], ['==', ['get', 'isReal'], false]]}
            paint={{
              'line-color': '#F85149',
              'line-width': 4,
              'line-dasharray': [2, 2],
            }}
          />
          <Layer
            type="circle"
            id="dest-point"
            filter={['==', ['get', 'type'], 'dest']}
            paint={{
              'circle-radius': 10,
              'circle-color': '#F85149',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#fff',
            }}
          />
          <Layer
            type="circle"
            id="user-dot"
            filter={['==', ['get', 'type'], 'user']}
            paint={{
              'circle-radius': 8,
              'circle-color': '#2F81F7',
              'circle-stroke-width': 3,
              'circle-stroke-color': '#fff',
            }}
          />
        </GeoJSONSource>
      </Map>

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
        >
          <Text style={[styles.backText, { color: colors.text }]}>{'<'} Back</Text>
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} edges={['bottom']} pointerEvents="box-none">
        <View style={[styles.infoCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          {!isInternetReachable && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>Offline: Showing straight-line estimate</Text>
            </View>
          )}

          <View style={styles.infoHeader}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Destination</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {plotIdentifier || 'Unknown Plot'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {isLocating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {fixErrorCount > 0
                  ? `Searching for GPS… (${fixErrorCount} weak fixes)`
                  : 'Waiting for GPS signal…'}
              </Text>
            </View>
          ) : routeDistance !== null ? (
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {routeDistance < 1000
                    ? `${Math.round(routeDistance)} m`
                    : `${(routeDistance / 1000).toFixed(2)} km`}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              <View style={styles.stat}>
                <View
                  style={[
                    styles.compassArrow,
                    {
                      borderBottomColor: colors.primary,
                      transform: [{ rotate: `${compassHeading}deg` }],
                    },
                  ]}
                />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {headingText}
                </Text>
              </View>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {secondsSinceFix !== null ? `${secondsSinceFix}s` : '—'}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last fix</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
              {isFetchingRoute
                ? 'Calculating route…'
                : 'Move outside for a better GPS signal.'}
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  backText: { fontSize: 14, fontWeight: '600' },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  infoCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 18, fontWeight: '700' },
  divider: { height: 1, marginVertical: Spacing.two },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  loadingText: { fontSize: 14, fontStyle: 'italic' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: Spacing.one,
    minHeight: 40,
    justifyContent: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: { width: 1, height: 40 },
  offlineText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  offlineBanner: {
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    padding: Spacing.two,
    borderRadius: Radius.md,
    marginBottom: Spacing.two,
  },
  compassArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  permissionTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permissionBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.four,
  },
  permissionButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
  },
  permissionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  permissionBackButton: { marginTop: Spacing.two, paddingVertical: Spacing.two },
  permissionBackText: { fontSize: 14, fontWeight: '600' },
});