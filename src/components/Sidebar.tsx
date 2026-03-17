'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallTracker } from '@/lib/store';

const NAV_ITEMS = [
  { href: '/email', label: 'Email', icon: 'mail' },
  { href: '/actions', label: 'Actions', icon: 'zap' },
  { href: '/activity', label: 'Activity', icon: 'activity' },
  { href: '/', label: 'Dashboard', icon: 'grid' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/kanban', label: 'Board', icon: 'columns' },
  { href: '/list', label: 'All Saves', icon: 'list' },
  { href: '/todo', label: 'To-Do', icon: 'check-square' },
  { href: '/notes', label: 'Notes', icon: 'file-text' },
  { href: '/commission', label: 'Commission', icon: 'dollar-sign' },
  { href: '/tracker', label: 'Save Desk', icon: 'shield' },
];

// Simple SVG icons inline (no dependency needed)
function NavIcon({ icon }: { icon: string }) {
  // Return simple SVG paths for each icon type
  const icons: Record<string, React.ReactNode> = {
    'mail': <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    'activity': <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    'grid': <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
    'calendar': <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    'columns': <><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></>,
    'list': <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    'check-square': <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
    'dollar-sign': <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
    'file-text': <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    'shield': <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    'zap': <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[icon]}
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { openImportModal } = useCallTracker();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">DearDoc</h1>
        <p className="sidebar-subtitle">Command Center</p>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <NavIcon icon={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="import-btn" onClick={openImportModal}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Import Data</span>
        </button>
      </div>
    </aside>
  );
}
