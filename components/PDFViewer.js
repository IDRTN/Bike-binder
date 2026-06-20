import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../theme';

export default function PDFViewer({ visible, fileUri, fileName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (visible && fileUri) {
      openPDF();
    }
  }, [visible, fileUri]);

  const openPDF = async () => {
    try {
      setLoading(true);
      setError(false);
      setErrorMsg('');

      // If it's a web URL, open directly
      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        const supported = await Linking.canOpenURL(fileUri);
        if (supported) {
          await Linking.openURL(fileUri);
          onClose();
        } else {
          setError(true);
          setErrorMsg('Cannot open web URLs on this device.');
        }
        setLoading(false);
        return;
      }

      // Copy file to a cache location for reliable access
      const cacheDir = FileSystem.cacheDirectory + 'pdfs/';
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      const dest = cacheDir + (fileName || 'manual.pdf');

      await FileSystem.copyAsync({ from: fileUri, to: dest });

      // Get a content:// URI that Android can share with PDF viewers
      const contentUri = await FileSystem.getContentUriAsync(dest);

      // Try sharing first (opens system share sheet with PDF viewer options)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(contentUri, {
          mimeType: 'application/pdf',
          dialogTitle: fileName || 'Manual',
        });
        setLoading(false);
        onClose();
        return;
      }

      // Fallback: try opening the content URI directly
      const canOpen = await Linking.canOpenURL(contentUri);
      if (canOpen) {
        await Linking.openURL(contentUri);
        setLoading(false);
        onClose();
        return;
      }

      // Last resort: try with file:// URI
      const canOpenFile = await Linking.canOpenURL(dest);
      if (canOpenFile) {
        await Linking.openURL(dest);
        setLoading(false);
        onClose();
        return;
      }

      setError(true);
      setErrorMsg('No PDF viewer app found on your device.');
      setLoading(false);
    } catch (e) {
      console.log('PDF open error:', e);
      setError(true);
      setErrorMsg(e.message || 'Could not open the PDF file.');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {fileName || 'PDF Viewer'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.bronze} />
              <Text style={styles.loadingText}>Opening PDF...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>Could not open this PDF</Text>
              <Text style={styles.errorSub}>{errorMsg}</Text>
              <Text style={styles.tip}>
                Tip: Install a PDF reader like "Google PDF Viewer" from the Play Store, then try again.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={openPDF}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingTop: 50,
  },
  closeBtn: { width: 60 },
  closeText: { fontSize: 16, color: COLORS.bronze, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 20 },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errorSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 16 },
  tip: { fontSize: 13, color: COLORS.steelLight, textAlign: 'center', paddingHorizontal: 30, lineHeight: 18, fontStyle: 'italic' },
  retryBtn: { marginTop: 20, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
