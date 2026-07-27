import React, { ReactNode } from 'react';

interface PatientLayoutProps {
  children: ReactNode;
}

export const PatientLayout: React.FC<PatientLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-neutral/30">
      <header className="bg-white border-b border-neutral shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">DentFlow</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Halo, Pasien</span>
            <button className="text-sm text-danger">Logout</button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>
      <footer className="bg-white border-t border-neutral py-4 text-center text-sm text-gray-500">
        &copy; 2026 DentFlow. All rights reserved.
      </footer>
    </div>
  );
};
