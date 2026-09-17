'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  User, 
  DollarSign, 
  Package, 
  FileText, 
  Settings,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  role: 'admin' | 'doctor' | 'patient';
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const adminMenuAll = [
  { label: 'Antrian', href: '/admin/queue', icon: LayoutDashboard },
  { label: 'Dokter', href: '/admin/doctors', icon: Stethoscope },
  { label: 'Pasien', href: '/admin/patients', icon: User },
  { label: 'Keuangan', href: '/admin/finance', icon: DollarSign },
  { label: 'Inventaris', href: '/admin/inventory', icon: Package },
  { label: 'Audit Log', href: '/admin/audit', icon: FileText },
  { label: 'Pengaturan', href: '/admin/settings', icon: Settings },
];

const hideBrokenMenu = (() => {
  try {
    return process.env.NEXT_PUBLIC_HIDE_BROKEN_MENU === 'true';
  } catch {
    return false;
  }
})();

const adminMenu = hideBrokenMenu
  ? adminMenuAll.filter((item) => item.href !== '/admin/settings')
  : adminMenuAll;

const doctorMenu = [
  { label: 'Antrian', href: '/doctor/queue', icon: LayoutDashboard },
  { label: 'Pasien', href: '/doctor/patients', icon: User },
  { label: 'EMR', href: '/doctor/emr', icon: FileText },
  { label: 'Profil', href: '/doctor/profile', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ 
  role = 'admin', 
  isMobileOpen = false, 
  onMobileClose 
}) => {
  const pathname = usePathname();
  const menu = role === 'admin' ? adminMenu : role === 'doctor' ? doctorMenu : [];

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-neutral h-16 flex items-center">
        <h1 className="text-xl font-bold text-primary">DentFlow</h1>
        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {role === 'admin' ? 'Admin' : role === 'doctor' ? 'Dokter' : 'Patient'}
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menu.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-gray-600 hover:bg-neutral hover:text-primary hover:translate-x-1'
              }`}
            >
              <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
              {item.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral text-xs text-gray-400 flex justify-between">
        <span>v1.0.0</span>
        <span>{role === 'admin' ? 'Cabang A' : role === 'doctor' ? 'Dr. Siti' : ''}</span>
      </div>
    </>
  );

  // Untuk desktop: sidebar fixed
  // Untuk mobile: sidebar overlay
  if (isMobileOpen !== undefined) {
    // Mobile version (overlay)
    return (
      <>
        {/* Backdrop */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onMobileClose}
          />
        )}
        {/* Sidebar */}
        <aside className={`
          fixed top-0 left-0 h-full w-72 bg-white z-50 transition-transform duration-300 ease-in-out md:hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {sidebarContent}
        </aside>
        {/* Desktop version */}
        <aside className="hidden md:flex md:flex-col md:w-64 md:h-screen md:bg-white md:border-r md:border-neutral md:shadow-sm md:sticky md:top-0">
          {sidebarContent}
        </aside>
      </>
    );
  }

  // Default: desktop only
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:h-screen md:bg-white md:border-r md:border-neutral md:shadow-sm md:sticky md:top-0">
      {sidebarContent}
    </aside>
  );
};
