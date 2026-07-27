import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-neutral mt-8 py-4 text-center text-sm text-gray-500">
      &copy; {new Date().getFullYear()} DentFlow. All rights reserved.
    </footer>
  );
};
