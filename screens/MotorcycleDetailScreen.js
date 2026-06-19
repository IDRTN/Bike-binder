import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadMotorcycles, updateMotorcycle, deleteMotorcycle } from '../storage';
import ImageViewer from '../components/ImageViewer';
import PartsSection from '../components/PartsSection';
import ManualsSection from '../components/ManualsSection';
import ServicesSection from '../components/ServicesSection';
import MaintenanceSection from '../components/MaintenanceSection';
import SlideMenu from '../components/SlideMenu';
import { COLORS } from '../theme';
import PhotosSection from '../components/PhotosSection';

const TABS = ['Info', 'Photos', 'Parts', 'Manuals', 'Services', 'Maintenance'];

export default function MotorcycleDetailScreen({ route, navigation }) {
  const { motorcycleId } = route.params;
  const insets = useSafeAreaInsets();
  const [motorcycle, setMotorcycle] = useState(null);
  const [activeTab, setActiveTab] = useState('Info');
  const [menuVisible, setMenuVisible] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editYear, setEditYear] = useState('');
  const [editMake, setEditMake] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editEngineSize, setEditEngineSize] = useState('');
  const [editVin, setEditVin] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editMileageBought, setEditMileageBought] = useState('');
  const [editMileageCurrent, setEditMileageCurrent] = useState('');

  const [updatingMileage, setUpdatingMileage] = useState(false);
  const [newMileage, setNewMileage] = useState('');

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);

  const openViewer = (uri) => { setViewerImage(uri); setViewerVisible(true); };

  const getMainPhotoUri = (bike) => {
    const photos = bike.photos || [];
    const idx = bike.mainPhotoIndex ?? -1;
    if (photos.length > 0 && idx >= 0 && idx < photos.length) return photos[idx];
    return photos.length > 0 ? photos[0] : bike.imageUri || null;
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const bikes = await loadMotorcycles();
        const bike = bikes.find((b) => b.id === motorcycleId);
        if (bike) {
          setMotorcycle(bike);
          setEditYear(bike.year);
          setEditMake(bike.make);
          setEditModel(bike.model);
          setEditEngineSize(bike.engineSize);
          setEditVin(bike.vin || '');
          setEditPurchaseDate(bike.purchaseDate || '');
          setEditMileageBought(bike.mileageBought || '');
          setEditMileageCurrent(bike.mileageCurrent || bike.mileageBought || '');
          setNewMileage(bike.mileageCurrent || bike.mileageBought || '');
        }
      })();
    }, [motorcycleId])
  );

  if (!motorcycle) return <View style={styles.loading}><Text>Loading...</Text></View>;

  const milesRidden = (() => {
    const c = parseInt(motorcycle.mileageCurrent || motorcycle.mileageBought || '0', 10);
    const b = parseInt(motorcycle.mileageBought || '0', 10);
    const d = c - b;
    return d >= 0 ? d : 0;
  })();
  const mainPhotoUri = getMainPhotoUri(motorcycle);

  const handleSaveEdit = async () => {
    if (!editMake.trim() || !editModel.trim()) { Alert.alert('Missing Info', 'Make and model are required.'); return; }
    const updated = { ...motorcycle, year: editYear.trim(), make: editMake.trim(), model: editModel.trim(), engineSize: editEngineSize.trim(), vin: editVin.trim(), purchaseDate: editPurchaseDate.trim(), mileageBought: editMileageBought.trim(), mileageCurrent: editMileageCurrent.trim() || editMileageBought.trim() };
    await updateMotorcycle(updated);
    setMotorcycle(updated);
    setNewMileage(updated.mileageCurrent);
    setEditing(false);
  };

  const handleUpdateMileage = async () => {
    const val = newMileage.trim();
    if (!val) { Alert.alert('Missing', 'Please enter the current mileage.'); return; }
    const updated = { ...motorcycle, mileageCurrent: val };
    await updateMotorcycle(updated);
    setMotorcycle(updated);
    setUpdatingMileage(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Motorcycle', `Remove this ${motorcycle.make} ${motorcycle.model}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMotorcycle(motorcycle.id); navigation.goBack(); }},
    ]);
  };

  const renderInfo = () => {
    if (editing) {
      return (
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Year</Text>
          <TextInput style={styles.editInput} value={editYear} onChangeText={setEditYear} keyboardType="number-pad" />
          <Text style={styles.sectionLabel}>Make</Text>
          <TextInput style={styles.editInput} value={editMake} onChangeText={setEditMake} />
          <Text style={styles.sectionLabel}>Model</Text>
          <TextInput style={styles.editInput} value={editModel} onChangeText={setEditModel} />
          <Text style={styles.sectionLabel}>Engine Size (cc)</Text>
          <TextInput style={styles.editInput} value={editEngineSize} onChangeText={setEditEngineSize} keyboardType="number-pad" />
          <Text style={styles.sectionLabel}>VIN</Text>
          <TextInput style={styles.editInput} value={editVin} onChangeText={setEditVin} autoCapitalize="characters" />
          <Text style={styles.sectionLabel}>Purchase Date</Text>
          <TextInput style={styles.editInput} value={editPurchaseDate} onChangeText={setEditPurchaseDate} />
          <Text style={styles.sectionLabel}>Mileage When Bought</Text>
          <TextInput style={styles.editInput} value={editMileageBought} onChangeText={setEditMileageBought} keyboardType="number-pad" />
          <Text style={styles.sectionLabel}>Current Mileage</Text>
          <TextInput style={styles.editInput} value={editMileageCurrent} onChangeText={setEditMileageCurrent} keyboardType="number-pad" />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.infoCard}>
          {mainPhotoUri && (
            <TouchableOpacity onPress={() => openViewer(mainPhotoUri)}>
              <Image source={{ uri: mainPhotoUri }} style={styles.bikePhoto} />
            </TouchableOpacity>
          )}
          <Text style={styles.bikeTitle}>{motorcycle.year} {motorcycle.make} {motorcycle.model}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>Year</Text><Text style={styles.infoValue}>{motorcycle.year || '-'}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>Make</Text><Text style={styles.infoValue}>{motorcycle.make}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>Model</Text><Text style={styles.infoValue}>{motorcycle.model}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>Engine</Text><Text style={styles.infoValue}>{motorcycle.engineSize || '-'} cc</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>VIN</Text><Text style={styles.infoValueSmall}>{motorcycle.vin || '-'}</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoLabel}>Purchase Date</Text><Text style={styles.infoValueSmall}>{motorcycle.purchaseDate || '-'}</Text></View>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}><Text style={styles.editBtnText}>Edit Info</Text></TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}><Text style={styles.deleteBtnText}>Delete</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.mileageCard}>
          <Text style={styles.mileageTitle}>Mileage</Text>
          <View style={styles.mileageRow}>
            <View style={styles.mileageItem}>
              <Text style={styles.mileageLabel}>When Bought</Text>
              <Text style={styles.mileageValue}>{motorcycle.mileageBought || '0'} mi</Text>
            </View>
            <View style={styles.mileageItem}>
              <Text style={styles.mileageLabel}>Current</Text>
              {updatingMileage ? (
                <View style={styles.mileageEditRow}>
                  <TextInput style={styles.mileageInput} value={newMileage} onChangeText={setNewMileage} keyboardType="number-pad" autoFocus />
                  <TouchableOpacity style={styles.mileageSaveBtn} onPress={handleUpdateMileage}><Text style={styles.mileageSaveText}>Save</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setUpdatingMileage(false)}><Text style={styles.mileageCancelText}>Cancel</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setUpdatingMileage(true)}><Text style={styles.mileageValue}>{motorcycle.mileageCurrent || motorcycle.mileageBought || '0'} mi ✎</Text></TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.mileageDivider} />
          <View style={styles.mileageTotal}>
            <Text style={styles.mileageTotalLabel}>Total Miles Ridden</Text>
            <Text style={styles.mileageTotalValue}>{milesRidden.toLocaleString()} mi</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{motorcycle.make} {motorcycle.model}</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ width: 60, alignItems: 'flex-end', paddingRight: 8 }}>
            <Text style={{ fontSize: 28, color: '#fff' }}>☰</Text>
          </TouchableOpacity>
      </View>
      <SlideMenu
        visible={menuVisible}
        items={TABS}
        activeItem={activeTab}
        onSelect={setActiveTab}
        onClose={() => setMenuVisible(false)}
      />
      <ScrollView style={styles.content} contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 24 }]}>
        {activeTab === 'Info' && renderInfo()}
        {activeTab === 'Photos' && <PhotosSection motorcycle={motorcycle} onUpdate={setMotorcycle} />}
        {activeTab === 'Parts' && <PartsSection motorcycle={motorcycle} onUpdate={setMotorcycle} />}
        {activeTab === 'Manuals' && <ManualsSection motorcycle={motorcycle} onUpdate={setMotorcycle} />}
        {activeTab === 'Services' && <ServicesSection motorcycle={motorcycle} onUpdate={setMotorcycle} />}
        {activeTab === 'Maintenance' && <MaintenanceSection motorcycle={motorcycle} onUpdate={setMotorcycle} />}
      </ScrollView>
      <ImageViewer visible={viewerVisible} imageUri={viewerImage} onClose={() => setViewerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, paddingHorizontal: 16, backgroundColor: COLORS.headerBg, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  backBtn: { fontSize: 17, color: COLORS.bronzeLight, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentInner: { padding: 16 },
  infoCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 24, borderWidth: 1, borderColor: COLORS.cardBorder, marginBottom: 16 },
  bikePhoto: { width: '100%', height: 200, borderRadius: 10, marginBottom: 16 },
  bikeTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 24, textAlign: 'center' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  infoItem: { width: '50%', marginBottom: 16 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  infoValue: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  infoValueSmall: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 12 },
  editBtn: { flex: 1, backgroundColor: COLORS.bronze, borderRadius: 10, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  deleteBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.red, borderRadius: 10, padding: 14, alignItems: 'center' },
  deleteBtnText: { color: COLORS.red, fontSize: 15, fontWeight: '600' },
  mileageCard: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: COLORS.cardBorder },
  mileageTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  mileageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mileageItem: { flex: 1 },
  mileageLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  mileageValue: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  mileageEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  mileageInput: { borderWidth: 1, borderColor: COLORS.bronze, borderRadius: 6, padding: 6, fontSize: 16, fontWeight: '700', color: COLORS.text, width: 90, textAlign: 'center' },
  mileageSaveBtn: { backgroundColor: COLORS.bronze, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  mileageSaveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  mileageCancelText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500', marginLeft: 4 },
  mileageDivider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 16 },
  mileageTotal: { alignItems: 'center' },
  mileageTotalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  mileageTotalValue: { fontSize: 28, fontWeight: '800', color: COLORS.bronze, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  editInput: { borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 8, padding: 12, fontSize: 16, color: COLORS.text, marginBottom: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: COLORS.bronze, borderRadius: 10, padding: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
