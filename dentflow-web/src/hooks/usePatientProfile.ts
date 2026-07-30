'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientProfileApi, PatientProfile, PatientSettings, EmergencyContact, ChangePasswordData } from '@/lib/api/patientProfile';

export function usePatientProfile() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [settings, setSettings] = useState<PatientSettings | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [profileData, settingsData, contactsData] = await Promise.all([
        patientProfileApi.getProfile(),
        patientProfileApi.getSettings(),
        patientProfileApi.getEmergencyContacts(),
      ]);
      setProfile(profileData);
      setSettings(settingsData);
      setEmergencyContacts(contactsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data profil');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<PatientProfile>) => {
    try {
      setIsSaving(true);
      const updated = await patientProfileApi.updateProfile(data);
      setProfile(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal mengupdate profil');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const uploadPhoto = useCallback(async (file: File) => {
    try {
      setIsSaving(true);
      const result = await patientProfileApi.uploadPhoto(file);
      setProfile((prev) => prev ? { ...prev, photoUrl: result.photoUrl } : null);
      return result;
    } catch (err: any) {
      setError(err.message || 'Gagal upload foto');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const addEmergencyContact = useCallback(async (data: Omit<EmergencyContact, 'id'>) => {
    try {
      const newContact = await patientProfileApi.addEmergencyContact(data);
      setEmergencyContacts((prev) => [...prev, newContact]);
      return newContact;
    } catch (err: any) {
      setError(err.message || 'Gagal menambah kontak darurat');
      throw err;
    }
  }, []);

  const deleteEmergencyContact = useCallback(async (id: string) => {
    try {
      await patientProfileApi.deleteEmergencyContact(id);
      setEmergencyContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus kontak darurat');
      throw err;
    }
  }, []);

  const updateSettings = useCallback(async (data: Partial<PatientSettings>) => {
    try {
      setIsSaving(true);
      const updated = await patientProfileApi.updateSettings(data);
      setSettings(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal mengupdate pengaturan');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const changePassword = useCallback(async (data: ChangePasswordData) => {
    try {
      setIsSaving(true);
      await patientProfileApi.changePassword(data);
    } catch (err: any) {
      setError(err.message || 'Gagal ganti password');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    profile,
    settings,
    emergencyContacts,
    isLoading,
    isSaving,
    error,
    fetchAll,
    updateProfile,
    uploadPhoto,
    addEmergencyContact,
    deleteEmergencyContact,
    updateSettings,
    changePassword,
  };
}
