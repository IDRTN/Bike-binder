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
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateMotorcycle } from '../storage';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';

export default function ServicesSection({ motorcycle, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [mileage, setMileage] = useState('');
  const [imageUris, setImageUris] = useState([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const openViewer = (uri) => {
    setViewerImage(uri);
    setViewerVisible(true);
  };

  const resetForm = () => {
    setDate('');
    setDescription('');
    setMileage('');
    setImageUris([]);
    setEditingId(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (service) => {
    setDate(service.date || '');
    setDescription(service.description);
    setMileage(service.mileage || '');
    setImageUris(service.imageUris ? [...service.imageUris] : service.imageUri ? [service.imageUri] : []);
    setEditingId(service.id);
    setShowForm(true);
  };

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera roll access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true });
    if (!result.canceled) setImageUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setImageUris((prev) => [...prev, result.assets[0].uri]);
  };

  const removeImage = (uri) => setImageUris((prev) => prev.filter((u) => u !== uri));

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please enter a description of the service.');
      return;
    }
    setAdding(true);
    let updated = { ...motorcycle };
    const services = [...(updated.services || [])];
    const entry = {
      date: date.trim() || new Date().toLocaleDateString(),
      description: description.trim(),
      mileage: mileage.trim(),
      imageUris: imageUris.length > 0 ? imageUris : null,
    };
    if (editingId) {
      const idx = services.findIndex((s) => s.id === editingId);
      if (idx !== -1) services[idx] = { ...services[idx], ...entry };
    } else {
      services.push({ id: Date.now().toString(), ...entry });
    }
    updated.services = services;
    await updateMotorcycle(updated);
    onUpdate(updated);
    resetForm();
    setShowForm(false);
    setAdding(false);
  };

  const removeService = (id) => {
    Alert.alert('Remove Service Record', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = { ...motorcycle };
        updated.services = updated.services.filter((s) => s.id !== id);
        await updateMotorcycle(updated);
        onUpdate(updated);
      }},
    ]);
  };

  const services = motorcycle.services || [];
  const filtered = search
    ? services.filter((s) => s.description.toLowerCase().includes(search.toLowerCase()) || s.date.toLowerCase().includes(search.toLowerCase()) || (s.mileage && s.mileage.includes(search)))
    : services;

  const renderPhotos = (uris) => {
    if (!uris || uris.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
        {uris.map((uri, i) => (
          <TouchableOpacity key={i} onPress={() => openViewer(uri)}>
            <Image source={{ uri }} style={styles.stripThumb} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderService = ({ item }) => (
    <TouchableOpacity style={styles.item} onPress={() => openEdit(item)} onLongPress={() => removeService(item.id)}>
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <View style={styles.serviceHeader}>
            <Text style={styles.itemTitle}>{item.date}</Text>
            {item.mileage ? <Text style={styles.mileageBadge}>{item.mileage} mi</Text> : null}
          </View>
          <Text style={styles.itemDesc}>{item.description}</Text>
          {renderPhotos(item.imageUris || (item.imageUri ? [item.imageUri] : null))}
        </View>
        <Text style={styles.editIcon}>✎</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Services ({services.length})</Text>
        <TouchableOpacity onPress={() => (showForm ? setShowForm(false) : openAdd())}>
          <Text style={styles.addBtn}>{showForm ? 'Cancel' : '+ Add Service'}</Text>
        </TouchableOpacity>
      </View>

      {services.length > 0 && (
        <TextInput style={styles.search} placeholder="Search by description, date, or mileage..." placeholderTextColor={COLORS.textSecondary} value={search} onChangeText={setSearch} />
      )}

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? 'Edit Service' : 'New Service'}</Text>
          <TextInput style={styles.input} placeholder="Date (e.g. 2025-06-16)" value={date} onChangeText={setDate} />
          <TextInput style={[styles.input, styles.multiline]} placeholder="Description of service or parts changed..." value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />
          <TextInput style={styles.input} placeholder="Mileage at service" value={mileage} onChangeText={setMileage} keyboardType="number-pad" />
          <View style={styles.imageRow}>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImages}><Text style={styles.imageBtnText}>📷 Pick Photos</Text></TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}><Text style={styles.imageBtnText}>📸 Take Photo</Text></TouchableOpacity>
          </View>
          {imageUris.length > 0 && (
            <View style={styles.photoGrid}>
              {imageUris.map((uri, i) => (
                <View key={i} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoPreview} />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => removeImage(uri)}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={[styles.submitBtn, adding && { opacity: 0.6 }]} onPress={handleSave} disabled={adding}>
            <Text style={styles.submitText}>{editingId ? 'Update Service' : 'Save Service Record'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {filtered.length > 0 && (
        <FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={renderService} scrollEnabled={false} />
      )}
      {search && filtered.length === 0 && <Text style={styles.noResults}>No services match your search.</Text>}

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
  multiline: { minHeight: 80 },
  imageRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  imageBtn: { backgroundColor: '#f0f0f0', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  imageBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  photoWrapper: { position: 'relative' },
  photoPreview: { width: 80, height: 80, borderRadius: 8 },
  removePhoto: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.bronze, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  removePhotoText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  submitBtn: { backgroundColor: COLORS.bronze, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  item: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemInfo: { flex: 1 },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.bronze },
  mileageBadge: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  itemDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 8 },
  photoStrip: { marginTop: 6 },
  stripThumb: { width: 56, height: 56, borderRadius: 6, marginRight: 6 },
  editIcon: { fontSize: 18, color: COLORS.textSecondary, marginLeft: 8, marginTop: 2 },
  noResults: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20 },
});
