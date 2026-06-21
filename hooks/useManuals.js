import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { updateMotorcycle } from '../storage';
import { pickPDF, pickImage, deleteFile } from '../utils/pdfStorage';

export default function useManuals(motorcycle, onUpdate) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    id: null, title: '', fileUri: null, fileName: '',
    chapter: '', section: '', page: '',
  });
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setFormData({ id: null, title: '', fileUri: null, fileName: '', chapter: '', section: '', page: '' });
  }, []);

  const openAddForm = useCallback(() => { resetForm(); setShowForm(true); }, [resetForm]);

  const openEditForm = useCallback((m) => {
    setFormData({ id: m.id, title: m.title || '', fileUri: m.fileUri || null, fileName: m.fileName || '', chapter: m.chapter || '', section: m.section || '', page: m.page || '' });
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => { setShowForm(false); resetForm(); }, [resetForm]);

  const handlePickPDF = useCallback(async () => {
    const r = await pickPDF();
    if (r) setFormData(p => ({ ...p, fileUri: r.uri, fileName: r.name }));
  }, []);

  const handlePickImage = useCallback(async () => {
    const r = await pickImage();
    if (r) setFormData(p => ({ ...p, fileUri: r.uri, fileName: r.name }));
  }, []);

  const handleRemoveFile = useCallback(() => {
    setFormData(p => ({ ...p, fileUri: null, fileName: '' }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.title.trim()) { Alert.alert('Missing Info', 'Enter a title.'); return; }
    if (!formData.fileUri) { Alert.alert('Missing Info', 'Upload a file.'); return; }
    setSaving(true);
    try {
      const updated = { ...motorcycle };
      const manuals = [...(updated.manuals || [])];
      const entry = { title: formData.title.trim(), fileUri: formData.fileUri, fileName: formData.fileName, chapter: formData.chapter.trim(), section: formData.section.trim(), page: formData.page.trim() };
      if (formData.id) {
        const idx = manuals.findIndex(m => m.id === formData.id);
        if (idx !== -1) manuals[idx] = { ...manuals[idx], ...entry };
      } else {
        manuals.push({ id: Date.now().toString(), ...entry });
      }
      updated.manuals = manuals;
      await updateMotorcycle(updated);
      onUpdate(updated);
      closeForm();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }, [motorcycle, formData, onUpdate, closeForm]);

  const handleDelete = useCallback((id) => {
    const manual = (motorcycle.manuals || []).find(m => m.id === id);
    Alert.alert('Remove Manual', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          if (manual?.fileUri) await deleteFile(manual.fileUri);
          const updated = { ...motorcycle };
          updated.manuals = (updated.manuals || []).filter(m => m.id !== id);
          await updateMotorcycle(updated);
          onUpdate(updated);
        } catch (err) { Alert.alert('Error', err.message); }
      }},
    ]);
  }, [motorcycle, onUpdate]);

  const manuals = motorcycle.manuals || [];
  const filtered = search
    ? manuals.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || (m.fileName && m.fileName.toLowerCase().includes(search.toLowerCase())))
    : manuals;

  const setField = useCallback((f, v) => setFormData(p => ({ ...p, [f]: v })), []);

  return {
    showForm, search, formData, saving, manuals, filtered,
    setSearch, setField, openAddForm, openEditForm, closeForm,
    handlePickPDF, handlePickImage, handleRemoveFile, handleSave, handleDelete,
  };
}
