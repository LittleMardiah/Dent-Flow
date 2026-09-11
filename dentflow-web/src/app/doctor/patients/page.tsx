'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { DoctorLayout } from '@/components/layouts/DoctorLayout';
import { Card } from '@/components/ui/Card';
import { Search, Users, Phone, Mail, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { doctorProfileApi, MyPatient, DoctorProfile } from '@/lib/api/doctorProfile';

export default function DoctorPatientsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [patients, setPatients] = useState<MyPatient[]>([]);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated) return;

      try {
        setIsLoading(true);
        setError(null);

        const profileData = await doctorProfileApi.getMyProfile();
        setProfile(profileData);

        const patientsData = await doctorProfileApi.getMyPatients(profileData.id);
        setPatients(patientsData);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Gagal memuat data pasien');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase();
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

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
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pasien Saya</h1>
            <p className="text-sm text-gray-500">{patients.length} pasien</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="Cari pasien (nama, telepon, email)..."
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telepon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Kunjungan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunjungan Terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      {searchQuery ? 'Tidak ada pasien ditemukan' : 'Belum ada pasien'}
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-neutral/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{patient.fullName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Phone size={14} className="text-gray-400" />
                          {patient.phone || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Mail size={14} className="text-gray-400" />
                          {patient.email || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700">{patient.totalVisits}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} className="text-gray-400" />
                          {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString('id-ID') : '-'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
