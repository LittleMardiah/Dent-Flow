'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import { useRouter } from 'next/navigation';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  User,
  Mail,
  Phone,
  Camera,
  Plus,
  Trash2,
  Shield,
  Bell,
  Globe,
  Lock,
  LogOut,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';

export default function PatientProfilePage() {
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const {
    profile,
    settings,
    emergencyContacts,
    isLoading,
    isSaving,
    error,
    updateProfile,
    uploadPhoto,
    addEmergencyContact,
    deleteEmergencyContact,
    updateSettings,
    changePassword,
  } = usePatientProfile();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    email: '',
  });

  // Emergency contact form
  const [contactForm, setContactForm] = useState({
    name: '',
    relationship: '',
    phone: '',
  });
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Settings state
  const [localSettings, setLocalSettings] = useState({
    shareData: false,
    emailNotif: true,
    smsNotif: false,
    pushNotif: true,
    language: 'ID' as 'EN' | 'ID',
  });

  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');
  const [newAllergy, setNewAllergy] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        shareData: settings.privacy?.shareDataWithDoctors ?? false,
        emailNotif: settings.notifications?.email ?? true,
        smsNotif: settings.notifications?.sms ?? false,
        pushNotif: settings.notifications?.push ?? true,
        language: settings.language || 'ID',
      });
      setMedicalConditions(settings.medicalConditions || []);
      setAllergies(settings.allergies || []);
    }
  }, [settings]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(profileForm);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadPhoto(file);
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.name || !contactForm.phone) {
      return;
    }
    await addEmergencyContact(contactForm);
    setContactForm({ name: '', relationship: '', phone: '' });
    setIsContactModalOpen(false);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Password baru dan konfirmasi tidak cocok');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password minimal 8 karakter');
      return;
    }
    await changePassword(passwordForm);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setIsPasswordModalOpen(false);
  };

  const handleSettingsSave = async () => {
    await updateSettings({
      privacy: { shareDataWithDoctors: localSettings.shareData },
      notifications: {
        email: localSettings.emailNotif,
        sms: localSettings.smsNotif,
        push: localSettings.pushNotif,
      },
      language: localSettings.language,
      medicalConditions,
      allergies,
    });
  };

  const addCondition = () => {
    if (newCondition.trim()) {
      setMedicalConditions([...medicalConditions, newCondition.trim()]);
      setNewCondition('');
    }
  };
  const removeCondition = (idx: number) => {
    setMedicalConditions(medicalConditions.filter((_, i) => i !== idx));
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setAllergies([...allergies, newAllergy.trim()]);
      setNewAllergy('');
    }
  };
  const removeAllergy = (idx: number) => {
    setAllergies(allergies.filter((_, i) => i !== idx));
  };

  if (authLoading || isLoading) {
    return (
      <PatientLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </PatientLayout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Profil & Pengaturan</h1>
        <p className="text-gray-500 text-sm mb-6">
          Kelola informasi pribadi dan preferensi Anda.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Profile Information */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <User size={18} className="text-primary" />
            Informasi Profil
          </h2>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telepon
              </label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Photo Upload */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Camera size={18} className="text-primary" />
            Foto Profil
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary overflow-hidden">
              {profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.fullName?.charAt(0) || 'U'
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                <Camera size={14} className="mr-1" />
                Upload Foto
              </Button>
              <p className="text-xs text-gray-400 mt-1">Format: JPG, PNG, maks 2MB</p>
            </div>
          </div>
        </Card>

        {/* Emergency Contacts */}
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Phone size={18} className="text-primary" />
              Kontak Darurat
            </h2>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsContactModalOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              Tambah
            </Button>
          </div>
          {emergencyContacts.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada kontak darurat.</p>
          ) : (
            <div className="space-y-2">
              {emergencyContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-neutral/30 rounded-lg">
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-gray-500">{contact.relationship} • {contact.phone}</p>
                  </div>
                  <button
                    onClick={() => deleteEmergencyContact(contact.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Medical Conditions & Allergies */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-primary" />
            Kondisi Medis & Alergi
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kondisi Medis</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Diabetes, Hipertensi"
                />
                <Button variant="secondary" size="sm" onClick={addCondition}>
                  Tambah
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {medicalConditions.map((cond, idx) => (
                  <span key={idx} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                    {cond}
                    <button onClick={() => removeCondition(idx)} className="text-blue-600 hover:text-blue-800">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alergi</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  className="flex-1 px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="e.g. Penicillin, Latex"
                />
                <Button variant="secondary" size="sm" onClick={addAllergy}>
                  Tambah
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {allergies.map((allergy, idx) => (
                  <span key={idx} className="flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm">
                    {allergy}
                    <button onClick={() => removeAllergy(idx)} className="text-red-600 hover:text-red-800">
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Settings */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            Pengaturan
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bagikan data dengan dokter</p>
                <p className="text-sm text-gray-500">Izinkan dokter melihat riwayat medis lengkap</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.shareData}
                  onChange={(e) => setLocalSettings({ ...localSettings, shareData: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:bg-primary transition-colors"></div>
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {localSettings.shareData ? 'Ya' : 'Tidak'}
                </span>
              </label>
            </div>

            <div className="border-t border-neutral pt-4">
              <p className="font-medium mb-2">Notifikasi</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localSettings.emailNotif}
                    onChange={(e) => setLocalSettings({ ...localSettings, emailNotif: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className="text-sm">Email</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localSettings.smsNotif}
                    onChange={(e) => setLocalSettings({ ...localSettings, smsNotif: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className="text-sm">SMS</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={localSettings.pushNotif}
                    onChange={(e) => setLocalSettings({ ...localSettings, pushNotif: e.target.checked })}
                    className="accent-primary"
                  />
                  <span className="text-sm">Push Notification</span>
                </label>
              </div>
            </div>

            <div className="border-t border-neutral pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bahasa</label>
              <select
                value={localSettings.language}
                onChange={(e) => setLocalSettings({ ...localSettings, language: e.target.value as 'EN' | 'ID' })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="ID">Bahasa Indonesia</option>
                <option value="EN">English</option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSettingsSave} disabled={isSaving}>
                {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Lock size={18} className="text-primary" />
            Ganti Password
          </h2>
          <Button
            variant="secondary"
            onClick={() => setIsPasswordModalOpen(true)}
          >
            Ganti Password
          </Button>
        </Card>

        {/* Logout */}
        <Card className="mb-6 border-red-200 bg-red-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-red-700 flex items-center gap-2">
                <LogOut size={18} />
                Keluar
              </h2>
              <p className="text-sm text-red-600">Keluar dari akun Anda</p>
            </div>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm('Apakah Anda yakin ingin keluar?')) {
                  logout();
                }
              }}
            >
              <LogOut size={16} className="mr-1" />
              Logout
            </Button>
          </div>
        </Card>

        {/* Emergency Contact Modal */}
        <Modal
          isOpen={isContactModalOpen}
          onClose={() => {
            setIsContactModalOpen(false);
            setContactForm({ name: '', relationship: '', phone: '' });
          }}
          title="Tambah Kontak Darurat"
          confirmText="Simpan"
          onConfirm={handleAddContact}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
              <input
                type="text"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hubungan</label>
              <input
                type="text"
                value={contactForm.relationship}
                onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="Suami, Istri, Orang Tua..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
              <input
                type="tel"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
          </div>
        </Modal>

        {/* Change Password Modal */}
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => {
            setIsPasswordModalOpen(false);
            setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordError(null);
          }}
          title="Ganti Password"
          confirmText="Simpan"
          onConfirm={handleChangePassword}
          cancelText="Batal"
          variant="primary"
        >
          {passwordError && (
            <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm mb-3">
              {passwordError}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
              <input
                type="password"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Minimal 8 karakter</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
          </div>
        </Modal>
      </div>
    </PatientLayout>
  );
}
