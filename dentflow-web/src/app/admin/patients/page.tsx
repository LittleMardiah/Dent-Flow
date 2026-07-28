'use client';

import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PatientsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

  return (
    <AdminLayout title="Pasien">
      <h1 className="text-2xl font-bold">Manajemen Pasien</h1>
      <p className="text-gray-500 mt-2">Daftar pasien dan riwayat kunjungan.</p>
    </AdminLayout>
  );
}
