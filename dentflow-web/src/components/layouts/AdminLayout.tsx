'use client';

import React, { useState } from 'react';
import { Sidebar } from '../shared/Sidebar';
import { Header } from '../shared/Header';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title = 'Dashboard' }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-neutral/50 overflow-hidden">
      {/* Sidebar - mobile overlay + desktop fixed */}
      <Sidebar 
        role="admin" 
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={closeSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
