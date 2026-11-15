import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_RIDE_KEY = '@bikebinder_pending_ride';
const TRACKER_STATE_KEY = '@bikebinder_tracker_state';
const LOCATION_TASK = 'bikebinder-background-location';

const NOTIFICATION = {
  notificationTitle: 'BikeBinder is tracking your ride',
  notificationBody: 'GPS mileage tracking is on.',
};

const MONITORING_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: 5000,
  distanceInterval: 5,
  showsBackgroundLocationIndicator: true,
  foregroundService: NOTIFICATION,
};

const TRACKING_OPTIONS = {
  accuracy: Location.Accuracy.Highest,
  timeInterval: 1000,
  distanceInterval: 0,
  showsBackgroundLocationIndicator: true,
  foregroundService: NOTIFICATION,
};

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
  gpsPointCount: 0,
  lastLocation: null,
  lastLocationTime: null,
  totalMeters: 0,
  rideStartTime: null,
  highSpeedStartMs: null,   // epoch when speed first exceeded 10 mph
  lowSpeedStartMs: null,    // epoch when speed dropped below 10 mph
  onStatusChange: null,
  gpsLog: [],               // debug log of every point
};

let hydrationPromise = null;
let locationQueue = Promise.resolve();

// Only serializable ride data is stored; callbacks/debug logs never go in storage.
async function hydrateState() {
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      try {
        const saved = await AsyncStorage.getItem(TRACKER_STATE_KEY);
        if (saved) {
          const restored = JSON.parse(saved);
          if (['idle', 'monitoring', 'tracking'].includes(restored.status)) {
            Object.assign(state, {
              status: restored.status,
              lastLocation: restored.lastLocation || null,
              lastLocationTime: restored.lastLocationTime || null,
              totalMeters: Number(restored.totalMeters) || 0,
              rideStartTime: restored.rideStartTime || null,
              highSpeedStartMs: restored.highSpeedStartMs || null,
              lowSpeedStartMs: restored.lowSpeedStartMs || null,
              gpsPointCount: Number(restored.gpsPointCount) || 0,
            });
          }
        }
      } catch (error) {
        console.error('BikeBinder: unable to restore ride state', error);
      }
    })();
  }
  await hydrationPromise;
}

async function persistState() {
  const {
    status, lastLocation, lastLocationTime, totalMeters, rideStartTime,
    highSpeedStartMs, lowSpeedStartMs, gpsPointCount,
  } = state;
  await AsyncStorage.setItem(TRACKER_STATE_KEY, JSON.stringify({
    status, lastLocation, lastLocationTime, totalMeters, rideStartTime,
    highSpeedStartMs, lowSpeedStartMs, gpsPointCount,
  }));
}

// The background runtime may deliver several fixes together. Serialize them
// so one update cannot overwrite a later fix in AsyncStorage.
function queueLocation(loc) {
  const next = locationQueue.catch((error) => {
    console.error('BikeBinder: previous location update failed', error);
  }).then(async () => {
    await hydrateState();
    if (state.status === 'idle') return;
    await handleLocation(loc);
    await persistState();
  });
  locationQueue = next;
  return next;
}

// Task definitions must execute when the JS bundle starts, not when a screen mounts.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('BikeBinder background location error:', error);
    return;
  }
  for (const location of data?.locations || []) {
    await queueLocation(location);
  }
});

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
      totalPoints: state.gpsPointCount,
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
    const dt = ((loc.timestamp || Date.now()) - prevTime) / 1000;
    if (dt > 0 && dist > 3) return (dist / dt) * 2.23694;
  }
  return 0;
}

// ─── GPS jump filter ───────────────────────────────────────────

function isGpsJump(newPos, oldPos, sinceMs, nowMs) {
  if (!oldPos) return false;
  const d = haversineDistance(oldPos, newPos);
  const dt = (nowMs - sinceMs) / 1000;
  return d > 100 && dt <= 1.5;   // >100m in ≤1.5 s → spike
}

