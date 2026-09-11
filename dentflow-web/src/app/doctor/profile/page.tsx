'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DoctorLayout } from '@/components/layouts/DoctorLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Save, Lock, LogOut, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { doctorProfileApi, DoctorProfile } from '@/lib/api/doctorProfile';

export default function DoctorProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit form
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Password form (placeholder)
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!isAuthenticated) return;

      try {
        setIsLoading(true);
        setError(null);

        const data = await doctorProfileApi.getMyProfile();
        setProfile(data);
        setPhone(data.phone || '');
        setEmail(data.email || '');
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Gagal memuat profil');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [isAuthenticated]);

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const updated = await doctorProfileApi.updateMyProfile({
        phone: phone || undefined,
        email: email || undefined,
      });

      setProfile(updated);
      setSuccess('Profil berhasil diperbarui');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Gagal menyimpan profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (authLoading || isLoading) {
    return (
      <DoctorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </DoctorLayout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DoctorLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Profil Saya</h1>
          <p className="text-sm text-gray-500">Kelola informasi profil Anda</p>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Card: Info Dokter (Read-only) */}
        <Card className="mb-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {profile ? getInitials(profile.fullName) : '?'}
            </div>

            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-bold text-gray-800">{profile?.fullName || '-'}</h2>
              <p className="text-sm text-gray-500">{profile?.specialization || '-'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-400">Lisensi:</span>{' '}
                  <span className="text-gray-700">{profile?.licenseNumber || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Cabang:</span>{' '}
                  <span className="text-gray-700">{profile?.branch?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Email:</span>{' '}
                  <span className="text-gray-700">{profile?.email || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>{' '}
                  <span className={profile?.isActive ? 'text-green-600' : 'text-red-600'}>
                    {profile?.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Card: Form Edit */}
        <Card title="Edit Profil" className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor HP</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="08123456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="dokter@dentflow.com"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Simpan Perubahan
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Card: Ganti Password (Placeholder) */}
        <Card title="Ganti Password" className="mb-6">
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              Fitur ganti password segera hadir.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                disabled
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" disabled>
                <Lock size={16} className="mr-2" />
                Ganti Password
              </Button>
            </div>
          </div>
        </Card>

        {/* Card: Aksi */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">Keluar</h3>
              <p className="text-sm text-gray-500">Keluar dari akun Anda</p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </Card>
      </div>
    </DoctorLayout>
  );
}
