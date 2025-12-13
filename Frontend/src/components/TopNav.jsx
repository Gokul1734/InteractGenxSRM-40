import React, { useState, useEffect, useCallback } from 'react';
import { Home, LayoutGrid, Files, Sparkles, LogOut, Bell } from 'lucide-react';
import { invitationAPI } from '../services/api.js';

const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'sessions', label: 'Sessions', icon: LayoutGrid },
  { key: 'pages', label: 'Pages', icon: Files },
  { key: 'ai', label: 'AI Studio', icon: Sparkles },
];

export default function TopNav({ activeKey, onNavigate, user, onLogout, onNotificationClick }) {
  const [invitationCount, setInvitationCount] = useState(0);

  const fetchInvitationCount = useCallback(async () => {
    if (!user?.user_code) return;
    
    try {
      const response = await invitationAPI.getPending(user.user_code);
      setInvitationCount(response.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch invitation count:', err);
    }
  }, [user?.user_code]);

  useEffect(() => {
    fetchInvitationCount();
    // Poll for new invitations every 30 seconds
    const interval = setInterval(fetchInvitationCount, 30000);
    return () => clearInterval(interval);
  }, [fetchInvitationCount]);

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
            <img 
              src="/Sidekick.png" 
              alt="Sidekick Logo" 
              className="h-10 w-10 rounded-lg object-contain"
            />
            <div className="leading-tight">
              <div className="text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
                Sidekick
              </div>
              <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Co-Browsing Dashboard
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
                className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
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

        {/* Right: Notifications + User + Logout */}
        <div className="ml-auto flex items-center gap-3">
          {/* Notification Bell */}
          <button
            type="button"
            onClick={onNotificationClick}
            className="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
            style={{
              background: invitationCount > 0 ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              border: '1px solid',
              borderColor: invitationCount > 0 ? 'rgba(168, 85, 247, 0.3)' : 'var(--color-border)',
              color: invitationCount > 0 ? 'var(--color-user-purple)' : 'var(--color-text-secondary)',
            }}
          >
            <Bell size={18} />
            {invitationCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold"
                style={{ 
                  background: 'var(--color-user-purple)',
                  color: 'white',
                }}
              >
                {invitationCount > 9 ? '9+' : invitationCount}
              </span>
            )}
          </button>

          {/* User Info */}
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              {user?.name || 'User'}
            </div>
            <div className="text-xs flex items-center gap-1.5 justify-end">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {user?.email || ''}
              </span>
              {user?.user_code && (
                <code 
                  className="px-1.5 py-0.5 rounded"
                  style={{ 
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: '10px',
                  }}
                >
                  {user.user_code}
                </code>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
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

      {/* Mobile Nav */}
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
