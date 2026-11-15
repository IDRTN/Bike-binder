import ReactNativeBlobUtil from 'react-native-blob-util';
import * as ImagePicker from 'expo-image-picker';

const DOCUMENT_DIR = ReactNativeBlobUtil.fs.dirs.DocumentDir + '/vehicle-documents';

// Store copies in app-owned, persistent storage, not the ImagePicker cache.
// No insurance, registration, or photo is uploaded to a server.
async function ensureDirectory() {
  if (!(await ReactNativeBlobUtil.fs.exists(DOCUMENT_DIR))) {
    await ReactNativeBlobUtil.fs.mkdir(DOCUMENT_DIR);
  }
}

function extensionFor(asset) {
  const name = (asset.fileName || asset.uri || '').toLowerCase();
  if (asset.mimeType === 'image/png' || /\.png(?:\?|$)/.test(name)) return 'png';
  if (asset.mimeType === 'image/webp' || /\.webp(?:\?|$)/.test(name)) return 'webp';
  return 'jpg';
}

export async function pickVehicleDocumentPhoto(source) {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access to photograph the document.');
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], quality: 1, allowsEditing: false,
    });
    return result.canceled ? null : result.assets?.[0] || null;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to select a saved document.');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'], quality: 1, allowsEditing: false,
    allowsMultipleSelection: false,
  });
  return result.canceled ? null : result.assets?.[0] || null;
}

export async function saveVehicleDocumentPhoto(asset, motorcycleId, type) {
  if (!asset?.uri || !['insurance', 'registration'].includes(type)) {
    throw new Error('No valid document photo was selected.');
  }
  await ensureDirectory();
  const id = String(motorcycleId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = [id, type, Date.now(), Math.random().toString(36).slice(2, 10)].join('_')
    + '.' + extensionFor(asset);
  const target = DOCUMENT_DIR + '/' + filename;
  try {
    await ReactNativeBlobUtil.fs.cp(asset.uri, target);
    if (!(await ReactNativeBlobUtil.fs.exists(target))) {
      throw new Error('The selected image could not be saved.');
    }
    return { id: filename, uri: 'file://' + target, addedAt: new Date().toISOString() };
  } catch (error) {
    if (await ReactNativeBlobUtil.fs.exists(target)) {
      await ReactNativeBlobUtil.fs.unlink(target);
    }
    throw error;
  }
}

export async function removeVehicleDocumentPhoto(uri) {
  if (typeof uri !== 'string') return;
  const path = uri.replace(/^file:\/\//, '');
  // Never delete an image outside BikeBinder's dedicated document folder.
  if (!path.startsWith(DOCUMENT_DIR + '/')) return;
  if (await ReactNativeBlobUtil.fs.exists(path)) {
    await ReactNativeBlobUtil.fs.unlink(path);
  }
}
