import React from 'react';
import { Home, LayoutGrid, Files, Sparkles, LogOut } from 'lucide-react';

const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'sessions', label: 'Sessions Page', icon: LayoutGrid },
  { key: 'pages', label: 'Pages', icon: Files },
  { key: 'ai', label: 'AI Studio', icon: Sparkles },
];

export default function TopNav({ activeKey, onNavigate, user, onLogout }) {
  return (
    <header
      className="w-full border-b"
      style={{
        background: 'var(--color-surface-dark)',
        borderColor: 'var(--color-border)',
      }}
    >
      <div className="w-full flex items-center px-8 py-4 gap-6">
        {/* Left: Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className="h-10 w-10 rounded-lg"
              style={{ background: 'var(--color-primary)' }}
            />
            <div className="leading-tight">
              <div className="text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
                CoBrowser
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Dashboard
              </div>
            </div>
          </div>
        </div>

        {/* Center: Nav fills available width */}
        <nav className="hidden flex-1 items-center justify-center gap-2 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
                style={{
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-border-hover)' : 'transparent',
                }}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: User + Logout */}
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {user?.name || 'User'}
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {user?.email || ''}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
            style={{
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              border: '1px solid',
              borderColor: 'var(--color-border)',
            }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-t px-4 py-3 md:hidden"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
              style={{
                background: isActive ? 'var(--color-surface)' : 'transparent',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                border: '1px solid',
                borderColor: isActive ? 'var(--color-border-hover)' : 'transparent',
              }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}


