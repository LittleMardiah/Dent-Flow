'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import {
  Building,
  MapPin,
  Phone,
  Mail,
  Clock,
  CreditCard,
  Bell,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const branchId = user?.branchId || 'A';
  const { settings, isLoading, isSaving, isVerifying, verifyResult, updateSettings, verifyWebhook, refresh } =
    useSettings({ branchId });

  // Local state for form
  const [clinicInfo, setClinicInfo] = useState({
    branchName: '',
    address: '',
    phone: '',
    email: '',
  });
  const [hours, setHours] = useState({
    openTime: '08:00',
    closeTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    daysOpen: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  });
  const [payment, setPayment] = useState({
    midtransClientKey: '',
    midtransServerKey: '',
    midtransWebhookUrl: '',
  });
  const [notifications, setNotifications] = useState({
    emailReminders: true,
    smsGateway: false,
  });

  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingLocal, setIsSavingLocal] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (settings) {
      setClinicInfo({
        branchName: settings.clinic.branchName || '',
        address: settings.clinic.address || '',
        phone: settings.clinic.phone || '',
        email: settings.clinic.email || '',
      });
      setHours({
        openTime: settings.hours.openTime || '08:00',
        closeTime: settings.hours.closeTime || '17:00',
        breakStart: settings.hours.breakStart || '12:00',
        breakEnd: settings.hours.breakEnd || '13:00',
        daysOpen: settings.hours.daysOpen || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      });
      setPayment({
        midtransClientKey: settings.payment.midtransClientKey || '',
        midtransServerKey: settings.payment.midtransServerKey || '',
        midtransWebhookUrl: settings.payment.midtransWebhookUrl || '',
      });
      setNotifications({
        emailReminders: settings.notifications.emailReminders !== undefined ? settings.notifications.emailReminders : true,
        smsGateway: settings.notifications.smsGateway || false,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSavingLocal(true);
    setSaveStatus(null);
    try {
      await updateSettings({
        clinic: clinicInfo,
        hours,
        payment,
        notifications,
      });
      setSaveStatus({ success: true, message: 'Pengaturan berhasil disimpan!' });
    } catch (err: any) {
      setSaveStatus({ success: false, message: err.message || 'Gagal menyimpan pengaturan' });
    } finally {
      setIsSavingLocal(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  const handleVerifyWebhook = async () => {
    await verifyWebhook();
    // Result will be shown via verifyResult from hook
  };

  const daysOptions = [
    { value: 'monday', label: 'Senin' },
    { value: 'tuesday', label: 'Selasa' },
    { value: 'wednesday', label: 'Rabu' },
    { value: 'thursday', label: 'Kamis' },
    { value: 'friday', label: 'Jumat' },
    { value: 'saturday', label: 'Sabtu' },
    { value: 'sunday', label: 'Minggu' },
  ];

  const toggleDay = (day: string) => {
    setHours((prev) => ({
      ...prev,
      daysOpen: prev.daysOpen.includes(day)
        ? prev.daysOpen.filter((d) => d !== day)
        : [...prev.daysOpen, day],
    }));
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Pengaturan">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AdminLayout title="Pengaturan">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Pengaturan</h2>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw size={16} className="mr-1" />
          Refresh
        </Button>
      </div>

      {/* Save status */}
      {saveStatus && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            saveStatus.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {saveStatus.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {saveStatus.message}
        </div>
      )}

      {/* Clinic Info */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Building size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Informasi Klinik</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Cabang
            </label>
            <input
              type="text"
              value={clinicInfo.branchName}
              onChange={(e) => setClinicInfo({ ...clinicInfo, branchName: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alamat
            </label>
            <input
              type="text"
              value={clinicInfo.address}
              onChange={(e) => setClinicInfo({ ...clinicInfo, address: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telepon
            </label>
            <input
              type="text"
              value={clinicInfo.phone}
              onChange={(e) => setClinicInfo({ ...clinicInfo, phone: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={clinicInfo.email}
              onChange={(e) => setClinicInfo({ ...clinicInfo, email: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>
      </Card>

      {/* Business Hours */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Jam Operasional</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buka</label>
            <input
              type="time"
              value={hours.openTime}
              onChange={(e) => setHours({ ...hours, openTime: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tutup</label>
            <input
              type="time"
              value={hours.closeTime}
              onChange={(e) => setHours({ ...hours, closeTime: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Istirahat Mulai</label>
            <input
              type="time"
              value={hours.breakStart}
              onChange={(e) => setHours({ ...hours, breakStart: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Istirahat Selesai</label>
            <input
              type="time"
              value={hours.breakEnd}
              onChange={(e) => setHours({ ...hours, breakEnd: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hari Operasional</label>
          <div className="flex flex-wrap gap-2">
            {daysOptions.map((day) => (
              <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hours.daysOpen.includes(day.value)}
                  onChange={() => toggleDay(day.value)}
                  className="accent-primary w-4 h-4"
                />
                <span className="text-sm">{day.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* Payment Settings */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Pengaturan Pembayaran</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Midtrans Client Key
            </label>
            <input
              type="text"
              value={payment.midtransClientKey}
              onChange={(e) => setPayment({ ...payment, midtransClientKey: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="SB-Mid-client-xxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Midtrans Server Key
            </label>
            <input
              type="password"
              value={payment.midtransServerKey}
              onChange={(e) => setPayment({ ...payment, midtransServerKey: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="SB-Mid-server-xxx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook URL
            </label>
            <input
              type="url"
              value={payment.midtransWebhookUrl}
              onChange={(e) => setPayment({ ...payment, midtransWebhookUrl: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="https://api.dentflow.com/webhooks/midtrans"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleVerifyWebhook}
              disabled={isVerifying}
            >
              {isVerifying ? 'Memproses...' : 'Verifikasi Webhook'}
            </Button>
            {verifyResult && (
              <span className={`text-sm ${verifyResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {verifyResult.success ? '✅ ' : '❌ '} {verifyResult.message}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Pengaturan Notifikasi</h3>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.emailReminders}
              onChange={(e) => setNotifications({ ...notifications, emailReminders: e.target.checked })}
              className="accent-primary w-4 h-4"
            />
            <span className="text-sm">Email Reminder (pengingat appointment)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications.smsGateway}
              onChange={(e) => setNotifications({ ...notifications, smsGateway: e.target.checked })}
              className="accent-primary w-4 h-4"
            />
            <span className="text-sm">SMS Gateway (notifikasi via SMS)</span>
          </label>
        </div>
      </Card>

      {/* API Docs */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ExternalLink size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Dokumentasi API</h3>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Akses dokumentasi API Swagger untuk pengembang.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('/api/docs', '_blank')}
        >
          Buka API Docs
        </Button>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSavingLocal || isSaving}
        >
          <Save size={16} className="mr-1" />
          {isSavingLocal || isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </Button>
      </div>
    </AdminLayout>
  );
}
