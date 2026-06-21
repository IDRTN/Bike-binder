import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS } from '../theme';

export default function PDFViewer({ visible, fileUri, fileName, onClose }) {
  const [source, setSource] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    if (visible && fileUri) {
      loadPDF();
    } else {
      setSource(null);
    }
  }, [visible, fileUri]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(false);

      let uri = fileUri;

      // If web URL, use directly
      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        setSource({ uri });
        setLoading(false);
        return;
      }

      // Copy to cache for reliable access
      const cacheDir = FileSystem.cacheDirectory + 'pdfs/';
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      const dest = cacheDir + (fileName || 'manual.pdf');
      await FileSystem.copyAsync({ from: fileUri, to: dest });

      // Get content:// URI for WebView access
      const contentUri = await FileSystem.getContentUriAsync(dest);
      setSource({ uri: contentUri });
      setLoading(false);
    } catch (e) {
      console.log('PDF load error:', e);
      // Fallback: try direct file URI
      if (source?.uri) {
        setError(true);
        setErrorMsg(e.message || 'Could not load PDF');
      } else {
        // Last ditch - try the original fileUri
        setSource({ uri: fileUri });
        setLoading(false);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{fileName || 'PDF Viewer'}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.content}>
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={COLORS.bronze} />
              <Text style={s.loadTxt}>Loading PDF...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text style={s.errIcon}>⚠️</Text>
              <Text style={s.errTitle}>Could not open PDF</Text>
              <Text style={s.errSub}>{errorMsg}</Text>
              <TouchableOpacity style={s.retry} onPress={loadPDF}>
                <Text style={s.retryTxt}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : source ? (
            <WebView
              style={s.webview}
              source={source}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowFileAccessFromFileURLs
              mixedContentMode="always"
              originWhitelist={['*']}
              startInLoadingState
              renderLoading={() => (
                <View style={s.overlay}>
                  <ActivityIndicator size="large" color={COLORS.bronze} />
                </View>
              )}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1a1a1a',
    borderBottomWidth: 1, borderBottomColor: '#333', paddingTop: 50,
  },
  closeBtn: { width: 60 },
  closeText: { fontSize: 16, color: COLORS.bronze, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#525659' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 20 },
  loadTxt: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#525659' },
  errIcon: { fontSize: 48, marginBottom: 12 },
  errTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 16 },
  retry: { marginTop: 12, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
