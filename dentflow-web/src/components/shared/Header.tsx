'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, LogOut, Settings as SettingsIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title = 'Dashboard', onMenuClick }) => {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
  };

  // Ambil initial untuk avatar
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'U';
  const userRole = user?.role || 'Admin';
  const roleLabel = userRole === 'ADMIN_BRANCH' ? 'Admin' : userRole;

  return (
    <header className="h-16 bg-white border-b border-neutral flex items-center px-4 md:px-6 shadow-sm sticky top-0 z-30">
      {/* Tombol hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg hover:bg-neutral transition-colors mr-2"
        aria-label="Toggle menu"
      >
        <Menu size={22} className="text-gray-600" />
      </button>

      {/* Logo / Title */}
      <div className="flex-1">
        <h1 className="text-lg md:text-xl font-bold text-primary">{title}</h1>
      </div>

      {/* User Profile */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 rounded-lg hover:bg-neutral transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
            {userInitial}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-gray-800 leading-tight">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500">{roleLabel}</p>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-neutral overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral bg-neutral/30">
              <p className="text-sm font-medium text-gray-800">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500">{user?.email || 'user@clinic.com'}</p>
            </div>
            <div className="py-1">
              <Link
                href="/admin/profile"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-neutral transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <User size={16} />
                Profil
              </Link>
              <Link
                href="/admin/settings"
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-neutral transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <SettingsIcon size={16} />
                Pengaturan
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors border-t border-neutral"
              >
                <LogOut size={16} />
                Keluar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
