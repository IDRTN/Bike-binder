import ReactNativeBlobUtil from 'react-native-blob-util';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────

const MANUALS_DIR = 'manuals/';
const DOCUMENT_DIR = ReactNativeBlobUtil.fs.dirs.DocumentDir;
const MANUALS_PATH = `${DOCUMENT_DIR}/${MANUALS_DIR}`;

// ─── Debug logging ──────────────────────────────────────────────

function log(...args) {
  console.log('[PDFStorage]', ...args);
}

// ─── Permission helpers ─────────────────────────────────────────

export async function requestMediaPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Access to photos is needed to attach images.');
    return false;
  }
  return true;
}

// ─── Directory management ───────────────────────────────────────

/**
 * Ensure the manuals directory exists. Creates it if needed.
 */
export async function ensureManualsDir() {
  const exists = await ReactNativeBlobUtil.fs.exists(MANUALS_PATH);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(MANUALS_PATH);
    log('Created manuals directory:', MANUALS_PATH);
  }
  return MANUALS_PATH;
}

// ─── File operations ────────────────────────────────────────────

/**
 * Copy a file to permanent application storage using react-native-blob-util.
 *
 * @param {string} sourceUri - The original URI (content:// or file://).
 * @param {string} fileName  - The file name to save as.
 * @returns {Promise<string>} The permanent absolute file path.
 */
export async function copyToPermanentStorage(sourceUri, fileName) {
  await ensureManualsDir();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = `${MANUALS_PATH}${safeName}`;

  log('Original URI:', sourceUri);
  log('Copy destination:', destPath);

  // Remove if already exists
  const exists = await ReactNativeBlobUtil.fs.exists(destPath);
  if (exists) {
    await ReactNativeBlobUtil.fs.unlink(destPath);
    log('Removed existing file at destination');
  }

  // Copy the file using react-native-blob-util
  // This handles content:// URIs properly on Android
  await ReactNativeBlobUtil.fs.cp(sourceUri, destPath);

  // Verify the copy
  const copiedExists = await ReactNativeBlobUtil.fs.exists(destPath);
  if (!copiedExists) {
    throw new Error(`File copy failed — destination does not exist: ${destPath}`);
  }

  log('Copied successfully to:', destPath);
  return destPath;  // ⬅ Returns plain absolute path (no file:// prefix)
}

/**
 * Delete a file from permanent storage.
 */
export async function deleteFile(filePath) {
  if (!filePath) return;
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(filePath);
    if (exists) {
      await ReactNativeBlobUtil.fs.unlink(filePath);
      log('Deleted:', filePath);
    }
  } catch (err) {
    console.warn('[PDFStorage] Delete failed:', filePath, err);
  }
}

/**
 * Get the file path suitable for react-native-pdf.
 * Returns the absolute path without any file:// prefix.
 */
export async function getLocalFilePath(fileUri) {
  if (!fileUri) return null;

  // If it's already a plain path (not a URI scheme), use directly
  if (!fileUri.includes('://')) {
    return fileUri;
  }

  // If it's an expo-file-system URI or content:// URI,
  // check if it was already copied to permanent storage
  if (fileUri.startsWith('file://')) {
    // Extract the path from file:// URI
    const path = fileUri.replace(/^file:\/\//, '');
    const exists = await ReactNativeBlobUtil.fs.exists(path);
    if (exists) {
      log('Using existing file:', path);
      return path;
    }
  }

  // If it's a content:// URI (original DocumentPicker URI), try to copy
  if (fileUri.startsWith('content://')) {
    log('Content URI detected — needs copy to permanent storage');
    const fileName = `manual_${Date.now()}.pdf`;
    const path = await copyToPermanentStorage(fileUri, fileName);
    log('Copied content:// URI to permanent storage:', path);
    return path;
  }

  // Fallback: try the URI as-is
  return fileUri;
}

/**
 * Check if a URI points to an image.
 */
export function isImageFile(uri) {
  if (!uri) return false;
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(uri);
}

/**
 * Check if a URI points to a PDF.
 */
export function isPDFFile(uri) {
  if (!uri) return false;
  return /\.pdf$/i.test(uri);
}

// ─── Pickers ────────────────────────────────────────────────────

/**
 * Pick a PDF and copy it to permanent storage immediately.
 * @returns {Promise<{path: string, name: string} | null>}
 */
export async function pickAndStorePDF() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  log('Picker returned URI:', asset.uri);
  log('Picker returned name:', asset.name);

  // Copy to permanent storage immediately
  const permPath = await copyToPermanentStorage(asset.uri, asset.name);

  log('Final permanent path for storage:', permPath);

  return { path: permPath, name: asset.name };
}

/**
 * Pick an image and copy it to permanent storage.
 * @returns {Promise<{path: string, name: string} | null>}
 */
export async function pickAndStoreImage() {
  if (!(await requestMediaPermission())) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.7,
    allowsEditing: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const fileName = asset.fileName || `photo_${Date.now()}.jpg`;

  log('Image picker returned URI:', asset.uri);

  const permPath = await copyToPermanentStorage(asset.uri, fileName);

  return { path: permPath, name: fileName };
}

/**
 * List all files in the manuals directory.
 */
export async function listStoredFiles() {
  try {
    await ensureManualsDir();
    return await ReactNativeBlobUtil.fs.ls(MANUALS_PATH);
  } catch {
    return [];
  }
}
