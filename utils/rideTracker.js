import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_RIDE_KEY = '@bikebinder_pending_ride';

// ─── Helpers ────────────────────────────────────────────────────

function haversineDistance(c1, c2) {
  const R = 6371000;
  const lat1 = (c1.latitude * Math.PI) / 180;
  const lat2 = (c2.latitude * Math.PI) / 180;
  const dLat = ((c2.latitude - c1.latitude) * Math.PI) / 180;
  const dLon = ((c2.longitude - c1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── State ──────────────────────────────────────────────────────

let state = {
  status: 'idle',           // idle → monitoring → tracking → idle
  watchSubscription: null,
  lastLocation: null,
  lastLocationTime: null,
  totalMeters: 0,
  rideStartTime: null,
  highSpeedStartMs: null,   // epoch when speed first exceeded 10 mph
  lowSpeedStartMs: null,    // epoch when speed dropped below 10 mph
  onStatusChange: null,
  gpsLog: [],               // debug log of every point
};

export function setStatusCallback(cb) {
  state.onStatusChange = cb;
}

function emit(extra = {}) {
  if (state.onStatusChange) {
    state.onStatusChange({
      status: state.status,
      miles: (state.totalMeters / 1609.344).toFixed(1),
      meters: state.totalMeters,
      duration: state.rideStartTime
        ? Math.floor((Date.now() - state.rideStartTime) / 1000)
        : 0,
      totalPoints: state.gpsLog.length,
      ...extra,
    });
  }
}

function clearTimer() {
  state.highSpeedStartMs = null;
  state.lowSpeedStartMs = null;
}

// ─── Speed: prefer GPS, fall back to position delta ────────────

function calcSpeedMph(loc, prevLoc, prevTime) {
  const s = loc.coords.speed;
  if (s !== null && s !== -1 && s > 0) return s * 2.23694;

  if (prevLoc && prevTime) {
    const dist = haversineDistance(
      { latitude: prevLoc.latitude, longitude: prevLoc.longitude },
      { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
    );
    const dt = (Date.now() - prevTime) / 1000;
    if (dt > 0 && dist > 3) return (dist / dt) * 2.23694;
  }
  return 0;
}

// ─── GPS jump filter ───────────────────────────────────────────

function isGpsJump(newPos, oldPos, sinceMs) {
  if (!oldPos) return false;
  const d = haversineDistance(oldPos, newPos);
  const dt = (Date.now() - sinceMs) / 1000;
  return d > 100 && dt <= 1.5;   // >100m in ≤1.5 s → spike
}

// ─── Location handler ──────────────────────────────────────────

async function handleLocation(loc) {
  const now = Date.now();
  const { latitude, longitude } = loc.coords;
  const pos = { latitude, longitude };

  // ── compute speed ──
  const speedMph = calcSpeedMph(loc, state.lastLocation, state.lastLocationTime);
  const speedMs = speedMph / 2.23694;

  // ── log every point ──
  state.gpsLog.push({
    ts: new Date().toISOString(),
    lat: latitude,
    lon: longitude,
    speed: state.status === 'tracking' ? speedMph.toFixed(1) : speedMph.toFixed(1),
    cumulativeMiles: (state.totalMeters / 1609.344).toFixed(3),
  });
  // Keep last 5000 entries to avoid memory leak
  if (state.gpsLog.length > 5000) state.gpsLog.splice(0, 1000);

  switch (state.status) {
    case 'idle':
      break;

    // ── MONITORING ── waiting for ride to start ──
    case 'monitoring':
      // Filter GPS jumps during monitoring too
      if (isGpsJump(pos, state.lastLocation, state.lastLocationTime)) {
        state.lastLocation = pos;
        state.lastLocationTime = now;
        emit({ event: 'gps_jump_filtered' });
        break;
      }

      if (speedMph > 10) {
        if (!state.highSpeedStartMs) {
          state.highSpeedStartMs = now;
        } else if (now - state.highSpeedStartMs >= 15000) {
          // 15 s above 10 mph → start ride
          state.status = 'tracking';
          state.rideStartTime = now;
          state.totalMeters = 0;
          state.lastLocation = pos;
          state.lastLocationTime = now;
          clearTimer();
          // Switch to high-frequency updates
          upgradeTrackingFrequency();
          emit({ event: 'ride_started' });
          return;
        }
      } else {
        state.highSpeedStartMs = null;
      }
      state.lastLocation = pos;
      state.lastLocationTime = now;
      emit();
      break;

    // ── TRACKING ── ride is active ──
    case 'tracking':
      // Filter GPS jumps (spikes while riding)
      if (isGpsJump(pos, state.lastLocation, state.lastLocationTime)) {
        state.lastLocation = pos;
        state.lastLocationTime = now;
        emit({ event: 'gps_jump_filtered' });
        break;
      }

      // Accumulate distance from previous valid point
      if (state.lastLocation) {
        const dist = haversineDistance(state.lastLocation, pos);
        if (dist > 3) state.totalMeters += dist;   // filter static noise
      }
      state.lastLocation = pos;
      state.lastLocationTime = now;

      // Stop timer logic
      if (speedMph > 10) {
        state.lowSpeedStartMs = null;
      } else {
        if (!state.lowSpeedStartMs) {
          state.lowSpeedStartMs = now;
        } else if (now - state.lowSpeedStartMs >= 300000) {
          // 5 minutes below 10 mph → end ride
          stopTracking('timeout');
          return;
        }
      }
      emit();
      break;
  }
}

// ── Upgrade to 1‑2 s updates once ride starts ──
async function upgradeTrackingFrequency() {
  if (state.watchSubscription) state.watchSubscription.remove();

  state.watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Highest,
      timeInterval: 1000,
      distanceInterval: 0,        // every position
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
    },
    handleLocation,
  );
}

// ─── Public API ─────────────────────────────────────────────────

export async function startMonitoring() {
  // Request permissions
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Location permission required');

  // Also request background for screen-off tracking
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    // non-fatal — tracking continues while app is visible
  }

  const { status: services } = await Location.getProviderStatusAsync();
  if (!services.gpsAvailable && !services.networkAvailable) {
    throw new Error('No location provider available');
  }

  // Reset
  state.status = 'monitoring';
  state.totalMeters = 0;
  state.rideStartTime = null;
  state.lastLocation = null;
  state.lastLocationTime = null;
  clearTimer();
  state.gpsLog = [];

  // Start with battery-friendly 5 s interval
  state.watchSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 5,
      activityType: Location.ActivityType.Fitness,
    },
    handleLocation,
  );

  emit({ event: 'monitoring' });
}

