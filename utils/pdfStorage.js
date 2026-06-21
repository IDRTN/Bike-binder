import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────

// Permanent storage directory (survives app restarts)
const PDF_STORAGE_DIR = FileSystem.documentDirectory + 'manuals/';

// Supported file types
const PDF_MIME = 'application/pdf';
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

// ─── Permission helpers ─────────────────────────────────────────

export async function requestMediaPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Permission Required',
      'Bike Binder needs access to your photos to attach images to manuals.'
    );
    return false;
  }
  return true;
}

// ─── File operations ────────────────────────────────────────────

/**
 * Ensure the manuals storage directory exists.
 */
export async function ensureStorageDir() {
  await FileSystem.makeDirectoryAsync(PDF_STORAGE_DIR, { intermediates: true });
}

/**
 * Copy a file from a source URI to permanent app storage.
 * @param {string} sourceUri - The temporary URI from DocumentPicker or ImagePicker.
 * @param {string} fileName - The original file name to preserve.
 * @returns {Promise<string>} The permanent URI of the copied file.
 */
export async function copyToPermanentStorage(sourceUri, fileName) {
  await ensureStorageDir();
  const dest = PDF_STORAGE_DIR + sanitizeFileName(fileName || `manual_${Date.now()}.pdf`);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

/**
 * Sanitize a file name to remove path separators and special characters.
 */
function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Pick a PDF document from the device.
 * @returns {Promise<{uri: string, name: string} | null>}
 */
export async function pickPDF() {
  const result = await DocumentPicker.getDocumentAsync({
    type: PDF_MIME,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  try {
    const permUri = await copyToPermanentStorage(asset.uri, asset.name);
    return { uri: permUri, name: asset.name };
  } catch (err) {
    // Fallback to temp URI if copy fails
    console.warn('PDF copy failed, using temp URI:', err);
    return { uri: asset.uri, name: asset.name };
  }
}

/**
 * Pick an image from the device.
 * @returns {Promise<{uri: string, name: string} | null>}
 */
export async function pickImage() {
  if (!(await requestMediaPermission())) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const fileName = asset.fileName || `photo_${Date.now()}.jpg`;

  try {
    const permUri = await copyToPermanentStorage(asset.uri, fileName);
    return { uri: permUri, name: fileName };
  } catch (err) {
    console.warn('Image copy failed, using temp URI:', err);
    return { uri: asset.uri, name: fileName };
  }
}

/**
 * Delete a PDF file from permanent storage.
 * @param {string} fileUri - The URI of the file to delete.
 */
export async function deleteFile(fileUri) {
  if (!fileUri) return;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (err) {
    console.warn('Failed to delete file:', fileUri, err);
  }
}

/**
 * Get a content:// URI suitable for WebView access.
 * @param {string} fileUri - The file:// URI.
 * @returns {Promise<string>} A content:// URI.
 */
export async function getContentUri(fileUri) {
  try {
    return await FileSystem.getContentUriAsync(fileUri);
  } catch {
    // Fallback to original URI
    return fileUri;
  }
}

/**
 * Check if a URI points to an image file.
 */
export function isImageFile(uri) {
  if (!uri) return false;
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(uri);
}

/**
 * Check if a URI points to a PDF file.
 */
export function isPDFFile(uri) {
  if (!uri) return false;
  return /\.pdf$/i.test(uri);
}

/**
 * List all stored manual files for debugging.
 */
export async function listStoredFiles() {
  try {
    await ensureStorageDir();
    const files = await FileSystem.readDirectoryAsync(PDF_STORAGE_DIR);
    return files;
  } catch {
    return [];
  }
}
