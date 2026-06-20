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

export default function PartsSection({ motorcycle, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [miles, setMiles] = useState('');
  const [price, setPrice] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [specs, setSpecs] = useState('');
  const [notes, setNotes] = useState('');
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
    setMiles('');
    setPrice('');
    setMake('');
    setModel('');
    setSpecs('');
    setNotes('');
    setImageUri(null);
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (part) => {
    setPartNumber(part.partNumber || '');
    setPartName(part.partName || '');
    setMiles(part.miles || '');
    setPrice(part.price || '');
    setMake(part.make || '');
    setModel(part.model || '');
    setSpecs(part.specs || '');
    setNotes(part.notes || '');
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
    const partData = {
      partNumber: partNumber.trim(),
      partName: partName.trim(),
      miles: miles.trim(),
      price: price.trim(),
      make: make.trim(),
      model: model.trim(),
      specs: specs.trim(),
      notes: notes.trim(),
      imageUri: imageUri || null,
    };
    if (editingId) {
      const idx = parts.findIndex((p) => p.id === editingId);
      if (idx !== -1) parts[idx] = { ...parts[idx], ...partData };
    } else {
      parts.push({ id: Date.now().toString(), ...partData });
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
    ? parts.filter((p) =>
        (p.partName || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.partNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.make || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.model || '').toLowerCase().includes(search.toLowerCase())
      )
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
          {item.miles ? <Text style={styles.itemSub}>Miles: {item.miles}</Text> : null}
          {item.price ? <Text style={styles.itemSub}>Price: ${item.price}</Text> : null}
          {(item.make || item.model) ? <Text style={styles.itemSub}>[ {item.make} {item.model} ]</Text> : null}
          {item.specs ? <Text style={styles.specsText}>{item.specs}</Text> : null}
          {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}
        </View>
        <Text style={styles.editIcon}>✎</Text>
      </View>
    </TouchableOpacity>
  );

  const renderField = (label, value, setter, placeholder, opts = {}) => (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, opts.multiline && styles.multilineInput]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        value={value}
        onChangeText={setter}
        keyboardType={opts.numeric ? 'decimal-pad' : 'default'}
        multiline={opts.multiline}
        numberOfLines={opts.multiline ? 3 : 1}
        textAlignVertical={opts.multiline ? 'top' : 'center'}
      />
    </View>
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
        <TextInput
          style={styles.search}
          placeholder="Search parts by name, number, make, model..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      )}

      {showForm && (
        <View style={styles.form}>
          <ScrollView style={styles.formScroll} nestedScrollEnabled>
            <Text style={styles.formTitle}>{editingId ? 'Edit Part' : 'New Part'}</Text>
            {renderField('Part Name *', partName, setPartName, 'e.g. Front Brake Pad')}
            {renderField('Manufacturer Part # *', partNumber, setPartNumber, 'e.g. BGP-123')}
            {renderField('Miles', miles, setMiles, 'e.g. 5000', { numeric: true })}
            {renderField('Price ($)', price, setPrice, 'e.g. 39.99', { numeric: true })}
            {renderField('Make', make, setMake, 'e.g. Honda')}
            {renderField('Model', model, setModel, 'e.g. CBR600RR')}
            {renderField('Specs', specs, setSpecs, 'Dimensions, material, weight...', { multiline: true })}
            {renderField('Notes', notes, setNotes, 'Additional notes...', { multiline: true })}
            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}><Text style={styles.imageBtnText}>📷 Pick Photo</Text></TouchableOpacity>
              <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}><Text style={styles.imageBtnText}>📸 Take Photo</Text></TouchableOpacity>
              {imageUri && <TouchableOpacity style={styles.imageBtn} onPress={() => setImageUri(null)}><Text style={styles.imageBtnText}>🗑 Remove</Text></TouchableOpacity>}
            </View>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
            <TouchableOpacity style={[styles.submitBtn, adding && { opacity: 0.6 }]} onPress={handleSave} disabled={adding}>
              <Text style={styles.submitText}>{editingId ? 'Update Part' : 'Save Part'}</Text>
            </TouchableOpacity>
          </ScrollView>
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
  form: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder, maxHeight: 500 },
  formScroll: { maxHeight: 460 },
  formTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  fieldGroup: { marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.steelLight, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, padding: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg },
  multilineInput: { minHeight: 60 },
  imageRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  imageBtn: { backgroundColor: COLORS.bg, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  imageBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  preview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 12 },
  submitBtn: { backgroundColor: COLORS.bronze, padding: 14, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  item: { backgroundColor: COLORS.card, borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12, marginTop: 2 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  itemSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  specsText: { fontSize: 12, color: COLORS.steelLight, marginTop: 4, fontStyle: 'italic' },
  notesText: { fontSize: 12, color: COLORS.steelLight, marginTop: 2 },
  editIcon: { fontSize: 18, color: COLORS.textSecondary, marginLeft: 8, marginTop: 2 },
  noResults: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20 },
});
