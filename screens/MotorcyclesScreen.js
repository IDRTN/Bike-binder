import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMotorcycles, deleteMotorcycle } from '../storage';
import ImageViewer from '../components/ImageViewer';
import { COLORS } from '../theme';

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'make', label: 'Make (A-Z)' },
  { key: 'model', label: 'Model (A-Z)' },
  { key: 'year_asc', label: 'Year (Ascending)' },
  { key: 'year_desc', label: 'Year (Descending)' },
  { key: 'cc_asc', label: 'Engine CC (Ascending)' },
  { key: 'cc_desc', label: 'Engine CC (Descending)' },
];

export default function MotorcyclesScreen({ navigation }) {
  const [motorcycles, setMotorcycles] = useState([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('newest');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isPad = width >= 600;

  const openViewer = (uri) => { setViewerImage(uri); setViewerVisible(true); };

  const getMainPhotoUri = (bike) => {
    const photos = bike.photos || [];
    const idx = bike.mainPhotoIndex ?? -1;
    if (photos.length > 0 && idx >= 0 && idx < photos.length) return photos[idx];
    return photos.length > 0 ? photos[0] : bike.imageUri || null;
  };

  useFocusEffect(
    useCallback(() => {
      (async () => { setMotorcycles(await loadMotorcycles()); })();
    }, [])
  );

  const filtered = motorcycles.filter((bike) => {
    const q = search.toLowerCase();
    return bike.year.toLowerCase().includes(q) || bike.make.toLowerCase().includes(q) || bike.model.toLowerCase().includes(q) || bike.engineSize.toLowerCase().includes(q) || (bike.vin && bike.vin.toLowerCase().includes(q)) || (bike.purchaseDate && bike.purchaseDate.toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'oldest': return (a.id || '0').localeCompare(b.id || '0');
      case 'newest': return (b.id || '0').localeCompare(a.id || '0');
      case 'make': return a.make.localeCompare(b.make);
      case 'model': return a.model.localeCompare(b.model);
      case 'year_asc': return (a.year || '0').localeCompare(b.year || '0', undefined, { numeric: true });
      case 'year_desc': return (b.year || '0').localeCompare(a.year || '0', undefined, { numeric: true });
      case 'cc_asc': return (a.engineSize || '0').localeCompare(b.engineSize || '0', undefined, { numeric: true });
      case 'cc_desc': return (b.engineSize || '0').localeCompare(a.engineSize || '0', undefined, { numeric: true });
      default: return 0;
    }
  });

  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label || 'Newest First';
  const openDetail = (bike) => navigation.navigate('MotorcycleDetail', { motorcycleId: bike.id });
  const confirmDelete = (bike) => {
    Alert.alert('Delete Motorcycle', `Remove ${bike.make} ${bike.model}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMotorcycle(bike.id); setMotorcycles((prev) => prev.filter((b) => b.id !== bike.id)); }},
    ]);
  };

  const renderItem = ({ item }) => {
    const photoUri = getMainPhotoUri(item);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(item)} onLongPress={() => confirmDelete(item)}>
        {photoUri && (
          <TouchableOpacity onPress={() => openViewer(photoUri)}>
            <Image source={{ uri: photoUri }} style={styles.cardImage} />
          </TouchableOpacity>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.bikeName}>{item.make} {item.model}</Text>
            <Text style={styles.badge}>{item.engineSize || '-'}cc</Text>
          </View>
          <Text style={styles.bikeYear}>{item.year || 'Unknown year'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>My Motorcycles</Text>
      </View>
      <View style={styles.toolbar}>
        <TextInput style={styles.search} placeholder="Search by year, make, model, or cc..." placeholderTextColor={COLORS.textSecondary} value={search} onChangeText={setSearch} />
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortPicker(true)}><Text style={styles.sortBtnText}>↕</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.sortLabel} onPress={() => setShowSortPicker(true)}>
        <Text style={styles.sortLabelText}>Sorted by: {currentSortLabel}</Text>
      </TouchableOpacity>
      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{search ? 'No motorcycles match your search' : 'No motorcycles yet'}</Text>
          <Text style={styles.emptySub}>{search ? 'Try a different search term' : 'Add one from the tab below!'}</Text>
        </View>
      ) : (
        <FlatList data={sorted} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]} numColumns={isPad ? 2 : 1} key={isPad ? 'grid' : 'list'} />
      )}
      <Modal visible={showSortPicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort Motorcycles</Text>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.key} style={[styles.modalOption, sortKey === opt.key && styles.modalOptionActive]} onPress={() => { setSortKey(opt.key); setShowSortPicker(false); }}>
                <Text style={[styles.modalOptionText, sortKey === opt.key && styles.modalOptionTextActive]}>{opt.label}</Text>
                {sortKey === opt.key && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
      <ImageViewer visible={viewerVisible} imageUri={viewerImage} onClose={() => setViewerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingBottom: 16, paddingHorizontal: 20, backgroundColor: COLORS.bronze },
  headerTitle: { fontSize: 26, fontWeight: '700', color: COLORS.white },
  toolbar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  search: { flex: 1, backgroundColor: COLORS.card, padding: 14, borderRadius: 10, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.cardBorder },
  sortBtn: { width: 48, backgroundColor: COLORS.card, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  sortBtnText: { fontSize: 22 },
  sortLabel: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  sortLabelText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  list: { padding: 16 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, marginBottom: 12, marginHorizontal: 4, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden', flex: 1 },
  cardImage: { width: '100%', height: 160 },
  cardBody: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bikeName: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  badge: { fontSize: 13, fontWeight: '700', color: COLORS.bronze, backgroundColor: '#fde8e8', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  bikeYear: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, width: 280, borderWidth: 1, borderColor: COLORS.cardBorder },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8 },
  modalOptionActive: { backgroundColor: COLORS.bronze + '20' },
  modalOptionText: { fontSize: 15, color: COLORS.text },
  modalOptionTextActive: { color: COLORS.bronze, fontWeight: '600' },
  checkmark: { fontSize: 16, color: COLORS.bronze, fontWeight: '700' },
});