export function stopTracking(reason) {
  const totalMiles = state.totalMeters / 1609.344;

  if (state.watchSubscription) {
    state.watchSubscription.remove();
    state.watchSubscription = null;
  }

  const hadRide = state.status === 'tracking' && totalMiles > 0.1;
  state.status = 'idle';
  state.lastLocation = null;
  state.lastLocationTime = null;
  clearTimer();

  if (hadRide) {
    savePendingRide(totalMiles);
    emit({ event: 'ride_ended', miles: totalMiles.toFixed(1), reason });
  } else {
    emit({ event: 'stopped', reason });
  }
}

export function getStatus() {
  return {
    status: state.status,
    miles: (state.totalMeters / 1609.344).toFixed(1),
    duration: state.rideStartTime
      ? Math.floor((Date.now() - state.rideStartTime) / 1000)
      : 0,
    totalPoints: state.gpsLog.length,
  };
}

export function getGpsLog() {
  return [...state.gpsLog];
}

// ─── Pending rides ──────────────────────────────────────────────

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
  await AsyncStorage.setItem(
    PENDING_RIDE_KEY,
    JSON.stringify(rides.filter((r) => r.id !== id)),
  );
}

export async function clearAllPendingRides() {
  await AsyncStorage.removeItem(PENDING_RIDE_KEY);
}
