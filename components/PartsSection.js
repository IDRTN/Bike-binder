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
import * as ImagePicker from 'expo-image-picker';
import { updateMotorcycle } from '../storage';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';

export default function PartsSection({ motorcycle, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const openViewer = (uri) => {
    setViewerImage(uri);
    setViewerVisible(true);
  };

  const resetForm = () => {
    setPartNumber('');
    setPartName('');
    setImageUri(null);
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (part) => {
    setPartNumber(part.partNumber);
    setPartName(part.partName);
    setImageUri(part.imageUri || null);
    setEditingId(part.id);
    setShowForm(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera roll access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!partNumber.trim() || !partName.trim()) {
      Alert.alert('Missing Info', 'Part number and name are required.');
      return;
    }
    setAdding(true);
    let updated = { ...motorcycle };
    const parts = [...(updated.parts || [])];
    if (editingId) {
      const idx = parts.findIndex((p) => p.id === editingId);
      if (idx !== -1) parts[idx] = { ...parts[idx], partNumber: partNumber.trim(), partName: partName.trim(), imageUri: imageUri || null };
    } else {
      parts.push({ id: Date.now().toString(), partNumber: partNumber.trim(), partName: partName.trim(), imageUri: imageUri || null });
    }
    updated.parts = parts;
    await updateMotorcycle(updated);
    onUpdate(updated);
    resetForm();
    setShowForm(false);
    setAdding(false);
  };

  const removePart = (id) => {
    Alert.alert('Remove Part', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = { ...motorcycle };
        updated.parts = updated.parts.filter((p) => p.id !== id);
        await updateMotorcycle(updated);
        onUpdate(updated);
      }},
    ]);
  };

  const parts = motorcycle.parts || [];
  const filtered = search
    ? parts.filter((p) => p.partName.toLowerCase().includes(search.toLowerCase()) || p.partNumber.toLowerCase().includes(search.toLowerCase()))
    : parts;

  const renderPart = ({ item }) => (
    <TouchableOpacity style={styles.item} onPress={() => openEdit(item)} onLongPress={() => removePart(item.id)}>
      <View style={styles.itemRow}>
        {item.imageUri && (
          <TouchableOpacity onPress={() => openViewer(item.imageUri)}>
            <Image source={{ uri: item.imageUri }} style={styles.thumb} />
          </TouchableOpacity>
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.partName}</Text>
          <Text style={styles.itemSub}>#{item.partNumber}</Text>
        </View>
        <Text style={styles.editIcon}>✎</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Parts ({parts.length})</Text>
        <TouchableOpacity onPress={() => (showForm ? setShowForm(false) : openAdd())}>
          <Text style={styles.addBtn}>{showForm ? 'Cancel' : '+ Add Part'}</Text>
        </TouchableOpacity>
      </View>

      {parts.length > 0 && (
        <TextInput style={styles.search} placeholder="Search parts by name or number..." placeholderTextColor={COLORS.textSecondary} value={search} onChangeText={setSearch} />
      )}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Edit Part' : 'New Part'}</Text>
          <TextInput style={styles.input} placeholder="Manufacturing / Part Number" value={partNumber} onChangeText={setPartNumber} />
          <TextInput style={styles.input} placeholder="Part Name" value={partName} onChangeText={setPartName} />
          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}><Text style={styles.imageBtnText}>📷 Pick Photo</Text></TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}><Text style={styles.imageBtnText}>📸 Take Photo</Text></TouchableOpacity>
            {imageUri && <TouchableOpacity style={styles.imageBtn} onPress={() => setImageUri(null)}><Text style={styles.imageBtnText}>🗑 Remove</Text></TouchableOpacity>}
          </View>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
          <TouchableOpacity style={[styles.submitBtn, adding && { opacity: 0.6 }]} onPress={handleSave} disabled={adding}>
            <Text style={styles.submitText}>{editingId ? 'Update Part' : 'Save Part'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {filtered.length > 0 && (
        <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderPart} scrollEnabled={false} />
      )}
      {search && filtered.length === 0 && <Text style={styles.noResults}>No parts match your search.</Text>}

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
  preview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 12 },
  submitBtn: { backgroundColor: COLORS.bronze, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  item: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  itemSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  editIcon: { fontSize: 18, color: COLORS.textSecondary, marginLeft: 8 },
  noResults: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20 },
});
