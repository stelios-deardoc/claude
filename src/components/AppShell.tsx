'use client';

import Sidebar from './Sidebar';
import { CallTrackerProvider } from '@/lib/store';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CallTrackerProvider>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          {children}
        </main>
      </div>
    </CallTrackerProvider>
  );
}
