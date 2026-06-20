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
  const [pdfHtml, setPdfHtml] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    if (visible && fileUri) {
      loadPDF();
    } else {
      setPdfHtml(null);
    }
  }, [visible, fileUri]);

  const loadPDF = async () => {
    try {
      setLoading(true);
      setError(false);

      let pdfData;

      if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        pdfData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      } else {
        pdfData = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Build HTML with PDF.js — renders PDF fully inside the WebView
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #525659; font-family: sans-serif; }
    #viewer { display: flex; flex-direction: column; align-items: center; padding: 8px 0; }
    .page-container { margin: 4px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.3); background: white; }
    .page-container canvas { display: block; width: 100% !important; height: auto !important; }
    .info { color: #ccc; text-align: center; padding: 40px 20px; font-size: 16px; }
    .controls {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: rgba(0,0,0,0.85);
      display: flex; justify-content: center; align-items: center;
      padding: 12px; gap: 20px; z-index: 100;
    }
    .controls button {
      background: #c8953a; color: white; border: none;
      padding: 8px 20px; border-radius: 6px; font-size: 14px;
      font-weight: 600; min-width: 70px;
    }
    .controls span { color: white; font-size: 14px; min-width: 80px; text-align: center; }
  </style>
</head>
<body>
  <div id="viewer"><div class="info">Loading PDF...</div></div>
  <div class="controls" id="controls" style="display:none">
    <button onclick="prevPage()">◀ Prev</button>
    <span id="pageInfo">-</span>
    <button onclick="nextPage()">Next ▶</button>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    let pdfDoc = null;
    let currentPage = 1;
    const viewer = document.getElementById('viewer');
    const pageInfo = document.getElementById('pageInfo');
    const controls = document.getElementById('controls');

    // Load PDF from base64 data URI
    const loadingTask = pdfjsLib.getDocument("data:application/pdf;base64,${pdfData}");

    loadingTask.promise.then(function(pdf) {
      pdfDoc = pdf;
      document.querySelector('.info').style.display = 'none';
      controls.style.display = 'flex';
      pageInfo.textContent = '1 / ' + pdf.numPages;
      renderPage(1);
    }).catch(function(err) {
      viewer.innerHTML = '<div class="info">Failed to load PDF: ' + err.message + '</div>';
    });

    function renderPage(num) {
      if (!pdfDoc) return;
      pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const container = document.createElement('div');
        container.className = 'page-container';
        container.appendChild(canvas);
        viewer.innerHTML = '';
        viewer.appendChild(container);

        const ctx = canvas.getContext('2d');
        page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function() {
          pageInfo.textContent = num + ' / ' + pdfDoc.numPages;
          currentPage = num;
        });
      });
    }

    function prevPage() {
      if (currentPage > 1) renderPage(currentPage - 1);
    }

    function nextPage() {
      if (currentPage < pdfDoc.numPages) renderPage(currentPage + 1);
    }
  </script>
</body>
</html>`;

      setPdfHtml(html);
      setLoading(false);
    } catch (e) {
      console.log('PDF load error:', e);
      setError(true);
      setErrorMsg(e.message || 'Could not load the PDF file.');
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
              <Text style={styles.loadingText}>Loading PDF...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>Could not load this PDF</Text>
              <Text style={styles.errorSub}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadPDF}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : pdfHtml ? (
            <WebView
              style={styles.webview}
              source={{ html: pdfHtml }}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowFileAccessFromFileURLs
              mixedContentMode="always"
              originWhitelist={['*']}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 20 },
  loadingText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#525659' },
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errorSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 16 },
  retryBtn: { marginTop: 12, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
