import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { addMotorcycle } from '../storage';
import { COLORS } from '../theme';

export default function AddMotorcycleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [engineSize, setEngineSize] = useState('');
  const [vin, setVin] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [mileageBought, setMileageBought] = useState('');
  const [imageUri, setImageUri] = useState(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera roll access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleAdd = async () => {
    if (!make.trim() || !model.trim()) { Alert.alert('Missing Info', 'Please enter at least the make and model.'); return; }
    const newBike = { year: year.trim(), make: make.trim(), model: model.trim(), engineSize: engineSize.trim(), vin: vin.trim(), purchaseDate: purchaseDate.trim(), mileageBought: mileageBought.trim(), mileageCurrent: mileageBought.trim() || '', imageUri: imageUri || null };
    const saved = await addMotorcycle(newBike);
    setYear(''); setMake(''); setModel(''); setEngineSize(''); setVin(''); setPurchaseDate(''); setMileageBought(''); setImageUri(null);
    navigation.navigate('MotorcyclesTab', { screen: 'MotorcycleDetail', params: { motorcycleId: saved.id } });
    Alert.alert('Success', `${saved.make} ${saved.model} has been added!`);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.form, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Add a Motorcycle</Text>
        <Text style={styles.label}>Photo</Text>
        {imageUri && <Image source={{ uri: imageUri }} style={styles.bikePhoto} />}
        <View style={styles.imageRow}>
          <TouchableOpacity style={styles.imageBtn} onPress={pickPhoto}><Text style={styles.imageBtnText}>📷 Pick Photo</Text></TouchableOpacity>
          <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}><Text style={styles.imageBtnText}>📸 Take Photo</Text></TouchableOpacity>
          {imageUri && <TouchableOpacity style={styles.imageBtn} onPress={() => setImageUri(null)}><Text style={styles.imageBtnText}>🗑 Remove</Text></TouchableOpacity>}
        </View>
        <Text style={styles.label}>Year</Text>
        <TextInput style={styles.input} placeholder="e.g. 2025" value={year} onChangeText={setYear} keyboardType="number-pad" />
        <Text style={styles.label}>Make</Text>
        <TextInput style={styles.input} placeholder="e.g. Honda" value={make} onChangeText={setMake} />
        <Text style={styles.label}>Model</Text>
        <TextInput style={styles.input} placeholder="e.g. CB650R" value={model} onChangeText={setModel} />
        <Text style={styles.label}>Engine Size (cc)</Text>
        <TextInput style={styles.input} placeholder="e.g. 649" value={engineSize} onChangeText={setEngineSize} keyboardType="number-pad" />
        <Text style={styles.label}>VIN Number</Text>
        <TextInput style={styles.input} placeholder="e.g. 1HGCM82633A004352" value={vin} onChangeText={setVin} autoCapitalize="characters" />
        <Text style={styles.label}>Purchase Date</Text>
        <TextInput style={styles.input} placeholder="e.g. 2025-06-16" value={purchaseDate} onChangeText={setPurchaseDate} />
        <Text style={styles.label}>Mileage When Bought</Text>
        <TextInput style={styles.input} placeholder="e.g. 0 (for new)" value={mileageBought} onChangeText={setMileageBought} keyboardType="number-pad" />
        <TouchableOpacity style={styles.button} onPress={handleAdd}><Text style={styles.buttonText}>Add Motorcycle</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  form: { padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text, marginBottom: 24, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginLeft: 4 },
  bikePhoto: { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  imageRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  imageBtn: { backgroundColor: COLORS.card, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  imageBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 10, padding: 14, fontSize: 16, color: COLORS.text, marginBottom: 20 },
  button: { backgroundColor: COLORS.bronze, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
