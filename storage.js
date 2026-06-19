import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@bikebinder_motorcycles';

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

export async function deleteMotorcycle(id) {
  const bikes = await loadMotorcycles();
  const filtered = bikes.filter((b) => b.id !== id);
  await saveMotorcycles(filtered);
}
