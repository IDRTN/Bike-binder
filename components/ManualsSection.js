import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { updateMotorcycle } from '../storage';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';

export default function ManualsSection({ motorcycle, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [fileUri, setFileUri] = useState(null);
  const [fileName, setFileName] = useState('');
  const [chapter, setChapter] = useState('');
  const [section, setSection] = useState('');
  const [page, setPage] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const openViewer = (uri) => {
    setViewerImage(uri);
    setViewerVisible(true);
  };

  const resetForm = () => {
    setTitle('');
    setFileUri(null);
    setFileName('');
    setChapter('');
    setSection('');
    setPage('');
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (manual) => {
    setTitle(manual.title);
    setFileUri(manual.fileUri || null);
    setFileName(manual.fileName || '');
    setChapter(manual.chapter || '');
    setSection(manual.section || '');
    setPage(manual.page || '');
    setEditingId(manual.id);
    setShowForm(true);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length > 0) {
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].name);
    }
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera roll access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled) {
      setFileUri(result.assets[0].uri);
      setFileName(result.assets[0].fileName || 'photo.jpg');
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !fileUri) {
      Alert.alert('Missing Info', 'Please enter a title and upload a file.');
      return;
    }
    setAdding(true);
    let updated = { ...motorcycle };
    const manuals = [...(updated.manuals || [])];
    const entry = { title: title.trim(), fileUri, fileName, chapter: chapter.trim(), section: section.trim(), page: page.trim() };
    if (editingId) {
      const idx = manuals.findIndex((m) => m.id === editingId);
      if (idx !== -1) manuals[idx] = { ...manuals[idx], ...entry };
    } else {
      manuals.push({ id: Date.now().toString(), ...entry });
    }
    updated.manuals = manuals;
    await updateMotorcycle(updated);
    onUpdate(updated);
    resetForm();
    setShowForm(false);
    setAdding(false);
  };

  const removeManual = (id) => {
    Alert.alert('Remove Manual', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = { ...motorcycle };
        updated.manuals = updated.manuals.filter((m) => m.id !== id);
        await updateMotorcycle(updated);
        onUpdate(updated);
      }},
    ]);
  };

  const manuals = motorcycle.manuals || [];
  const filtered = search
    ? manuals.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()) || (m.fileName && m.fileName.toLowerCase().includes(search.toLowerCase())))
    : manuals;

  const renderManual = ({ item }) => {
    const isImage = item.fileUri?.match(/\.(png|jpg|jpeg|gif|webp)$/i);
    return (
      <TouchableOpacity style={styles.item} onPress={() => openEdit(item)} onLongPress={() => removeManual(item.id)}>
        <View style={styles.itemRow}>
          {isImage ? (
            <TouchableOpacity onPress={() => openViewer(item.fileUri)}>
              <Image source={{ uri: item.fileUri }} style={styles.thumb} />
            </TouchableOpacity>
          ) : (
            <View style={styles.fileIcon}><Text style={styles.fileIconText}>📄</Text></View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemSub}>{item.fileName}</Text>
            {(item.chapter || item.section || item.page) && (
              <Text style={styles.refText}>{item.chapter ? `Ch. ${item.chapter}` : ''}{item.section ? `  Sec. ${item.section}` : ''}{item.page ? `  Pg. ${item.page}` : ''}</Text>
            )}
          </View>
          <Text style={styles.editIcon}>✎</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Manuals ({manuals.length})</Text>
        <TouchableOpacity onPress={() => (showForm ? setShowForm(false) : openAdd())}>
          <Text style={styles.addBtn}>{showForm ? 'Cancel' : '+ Add Manual'}</Text>
        </TouchableOpacity>
      </View>

      {manuals.length > 0 && (
        <TextInput style={styles.search} placeholder="Search manuals by title or filename..." placeholderTextColor={COLORS.textSecondary} value={search} onChangeText={setSearch} />
      )}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Edit Manual' : 'New Manual'}</Text>
          <TextInput style={styles.input} placeholder="Manual title (e.g. Service Manual)" value={title} onChangeText={setTitle} />
          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={pickDocument}><Text style={styles.imageBtnText}>📄 Pick PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={pickPhoto}><Text style={styles.imageBtnText}>🖼 Pick Photo</Text></TouchableOpacity>
            {fileUri && <TouchableOpacity style={styles.imageBtn} onPress={() => { setFileUri(null); setFileName(''); }}><Text style={styles.imageBtnText}>🗑 Remove</Text></TouchableOpacity>}
          </View>
          {fileUri && (
            <View style={styles.filePreview}>
              <Text style={styles.fileLabel}>Selected: {fileName}</Text>
              {fileUri.match(/\.(png|jpg|jpeg|gif|webp)$/i) && <Image source={{ uri: fileUri }} style={styles.preview} />}
            </View>
          )}
          <Text style={styles.refHeader}>Reference (optional)</Text>
          <View style={styles.refRow}>
            <TextInput style={[styles.input, styles.refInput]} placeholder="Chapter" value={chapter} onChangeText={setChapter} />
            <TextInput style={[styles.input, styles.refInput]} placeholder="Section" value={section} onChangeText={setSection} />
            <TextInput style={[styles.input, styles.refInput]} placeholder="Page" value={page} onChangeText={setPage} keyboardType="number-pad" />
          </View>
          <TouchableOpacity style={[styles.submitBtn, adding && { opacity: 0.6 }]} onPress={handleSave} disabled={adding}>
            <Text style={styles.submitText}>{editingId ? 'Update Manual' : 'Save Manual'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {filtered.length > 0 && (
        <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderManual} scrollEnabled={false} />
      )}
      {search && filtered.length === 0 && <Text style={styles.noResults}>No manuals match your search.</Text>}

      <ImageViewer visible={viewerVisible} imageUri={viewerImage} onClose={() => setViewerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  addBtn: { fontSize: 15, fontWeight: '600', color: COLORS.bronze },
  search: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12 },
  form: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12 },
  imageRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  imageBtn: { backgroundColor: '#f0f0f0', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  imageBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filePreview: { marginBottom: 12 },
  fileLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  preview: { width: '100%', height: 160, borderRadius: 8 },
  refHeader: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  refRow: { flexDirection: 'row', gap: 8 },
  refInput: { flex: 1, marginBottom: 12 },
  submitBtn: { backgroundColor: COLORS.bronze, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  item: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12 },
  fileIcon: { width: 48, height: 48, borderRadius: 6, marginRight: 12, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  fileIconText: { fontSize: 24 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  refText: { fontSize: 12, color: COLORS.bronze, marginTop: 4, fontWeight: '500' },
  editIcon: { fontSize: 18, color: COLORS.textSecondary, marginLeft: 8 },
  noResults: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20 },
});
