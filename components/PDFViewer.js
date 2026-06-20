import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../theme';

export default function PDFViewer({ visible, fileUri, fileName, onClose }) {
  const [base64Data, setBase64Data] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (visible && fileUri) {
      loadPDF();
    }
  }, [visible, fileUri]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(false);

      // Check if it's already a web URL
      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        setBase64Data(fileUri);
        setLoading(false);
        return;
      }

      // Read local file as base64
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setBase64Data(`data:application/pdf;base64,${base64}`);
      setLoading(false);
    } catch (e) {
      console.log('PDF load error:', e);
      setError(true);
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.bronze} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Could not load this PDF</Text>
          <Text style={styles.errorSub}>The file may be damaged or in an unsupported format.</Text>
        </View>
      );
    }

    // Render PDF via WebView with Google Docs viewer or direct embed
    const pdfHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
        <style>
          * { margin: 0; padding: 0; }
          body { background: #525659; display: flex; justify-content: center; }
          embed, iframe { width: 100%; height: 100vh; border: none; }
        </style>
      </head>
      <body>
        <embed src="${base64Data}" type="application/pdf" width="100%" height="100%">
      </body>
      </html>
    `;

    return (
      <WebView
        style={styles.webview}
        source={{ html: pdfHtml }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.bronze} />
          </View>
        )}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {fileName || 'PDF Viewer'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
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
  webview: { flex: 1, backgroundColor: '#525659' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errorSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
