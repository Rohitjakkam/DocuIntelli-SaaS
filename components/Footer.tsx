import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <p className="text-center text-sm text-slate-500">
          © {new Date().getFullYear()} DocuIntelli SaaS. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
