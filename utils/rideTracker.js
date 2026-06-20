import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_RIDE_KEY = '@bikebinder_pending_ride';

// Haversine formula to calculate distance between two GPS points in meters
function haversineDistance(coords1, coords2) {
  const R = 6371000; // Earth radius in meters
  const lat1 = (coords1.latitude * Math.PI) / 180;
  const lat2 = (coords2.latitude * Math.PI) / 180;
  const dLat = ((coords2.latitude - coords1.latitude) * Math.PI) / 180;
  const dLon = ((coords2.longitude - coords1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
}

// Track ride state
let state = {
  status: 'idle', // idle | monitoring | tracking | stopping
  watchSubscription: null,
  lastLocation: null,
  lastLocationTime: null,
  totalMeters: 0,
  startTime: null,
  highSpeedStartTime: null, // when speed first exceeded 10mph
  lowSpeedStartTime: null,  // when speed first dropped below 10mph
  onStatusChange: null,
};

export function setStatusCallback(cb) {
  state.onStatusChange = cb;
}

function emitStatus(extra = {}) {
  if (state.onStatusChange) {
    state.onStatusChange({
      status: state.status,
      miles: (state.totalMeters / 1609.344).toFixed(1),
      meters: state.totalMeters,
      duration: state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0,
      ...extra,
    });
  }
}

function getSpeedMph(location, previousLocation, previousTime) {
  // First try the GPS-reported speed
  const { speed } = location.coords;
  if (speed !== null && speed !== -1 && speed > 0) {
    return speed * 2.23694;
  }

  // Fallback: calculate speed from distance between last two positions
  if (previousLocation && previousTime) {
    const dist = haversineDistance(
      { latitude: previousLocation.latitude, longitude: previousLocation.longitude },
      { latitude: location.coords.latitude, longitude: location.coords.longitude }
    );
    const timeSec = (Date.now() - previousTime) / 1000;
    if (timeSec > 0 && dist > 5) {
      const speedMs = dist / timeSec;
      return speedMs * 2.23694; // m/s to mph
    }
  }

  return 0;
}

async function handleLocation(location) {
  const { latitude, longitude } = location.coords;
  const now = Date.now();

  // Get speed using reported GPS or calculated from position change
  const speedMph = getSpeedMph(location, state.lastLocation, state.lastLocationTime);
  const currentPos = { latitude, longitude };

  switch (state.status) {
    case 'idle':
      // Shouldn't get here
      break;

    case 'monitoring':
      if (speedMph > 10) {
        // Speed above 10mph — start or extend the high-speed window
        if (!state.highSpeedStartTime) {
          state.highSpeedStartTime = now;
        } else if (now - state.highSpeedStartTime >= 15000) {
          // 15 seconds above 10mph — start tracking!
          state.status = 'tracking';
          state.startTime = now;
          state.totalMeters = 0;
          state.lastLocation = currentPos;
          state.lastLocationTime = now;
          state.lowSpeedStartTime = null;
          emitStatus({ event: 'ride_started' });
          return;
        }
      } else {
        // Speed dropped — reset high-speed timer
        state.highSpeedStartTime = null;
      }
      // Always update last location for speed calculation
      state.lastLocation = currentPos;
      state.lastLocationTime = now;
      emitStatus();
      break;

    case 'tracking':
      if (speedMph > 10) {
        // Still riding — accumulate distance
        if (state.lastLocation) {
          const dist = haversineDistance(state.lastLocation, currentPos);
          // Only count if more than 5 meters (filter GPS noise)
          if (dist > 5) {
            state.totalMeters += dist;
          }
        }
        state.lastLocation = currentPos;
        state.lastLocationTime = now;
        state.lowSpeedStartTime = null; // reset low-speed timer
        emitStatus();
      } else {
        // Speed dropped below 10mph
        state.lastLocation = currentPos;
        state.lastLocationTime = now;
        if (!state.lowSpeedStartTime) {
          state.lowSpeedStartTime = now;
        } else if (now - state.lowSpeedStartTime >= 300000) {
          // 5 minutes below 10mph — stop tracking
          stopTracking();
          return;
        }
        emitStatus();
      }
      break;
  }
}

export async function startMonitoring() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission required');
  }

  // Reset state
  state.status = 'monitoring';
  state.totalMeters = 0;
  state.startTime = null;
  state.lastLocation = null;
  state.lastLocationTime = null;
  state.highSpeedStartTime = null;
  state.lowSpeedStartTime = null;

  // Start watching position
  state.watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 5000,   // every 5 seconds
      distanceInterval: 5,   // or every 5 meters
    },
    handleLocation
  );

  emitStatus({ event: 'monitoring' });
}

export function stopTracking() {
  const totalMiles = state.totalMeters / 1609.344;

  // Unsubscribe from location updates
  if (state.watchSubscription) {
    state.watchSubscription.remove();
    state.watchSubscription = null;
  }

  const hadRide = state.status === 'tracking' && totalMiles > 0.1;

  state.status = 'idle';
  state.lastLocation = null;
  state.lastLocationTime = null;
  state.highSpeedStartTime = null;
  state.lowSpeedStartTime = null;

  if (hadRide) {
    // Save pending ride
    savePendingRide(totalMiles);
    emitStatus({ event: 'ride_ended', miles: totalMiles.toFixed(1) });
  } else {
    emitStatus({ event: 'stopped' });
  }
}

export function getStatus() {
  return {
    status: state.status,
    miles: (state.totalMeters / 1609.344).toFixed(1),
    duration: state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0,
  };
}

// --- Pending rides stored in AsyncStorage ---

export async function savePendingRide(miles) {
  const existing = await loadPendingRides();
  existing.push({
    id: Date.now().toString(),
    miles: parseFloat(miles.toFixed(1)),
    date: new Date().toISOString(),
    logged: false,
  });
  await AsyncStorage.setItem(PENDING_RIDE_KEY, JSON.stringify(existing));
}

export async function loadPendingRides() {
  try {
    const json = await AsyncStorage.getItem(PENDING_RIDE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function clearPendingRide(id) {
  const rides = await loadPendingRides();
  const filtered = rides.filter((r) => r.id !== id);
  await AsyncStorage.setItem(PENDING_RIDE_KEY, JSON.stringify(filtered));
}

export async function clearAllPendingRides() {
  await AsyncStorage.removeItem(PENDING_RIDE_KEY);
}
