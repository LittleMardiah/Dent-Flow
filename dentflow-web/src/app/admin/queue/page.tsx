'use client';

import { useAuth } from '@/context/AuthContext';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminQueuePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold">Antrian Hari Ini</h1>
      <p className="text-gray-500">Selamat datang di dashboard admin!</p>
    </AdminLayout>
  );
}