// ─── Location handler ──────────────────────────────────────────

async function handleLocation(loc) {
  const now = loc.timestamp || Date.now();
  const { latitude, longitude } = loc.coords;
  const pos = { latitude, longitude };

  // ── compute speed ──
  const speedMph = calcSpeedMph(loc, state.lastLocation, state.lastLocationTime);
  const speedMs = speedMph / 2.23694;

  // ── log every point ──
  state.gpsPointCount += 1;
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
      if (isGpsJump(pos, state.lastLocation, state.lastLocationTime, now)) {
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
          // Persist the newly detected ride before restarting the native task.
          await persistState();
          await upgradeTrackingFrequency();
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
      if (isGpsJump(pos, state.lastLocation, state.lastLocationTime, now)) {
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
          await finishTracking('timeout');
          return;
        }
      }
      emit();
      break;
  }
}

// ── Upgrade to 1‑2 s updates once ride starts ──
async function upgradeTrackingFrequency() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK, TRACKING_OPTIONS);
}

// ─── Public API ─────────────────────────────────────────────────

export async function startMonitoring() {
  await hydrateState();
  await locationQueue.catch((error) => console.error('BikeBinder location queue', error));

  if (!(await TaskManager.isAvailableAsync())) {
    throw new Error('Background GPS requires an installed Android build, not Expo Go.');
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') throw new Error('Location permission required');

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new Error('Select Allow all the time in BikeBinder location settings to track rides with the screen locked.');
  }

  const { status: services } = await Location.getProviderStatusAsync();
  if (!services.gpsAvailable && !services.networkAvailable) {
    throw new Error('No location provider available');
  }

  // Never register the background task twice. A fresh Start resets the ride.
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  state.status = 'monitoring';
  state.totalMeters = 0;
  state.rideStartTime = null;
  state.lastLocation = null;
  state.lastLocationTime = null;
  state.gpsPointCount = 0;
  clearTimer();
  state.gpsLog = [];
  await persistState();

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, MONITORING_OPTIONS);
  } catch (error) {
    state.status = 'idle';
    await persistState();
    throw error;
  }
  emit({ event: 'monitoring' });
}

async function finishTracking(reason = 'manual') {
  const totalMiles = state.totalMeters / 1609.344;
  const hadRide = state.status === 'tracking' && totalMiles > 0.1;
  const rideId = state.rideStartTime ? String(state.rideStartTime) : String(Date.now());

  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }

  // Save before clearing the checkpoint; an idempotent ride ID prevents a
  // double entry if Android terminates the JS process in between the writes.
  if (hadRide) await savePendingRide(totalMiles, rideId);

  state.status = 'idle';
  state.lastLocation = null;
  state.lastLocationTime = null;
  state.rideStartTime = null;
  clearTimer();
  await persistState();

  if (hadRide) {
    emit({ event: 'ride_ended', miles: totalMiles.toFixed(1), reason });
  } else {
    emit({ event: 'stopped', reason });
  }
}

export async function stopTracking(reason = 'manual') {
  await hydrateState();
  await locationQueue.catch((error) => console.error('BikeBinder location queue', error));
  await finishTracking(reason);
}

export async function getStatus() {
  await hydrateState();
  return {
    status: state.status,
    miles: (state.totalMeters / 1609.344).toFixed(1),
    meters: state.totalMeters,
    duration: state.rideStartTime
      ? Math.floor((Date.now() - state.rideStartTime) / 1000)
      : 0,
    totalPoints: state.gpsPointCount,
  };
}

export function getGpsLog() {
  return [...state.gpsLog];
}

// ─── Pending rides ──────────────────────────────────────────────

export async function savePendingRide(miles, rideId = Date.now().toString()) {
  const existing = await loadPendingRides();
  if (existing.some((ride) => ride.id === rideId)) return;
  existing.push({
    id: rideId,
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
