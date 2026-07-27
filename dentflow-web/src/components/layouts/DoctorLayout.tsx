import React, { ReactNode } from 'react';
import { Sidebar } from '../shared/Sidebar';

interface DoctorLayoutProps {
  children: ReactNode;
}

export const DoctorLayout: React.FC<DoctorLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen bg-neutral/50">
      <Sidebar role="doctor" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-neutral flex items-center px-6 shadow-sm">
          <h1 className="text-xl font-bold text-primary">DentFlow Dokter</h1>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-gray-500">drg. Siti Nurhaliza</span>
            <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">Sp.BM</span>
            <button className="text-sm text-danger hover:underline">Logout</button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};
