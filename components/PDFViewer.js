import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme';

const BOOKMARK_KEY = '@bikebinder_pdf_bookmarks';

export default function PDFViewer({ visible, fileUri, fileName, manualId, onClose }) {
  const webViewRef = useRef(null);
  const [state, setState] = useState({
    html: null,
    loading: true,
    error: false,
    errorMsg: '',
    currentPage: 1,
    totalPages: 0,
    goToPage: '',
    bookmarked: false,
    showPageInput: false,
  });

  const bookmarkId = manualId || fileUri;

  const updateState = (partial) => setState(prev => ({ ...prev, ...partial }));

  useEffect(() => {
    if (visible && bookmarkId) {
      (async () => {
        try {
          const json = await AsyncStorage.getItem(BOOKMARK_KEY);
          const bookmarks = json ? JSON.parse(json) : {};
          if (bookmarks[bookmarkId]) {
            updateState({ bookmarked: true });
          }
        } catch (e) {}
      })();
    }
  }, [visible, bookmarkId]);

  const toggleBookmark = async () => {
    try {
      const json = await AsyncStorage.getItem(BOOKMARK_KEY);
      const bookmarks = json ? JSON.parse(json) : {};
      const wasBookmarked = state.bookmarked;
      if (wasBookmarked) {
        delete bookmarks[bookmarkId];
        Alert.alert('Bookmark', 'Bookmark removed.');
      } else {
        bookmarks[bookmarkId] = {
          page: state.currentPage,
          title: fileName || 'Manual',
          date: new Date().toISOString(),
        };
        Alert.alert('Bookmark', `Page ${state.currentPage} bookmarked.`);
      }
      await AsyncStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
      updateState({ bookmarked: !wasBookmarked });
    } catch (e) {}
  };

  const loadPDF = useCallback(async () => {
    try {
      updateState({ loading: true, error: false });

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

      // Load PDF.js library from local asset
      const pdfjsAsset = Asset.fromModule(require('../assets/pdfjs/pdf.min.txt'));
      await pdfjsAsset.downloadAsync();
      const pdfjsCode = await FileSystem.readAsStringAsync(pdfjsAsset.localUri);

      // Load PDF.js worker from local asset

      // Build HTML — PDF.js renders PDF fully inside the WebView
      // All pages rendered for smooth scrolling
      // Pinch-to-zoom supported by WebView meta viewport
      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#525659;font-family:sans-serif;overflow-x:hidden}
#viewer{display:flex;flex-direction:column;align-items:center;padding:4px 0}
.page-container{margin:4px auto;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#fff;max-width:100%}
.page-container canvas{display:block;width:100%!important;height:auto!important}
.loading-msg{color:#ccc;text-align:center;padding:60px 20px;font-size:16px}
#controls{
  position:fixed;bottom:0;left:0;right:0;
  background:rgba(0,0,0,0.88);
  display:flex;justify-content:center;align-items:center;
  padding:8px 10px;gap:8px;z-index:100;flex-wrap:wrap;
}
#controls button{background:#c8953a;color:#fff;border:none;padding:6px 12px;border-radius:4px;font-size:13px;font-weight:600}
#controls .num-input{width:50px;padding:4px 6px;border-radius:4px;border:1px solid #555;background:#333;color:#fff;font-size:13px;text-align:center}
#controls span{color:#fff;font-size:13px}
.placeholder{height:52px}
</style>
</head>
<body>
<div id="viewer"><div class="loading-msg">Loading PDF...</div></div>
<div id="controls" style="display:none">
  <button onclick="prevPage()">◀</button>
  <button onclick="nextPage()">▶</button>
  <span id="pageInfo">-</span>
  <input type="number" id="pageInput" class="num-input" placeholder="#" onkeydown="if(event.key==='Enter')jumpTo()">
  <button onclick="doJump()">Go</button>
</div>
<div class="placeholder"></div>

<script>
${pdfjsCode}
(function(){
var blob = new Blob([${JSON.stringify(workerCode)}], {type:'application/javascript'});
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

var pdfDoc=null, curPage=1;
var viewer=document.getElementById('viewer');
var info=document.getElementById('pageInfo');
var ctrl=document.getElementById('controls');

pdfjsLib.getDocument("data:application/pdf;base64,${pdfData}").promise.then(function(pdf){
  pdfDoc=pdf;
  ctrl.style.display='flex';
  renderAll(pdf.numPages).then(function(){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'loaded',totalPages:pdf.numPages}));
  });
}).catch(function(e){
  viewer.innerHTML='<div class="loading-msg">Error: '+e.message+'</div>';
});

async function renderAll(n){
  viewer.innerHTML='';
  var s=1.5;
  if(window.devicePixelRatio) s*=window.devicePixelRatio;
  for(var i=1;i<=n;i++){
    var pg=await pdfDoc.getPage(i);
    var vp=pg.getViewport({scale:s});
    var cv=document.createElement('canvas');
    cv.height=vp.height;
    cv.width=vp.width;
    cv.style.width=(vp.width/window.devicePixelRatio)+'px';
    cv.style.height=(vp.height/window.devicePixelRatio)+'px';
    var ct=document.createElement('div');
    ct.className='page-container';
    ct.id='p'+i;
    ct.appendChild(cv);
    viewer.appendChild(ct);
    await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
  }
  info.textContent='1 / '+n;
  upd();
}

function upd(){
  var y=window.scrollY+80;
  var els=document.querySelectorAll('.page-container');
  for(var i=0;i<els.length;i++){
    if(els[i].offsetTop>y){
      curPage=Math.max(1,i);
      info.textContent=curPage+' / '+pdfDoc.numPages;
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'page',page:curPage}));
      return;
    }
  }
  curPage=pdfDoc.numPages;
  info.textContent=curPage+' / '+pdfDoc.numPages;
}

window.addEventListener('scroll',function(){if(pdfDoc)upd();});

function scrollTo(n){
  var el=document.getElementById('p'+n);
  if(el){el.scrollIntoView({behavior:'smooth',block:'start'});curPage=n;info.textContent=n+' / '+pdfDoc.numPages;}
}
function prevPage(){if(curPage>1)scrollTo(curPage-1);}
function nextPage(){if(curPage<pdfDoc.numPages)scrollTo(curPage+1);}
function doJump(){
  var v=document.getElementById('pageInput').value;
  var n=parseInt(v);
  if(n>=1&&n<=pdfDoc.numPages)scrollTo(n);
  document.getElementById('pageInput').value='';
}
</script>
</body>
</html>`;

      updateState({ html, loading: false });
    } catch (e) {
      console.log('PDF load error:', e);
      updateState({
        error: true,
        errorMsg: e.message || 'Could not load the PDF file.',
        loading: false,
      });
    }
  }, [fileUri, fileName, manualId]);

  useEffect(() => {
    if (visible && fileUri) {
      loadPDF();
    } else {
      updateState({ html: null, currentPage: 1, totalPages: 0 });
    }
  }, [visible, fileUri, loadPDF]);

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'loaded') {
        updateState({ totalPages: data.totalPages });
      } else if (data.type === 'page') {
        updateState({ currentPage: data.page });
      }
    } catch (e) {}
  };

  const jumpToPage = () => {
    const page = parseInt(state.goToPage);
    if (page >= 1 && page <= state.totalPages && webViewRef.current) {
      webViewRef.current.injectJavaScript(`scrollTo(${page}); true;`);
    }
    updateState({ goToPage: '', showPageInput: false });
  };

  const prevPage = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('prevPage(); true;');
    }
  };

  const nextPage = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('nextPage(); true;');
    }
  };

  const ch = (k, v) => updateState({ [k]: v });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>
            {fileName || 'PDF Viewer'}
          </Text>
          <View style={{ width: 60, alignItems: 'flex-end' }}>
            {state.totalPages > 0 && (
              <TouchableOpacity onPress={toggleBookmark}>
                <Text style={[s.bmIcon, state.bookmarked && s.bmActive]}>
                  {state.bookmarked ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Controls */}
        <View style={s.controls}>
          <TouchableOpacity onPress={prevPage} style={s.cBtn} disabled={state.currentPage <= 1}>
            <Text style={s.cText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => ch('showPageInput', !state.showPageInput)} style={s.pageBtn}>
            <Text style={s.pageText}>
              {state.currentPage} / {state.totalPages || '?'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextPage} style={s.cBtn} disabled={state.currentPage >= state.totalPages}>
            <Text style={s.cText}>▶</Text>
          </TouchableOpacity>
        </View>

        {state.showPageInput && state.totalPages > 0 && (
          <View style={s.piRow}>
            <TextInput
              style={s.pi}
              placeholder={`1-${state.totalPages}`}
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              value={state.goToPage}
              onChangeText={(v) => ch('goToPage', v)}
              onSubmitEditing={jumpToPage}
              returnKeyType="go"
            />
            <TouchableOpacity style={s.goBtn} onPress={jumpToPage}>
              <Text style={s.goText}>Go</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <View style={s.content}>
          {state.loading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={COLORS.bronze} />
              <Text style={s.loadTxt}>Loading PDF...</Text>
            </View>
          ) : state.error ? (
            <View style={s.center}>
              <Text style={s.errIcon}>⚠️</Text>
              <Text style={s.errTitle}>Could not load this PDF</Text>
              <Text style={s.errSub}>{state.errorMsg}</Text>
              <TouchableOpacity style={s.retry} onPress={loadPDF}>
                <Text style={s.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : state.html ? (
            <WebView
              ref={webViewRef}
              style={s.webview}
              source={{ html: state.html }}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              allowFileAccessFromFileURLs
              mixedContentMode="always"
              originWhitelist={['*']}
              onMessage={handleMessage}
              startInLoadingState
              renderLoading={() => (
                <View style={s.loadOv}>
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
  bmIcon: { fontSize: 22, color: COLORS.textSecondary },
  bmActive: { color: COLORS.gold },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a1a', paddingVertical: 8, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#333', gap: 16,
  },
  cBtn: { padding: 8 },
  cText: { fontSize: 18, color: COLORS.bronze, fontWeight: '600' },
  pageBtn: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: '#333', borderRadius: 4 },
  pageText: { fontSize: 14, color: COLORS.text },
  piRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1a1a1a', paddingBottom: 8, gap: 8,
  },
  pi: {
    backgroundColor: '#333', borderRadius: 4, padding: 6, fontSize: 14,
    color: COLORS.text, width: 80, textAlign: 'center',
  },
  goBtn: { backgroundColor: COLORS.bronze, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
  goText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  content: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#525659' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', padding: 20 },
  loadTxt: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  loadOv: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#525659' },
  errIcon: { fontSize: 48, marginBottom: 12 },
  errTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  errSub: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20, marginBottom: 16 },
  retry: { marginTop: 12, backgroundColor: COLORS.bronze, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
