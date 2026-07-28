'use client';

import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <AdminLayout title="Pengaturan">
      <h1 className="text-2xl font-bold">Pengaturan</h1>
      <p className="text-gray-500 mt-2">Konfigurasi sistem dan profil.</p>
    </AdminLayout>
  );
}
