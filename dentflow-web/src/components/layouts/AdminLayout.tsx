import React, { ReactNode } from 'react';
import { Sidebar } from '../shared/Sidebar';

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-neutral/50">
      <Sidebar role="admin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-neutral flex items-center px-6 shadow-sm">
          <h1 className="text-xl font-bold text-primary">DentFlow Admin</h1>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-gray-500">Admin Cabang A</span>
            <button className="text-sm text-danger hover:underline">Logout</button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
