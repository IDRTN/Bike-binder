import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { getContentUri, isImageFile } from '../utils/pdfStorage';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';

export default function PDFViewer({ visible, fileUri, fileName, onClose }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (visible && fileUri) loadFile();
    else { setSource(null); setError(null); }
  }, [visible, fileUri]);

  const loadFile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Web URLs — open directly
      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        setSource({ uri: fileUri });
        setLoading(false);
        return;
      }

      // Ensure the file exists at the stored path
      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists) {
        setError('File not found. It may have been moved or deleted.');
        setLoading(false);
        return;
      }

      // Get content URI for WebView access
      const uri = await getContentUri(fileUri);
      setSource({ uri });
      setLoading(false);
    } catch (e) {
      console.warn('PDFViewer error:', e);
      setError(e.message || 'Could not open file');
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{fileName || 'Document'}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.content}>
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={COLORS.bronze} />
              <Text style={s.loadTxt}>Opening...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
              <Text style={s.errTitle}>Could not open file</Text>
              <Text style={s.errSub}>{error}</Text>
              <TouchableOpacity style={s.retry} onPress={loadFile}>
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
              onError={() => setError('WebView failed to load the file.')}
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
  errTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 16 },
  retry: { marginTop: 12, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
