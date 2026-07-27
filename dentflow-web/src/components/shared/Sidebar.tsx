'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  role: 'admin' | 'doctor' | 'patient';
}

const adminMenu = [
  { label: 'Antrian', href: '/admin/queue', icon: '📋' },
  { label: 'Dokter', href: '/admin/doctors', icon: '👨‍⚕️' },
  { label: 'Pasien', href: '/admin/patients', icon: '👤' },
  { label: 'Keuangan', href: '/admin/finance', icon: '💰' },
  { label: 'Inventaris', href: '/admin/inventory', icon: '📦' },
  { label: 'Audit Log', href: '/admin/audit', icon: '📜' },
  { label: 'Pengaturan', href: '/admin/settings', icon: '⚙️' },
];

const doctorMenu = [
  { label: 'Antrian', href: '/doctor/queue', icon: '📋' },
  { label: 'Pasien', href: '/doctor/patients', icon: '👤' },
  { label: 'EMR', href: '/doctor/emr', icon: '📝' },
  { label: 'Profil', href: '/doctor/profile', icon: '⚙️' },
];

export const Sidebar: React.FC<SidebarProps> = ({ role }) => {
  const pathname = usePathname();
  const menu = role === 'admin' ? adminMenu : role === 'doctor' ? doctorMenu : [];

  return (
    <aside className="w-64 bg-white border-r border-neutral h-screen flex flex-col shadow-sm">
      <div className="p-4 border-b border-neutral h-16 flex items-center">
        <h1 className="text-xl font-bold text-primary">DentFlow</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {menu.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-neutral hover:text-primary'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-neutral text-xs text-gray-400">
        v1.0.0 • {role === 'admin' ? 'Cabang A' : role === 'doctor' ? 'Dr. Siti' : 'Patient'}
      </div>
    </aside>
  );
};
