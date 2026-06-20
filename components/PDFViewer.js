import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../theme';

export default function PDFViewer({ visible, fileUri, fileName, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  React.useEffect(() => {
    if (visible && fileUri) {
      openPDF();
    }
  }, [visible, fileUri]);

  const openPDF = async () => {
    try {
      setLoading(true);
      setError(false);

      // If it's a web URL, open directly
      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        const supported = await Linking.canOpenURL(fileUri);
        if (supported) {
          await Linking.openURL(fileUri);
        } else {
          setError(true);
        }
        setLoading(false);
        return;
      }

      // For local files, copy to a permanent cache location and share/open
      const cacheDir = FileSystem.cacheDirectory + 'pdfs/';
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      const dest = cacheDir + (fileName || 'manual.pdf');

      // Copy file to cache
      await FileSystem.copyAsync({ from: fileUri, to: dest });

      // Try sharing/open with system PDF viewer
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: 'application/pdf',
          dialogTitle: fileName || 'Manual',
        });
      } else {
        // Fallback: try to open directly
        const supported = await Linking.canOpenURL(dest);
        if (supported) {
          await Linking.openURL(dest);
        } else {
          setError(true);
        }
      }

      setLoading(false);
      // Close the modal since we're opening externally
      onClose();
    } catch (e) {
      console.log('PDF open error:', e);
      setError(true);
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
              <Text style={styles.errorSub}>
                Your device may not have a PDF viewer installed.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={openPDF}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.successText}>PDF should be opening...</Text>
            </View>
          )}
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
  errorSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  successText: { fontSize: 16, color: COLORS.green },
  retryBtn: { marginTop: 20, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
