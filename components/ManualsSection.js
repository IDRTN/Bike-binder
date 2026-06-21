import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, Alert,
} from 'react-native';
import useManuals from '../hooks/useManuals';
import { isImageFile } from '../utils/pdfStorage';
import PDFViewer from './PDFViewer';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';

export default function ManualsSection({ motorcycle, onUpdate }) {
  const {
    showForm, search, formData, saving, filtered,
    setSearch, setField, openAddForm, openEditForm, closeForm,
    handlePickPDF, handlePickImage, handleRemoveFile, handleSave, handleDelete,
  } = useManuals(motorcycle, onUpdate);

  const [pdfFile, setPdfFile] = React.useState(null);
  const [pdfVisible, setPdfVisible] = React.useState(false);
  const [imgVisible, setImgVisible] = React.useState(false);
  const [imgUri, setImgUri] = React.useState(null);

  const openFile = (item) => {
    if (isImageFile(item.filePath || item.fileUri)) {
      setImgUri(item.filePath || item.fileUri);
      setImgVisible(true);
    } else {
      setPdfFile(item);
      setPdfVisible(true);
    }
  };

  const renderItem = ({ item }) => {
    const isImage = isImageFile(item.filePath || item.fileUri);
    return (
      <View style={styles.item}>
        <TouchableOpacity onPress={() => openFile(item)} onLongPress={() => handleDelete(item.id)}>
          <View style={styles.itemRow}>
            {isImage ? (
              <TouchableOpacity onPress={() => { setImgUri(item.fileUri); setImgVisible(true); }}>
                <Image source={{ uri: item.filePath || item.fileUri }} style={styles.thumb} />
              </TouchableOpacity>
            ) : (
              <View style={styles.fileIcon}>
                <Text style={styles.fileIconText}>📄</Text>
              </View>
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.fileName && <Text style={styles.itemSub}>{item.fileName}</Text>}
              {(item.chapter || item.section || item.page) && (
                <Text style={styles.refText}>
                  {[item.chapter, item.section, item.page].filter(Boolean).join(' • ')}
                </Text>
              )}
            </View>
            <Text style={styles.editIcon}>✎</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Manuals ({filtered.length})</Text>
        <TouchableOpacity onPress={() => (showForm ? closeForm() : openAddForm())}>
          <Text style={styles.addBtn}>{showForm ? 'Cancel' : '+ Add Manual'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      {filtered.length > 0 && (
        <TextInput
          style={styles.search}
          placeholder="Search manuals..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      )}

      {/* Form */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{formData.id ? 'Edit Manual' : 'New Manual'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Title (e.g. Service Manual)"
            placeholderTextColor={COLORS.textSecondary}
            value={formData.title}
            onChangeText={(v) => setField('title', v)}
          />

          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={handlePickPDF}>
              <Text style={styles.imageBtnText}>📄 Pick PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={handlePickImage}>
              <Text style={styles.imageBtnText}>🖼 Pick Photo</Text>
            </TouchableOpacity>
            {formData.filePath && (
              <TouchableOpacity style={styles.imageBtn} onPress={handleRemoveFile}>
                <Text style={styles.imageBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {formData.filePath && (
            <View style={styles.filePreview}>
              <Text style={styles.fileLabel}>Selected: {formData.fileName}</Text>
              {isImageFile(formData.filePath) && (
                <Image source={{ uri: formData.filePath }} style={styles.preview} />
              )}
            </View>
          )}

          <Text style={styles.refHeader}>Reference (optional)</Text>
          <View style={styles.refRow}>
            <TextInput
              style={[styles.input, styles.refInput]}
              placeholder="Chapter" placeholderTextColor={COLORS.textSecondary}
              value={formData.chapter} onChangeText={(v) => setField('chapter', v)}
            />
            <TextInput
              style={[styles.input, styles.refInput]}
              placeholder="Section" placeholderTextColor={COLORS.textSecondary}
              value={formData.section} onChangeText={(v) => setField('section', v)}
            />
            <TextInput
              style={[styles.input, styles.refInput]}
              placeholder="Page" placeholderTextColor={COLORS.textSecondary}
              value={formData.page} onChangeText={(v) => setField('page', v)}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave} disabled={saving}
          >
            <Text style={styles.submitText}>{formData.id ? 'Update Manual' : 'Save Manual'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {filtered.length > 0 && (
        <FlatList data={filtered} keyExtractor={(i) => i.id} renderItem={renderItem} scrollEnabled={false} />
      )}
      {search && filtered.length === 0 && (
        <Text style={styles.noResults}>No manuals match your search.</Text>
      )}

      {/* PDF Viewer */}
      <PDFViewer
        visible={pdfVisible}
        fileUri={pdfFile?.filePath || pdfFile?.fileUri}
        fileName={pdfFile?.fileName || pdfFile?.title}
        onClose={() => setPdfVisible(false)}
      />

      {/* Image Viewer */}
      <ImageViewer visible={imgVisible} imageUri={imgUri} onClose={() => setImgVisible(false)} />
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
  input: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 12, color: COLORS.text },
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
