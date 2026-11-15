import AsyncStorage from '@react-native-async-storage/async-storage';
import { removeVehicleDocumentPhoto } from './utils/vehicleDocumentStorage';

const STORAGE_KEY = '@bikebinder_motorcycles';
const RIDE_BIKE_KEY = '@bikebinder_ride_bike_preference';

// A single preference record preserves the selected bike and the optional lock.
export async function loadRideBikePreference() {
  try {
    const json = await AsyncStorage.getItem(RIDE_BIKE_KEY);
    const pref = json ? JSON.parse(json) : {};
    return { selectedBikeId: pref.selectedBikeId || null, lockedBikeId: pref.lockedBikeId || null };
  } catch {
    return { selectedBikeId: null, lockedBikeId: null };
  }
}

export async function saveRideBikePreference(preference) {
  const selectedBikeId = preference.selectedBikeId || null;
  const lockedBikeId = preference.lockedBikeId || null;
  await AsyncStorage.setItem(RIDE_BIKE_KEY, JSON.stringify({ selectedBikeId, lockedBikeId }));
}


export async function loadMotorcycles() {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

export async function saveMotorcycles(motorcycles) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(motorcycles));
}

export async function addMotorcycle(bike) {
  const bikes = await loadMotorcycles();
  bike.id = Date.now().toString();
  bike.parts = bike.parts || [];
  bike.manuals = bike.manuals || [];
  bike.services = bike.services || [];
  bike.maintenanceItems = bike.maintenanceItems || [];
  bike.insuranceDocuments = bike.insuranceDocuments || [];
  bike.registrationDocuments = bike.registrationDocuments || [];
  bikes.unshift(bike);
  await saveMotorcycles(bikes);
  return bike;
}

export async function updateMotorcycle(updatedBike) {
  const bikes = await loadMotorcycles();
  const idx = bikes.findIndex((b) => b.id === updatedBike.id);
  if (idx !== -1) {
    bikes[idx] = updatedBike;
    await saveMotorcycles(bikes);
  }
  return updatedBike;
}

// Ride IDs are recorded on the bike before the pending record is cleared.
// If Android closes the app between those operations, retrying will not add miles twice.
export async function applyRideMilesToBike(ride, motorcycleId) {
  const miles = Math.round(Number(ride?.miles));
  if (!ride?.id || !Number.isFinite(miles) || miles <= 0) {
    throw new Error('Ride distance is too short to log.');
  }
  const bikes = await loadMotorcycles();
  const index = bikes.findIndex((bike) => bike.id === motorcycleId);
  if (index < 0) throw new Error('That motorcycle is no longer in your garage.');
  const bike = bikes[index];
  if ((bike.appliedRideIds || []).includes(ride.id)) return bike;
  const current = Number.parseInt(bike.mileageCurrent || bike.mileageBought || '0', 10) || 0;
  const updated = {
    ...bike,
    mileageCurrent: String(current + miles),
    appliedRideIds: [...(bike.appliedRideIds || []), ride.id],
  };
  bikes[index] = updated;
  await saveMotorcycles(bikes);
  return updated;
}

export async function deleteMotorcycle(id) {
  const bikes = await loadMotorcycles();
  const removed = bikes.find((b) => b.id === id);
  await saveMotorcycles(bikes.filter((b) => b.id !== id));
  const pref = await loadRideBikePreference();
  if (pref.selectedBikeId === id || pref.lockedBikeId === id) {
    await saveRideBikePreference({
      selectedBikeId: pref.selectedBikeId === id ? null : pref.selectedBikeId,
      lockedBikeId: pref.lockedBikeId === id ? null : pref.lockedBikeId,
    });
  }
  // Delete only copies managed by the private documents folder, not gallery originals.
  for (const document of [...(removed?.insuranceDocuments || []), ...(removed?.registrationDocuments || [])]) {
    try {
      await removeVehicleDocumentPhoto(document.uri);
    } catch (error) {
      console.warn('Unable to remove local vehicle document photo:', error);
    }
  }
}
