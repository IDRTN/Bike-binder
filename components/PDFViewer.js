import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Dimensions,
} from 'react-native';
import Pdf from 'react-native-pdf';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { COLORS } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PDFViewer({ visible, fileUri, fileName, onClose }) {
  const pdfRef = useRef(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfSource, setPdfSource] = useState(null);

  React.useEffect(() => {
    if (visible && fileUri) {
      prepareSource();
    } else {
      setPdfSource(null);
      setTotalPages(0);
      setCurrentPage(1);
      setError(null);
    }
  }, [visible, fileUri]);

  const prepareSource = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[PDFViewer] Received fileUri:', fileUri);

      // Web URLs
      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        console.log('[PDFViewer] Using web URL directly');
        setPdfSource({ uri: fileUri, cache: true });
        setLoading(false);
        return;
      }

      // Determine the correct file path
      let finalPath = fileUri;

      // If it's a content:// URI (shouldn't happen if stored properly, but handle it)
      if (fileUri.startsWith('content://')) {
        console.log('[PDFViewer] ERROR: content:// URI detected — file was not copied to permanent storage');
        setError('File was not saved properly. Please upload again.');
        setLoading(false);
        return;
      }

      // If it's a file:// URI, extract the path
      if (fileUri.startsWith('file://')) {
        finalPath = fileUri.replace(/^file:\/\//, '');
      }

      // Verify the permanent file exists
      const exists = await ReactNativeBlobUtil.fs.exists(finalPath);
      console.log('[PDFViewer] Permanent file path:', finalPath);
      console.log('[PDFViewer] File exists:', exists);

      if (!exists) {
        // Try the document directory
        const docDirPath = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/manuals/${fileName || 'manual.pdf'}`;
        const docExists = await ReactNativeBlobUtil.fs.exists(docDirPath);
        console.log('[PDFViewer] Fallback path:', docDirPath, 'exists:', docExists);
        if (docExists) {
          finalPath = docDirPath;
        } else {
          setError('File not found in storage. It may have been deleted.');
          setLoading(false);
          return;
        }
      }

      // react-native-pdf expects a plain absolute path for local files
      // OR use file:// scheme
      const source = { uri: `file://${finalPath}`, cache: true };
      console.log('[PDFViewer] URI passed to react-native-pdf:', source.uri);

      setPdfSource(source);
      setLoading(false);
    } catch (e) {
      console.warn('[PDFViewer] Error:', e);
      setError(e.message || 'Could not open the PDF.');
      setLoading(false);
    }
  };

  const goToPage = (page) => {
    if (pdfRef.current && page >= 1 && page <= totalPages) {
      pdfRef.current.setPage(page);
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
          <Text style={s.title} numberOfLines={1}>{fileName || 'PDF Viewer'}</Text>
          <View style={{ width: 60, alignItems: 'flex-end' }}>
            {totalPages > 0 && <Text style={s.pageCount}>{currentPage}/{totalPages}</Text>}
          </View>
        </View>

        {totalPages > 0 && (
          <View style={s.controls}>
            <TouchableOpacity
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              style={[s.ctrlBtn, currentPage <= 1 && s.ctrlDisabled]}
            >
              <Text style={s.ctrlText}>◀</Text>
            </TouchableOpacity>
            <Text style={s.pageLabel}>Page {currentPage} of {totalPages}</Text>
            <TouchableOpacity
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              style={[s.ctrlBtn, currentPage >= totalPages && s.ctrlDisabled]}
            >
              <Text style={s.ctrlText}>▶</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.content}>
          {loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={COLORS.bronze} />
              <Text style={s.loadTxt}>Loading PDF...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>⚠️</Text>
              <Text style={s.errTitle}>Could not open PDF</Text>
              <Text style={s.errSub}>{error}</Text>
              <TouchableOpacity style={s.retry} onPress={prepareSource}>
                <Text style={s.retryTxt}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : pdfSource ? (
            <Pdf
              ref={pdfRef}
              source={pdfSource}
              style={s.pdf}
              trustAllCerts={false}
              enablePaging={true}
              horizontal={false}
              spacing={10}
              fitPolicy={0}
              onLoadComplete={(total) => {
                console.log('[PDFViewer] Loaded', total, 'pages');
                setTotalPages(total);
                setLoading(false);
              }}
              onPageChanged={(page) => setCurrentPage(page)}
              onError={(e) => {
                console.warn('[PDFViewer] render error:', e);
                setError(e.message || 'Failed to render PDF.');
                setLoading(false);
              }}
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
  pageCount: { fontSize: 13, color: COLORS.steelLight },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a1a', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#333', gap: 16,
  },
  ctrlBtn: { padding: 8 },
  ctrlDisabled: { opacity: 0.3 },
  ctrlText: { fontSize: 18, color: COLORS.bronze, fontWeight: '600' },
  pageLabel: { fontSize: 13, color: COLORS.textSecondary },
  content: { flex: 1 },
  pdf: { flex: 1, backgroundColor: '#525659', width: SCREEN_WIDTH },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 20 },
  loadTxt: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  errTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 16 },
  retry: { marginTop: 12, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
