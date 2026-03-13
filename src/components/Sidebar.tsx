'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallTracker } from '@/lib/store';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'grid' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/kanban', label: 'Board', icon: 'columns' },
  { href: '/list', label: 'All Saves', icon: 'list' },
  { href: '/todo', label: 'To-Do', icon: 'check-square' },
  { href: '/commission', label: 'Commission', icon: 'dollar-sign' },
];

// Simple SVG icons inline (no dependency needed)
function NavIcon({ icon }: { icon: string }) {
  // Return simple SVG paths for each icon type
  const icons: Record<string, React.ReactNode> = {
    'grid': <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
    'calendar': <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    'columns': <><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></>,
    'list': <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    'check-square': <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
    'dollar-sign': <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>,
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
