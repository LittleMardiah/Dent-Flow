'use client';

import React, { ReactNode, useState } from 'react';
import { Sidebar } from '../shared/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { ConnectionStatus } from '../shared/ConnectionStatus';

interface DoctorLayoutProps {
  children: ReactNode;
}

export const DoctorLayout: React.FC<DoctorLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-neutral/50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        role="doctor" 
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-neutral flex items-center px-6 shadow-sm sticky top-0 z-30">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-neutral transition-colors mr-3"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-primary flex-1">DentFlow Dokter</h1>
          <div className="flex items-center gap-4">
            <ConnectionStatus showLabel={false} />
            <span className="text-sm text-gray-600 hidden md:inline">
              {user?.name || 'Dokter'}
            </span>
            <button
              onClick={logout}
              className="text-sm text-danger hover:underline"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
