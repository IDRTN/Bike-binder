import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { updateMotorcycle } from '../storage';
import ImageViewer from './ImageViewer';
import { COLORS } from '../theme';

export default function PhotosSection({ motorcycle, onUpdate }) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);
  const { width } = useWindowDimensions();

  const photos = motorcycle.photos || [];
  const mainIndex = motorcycle.mainPhotoIndex ?? -1;

  const openViewer = (uri) => {
    setViewerImage(uri);
    setViewerVisible(true);
  };

  const pickPhotos = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera roll access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      const updated = { ...motorcycle };
      updated.photos = [...(updated.photos || []), ...newUris];
      // Set first photo as main if no main is set
      if (updated.mainPhotoIndex === undefined || updated.mainPhotoIndex === -1) {
        updated.mainPhotoIndex = 0;
      }
      await updateMotorcycle(updated);
      onUpdate(updated);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      const updated = { ...motorcycle };
      updated.photos = [...(updated.photos || []), result.assets[0].uri];
      if (updated.mainPhotoIndex === undefined || updated.mainPhotoIndex === -1) {
        updated.mainPhotoIndex = 0;
      }
      await updateMotorcycle(updated);
      onUpdate(updated);
    }
  };

  const setAsMain = async (index) => {
    const updated = { ...motorcycle, mainPhotoIndex: index };
    await updateMotorcycle(updated);
    onUpdate(updated);
  };

  const removePhoto = (index) => {
    Alert.alert('Remove Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = { ...motorcycle };
          updated.photos = updated.photos.filter((_, i) => i !== index);
          // Adjust mainPhotoIndex if needed
          if (updated.mainPhotoIndex === index) {
            updated.mainPhotoIndex = updated.photos.length > 0 ? 0 : -1;
          } else if (updated.mainPhotoIndex > index) {
            updated.mainPhotoIndex -= 1;
          }
          await updateMotorcycle(updated);
          onUpdate(updated);
        },
      },
    ]);
  };

  const numColumns = width >= 600 ? 4 : 3;
  const gap = 6;
  const photoSize = (width - 32 - gap * (numColumns - 1)) / numColumns;

  const renderPhoto = ({ item, index }) => {
    const isMain = index === mainIndex;
    return (
      <TouchableOpacity
        style={[styles.photoWrapper, { width: photoSize, height: photoSize }]}
        onPress={() => isMain ? openViewer(item) : setAsMain(index)}
        onLongPress={() => removePhoto(index)}
      >
        <Image source={{ uri: item }} style={styles.photo} />
        {isMain && (
          <View style={styles.mainBadge}>
            <Text style={styles.mainBadgeText}>★ Main</Text>
          </View>
        )}
        {!isMain && (
          <View style={styles.setMainHint}>
            <Text style={styles.setMainHintText}>Set as Main</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Motorcycle Photos ({photos.length})</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={pickPhotos}>
          <Text style={styles.actionBtnText}>📷 Pick Photos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
          <Text style={styles.actionBtnText}>📸 Take Photo</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Tap a photo to set as main • Long-press to delete</Text>

      {photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No photos yet</Text>
          <Text style={styles.emptySub}>Add photos of your motorcycle from different angles!</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderPhoto}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={styles.grid}
          scrollEnabled={false}
        />
      )}

      <ImageViewer visible={viewerVisible} imageUri={viewerImage} onClose={() => setViewerVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  header: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  hint: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 },
  grid: { gap: 6 },
  photoWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: { width: '100%', height: '100%', resizeMode: 'cover' },
  mainBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: COLORS.bronze,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  setMainHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  setMainHintText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary },
  emptySub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },
});
