import React from 'react';
import { Briefcase } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-800">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <Briefcase className="h-8 w-8 text-sky-400" />
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">DocuIntelli SaaS</h1>
          </div>
          <p className="text-sm text-slate-400 hidden sm:block">AI-Powered Legal Document Analysis</p>
        </div>
      </div>
    </header>
  );
};
