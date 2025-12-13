import React, { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeKey, setActiveKey] = useState(() => {
    // Load active tab from localStorage on mount
    const stored = localStorage.getItem('cobrowser_active_tab');
    return stored || 'home';
  });
  const [loading, setLoading] = useState(true);

  // Check for stored user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed.user_code) {
          setUser({
            name: parsed.user_name,
            email: parsed.user_email,
            user_code: parsed.user_code,
            _id: parsed._id,
            is_active: parsed.is_active,
          });
        }
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('cobrowser_active_tab', activeKey);
    }
  }, [activeKey, user]);

  const handleAuth = (userData) => {
    setUser(userData);
    setActiveKey('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setActiveKey('home');
  };

  // Show loading state briefly while checking stored user
  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-background)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div 
            className="h-10 w-10 rounded-lg animate-pulse"
            style={{ background: 'var(--color-primary)' }}
          />
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onLogin={handleAuth}
        onSignup={handleAuth}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      activeKey={activeKey}
      onNavigate={setActiveKey}
      onLogout={handleLogout}
    />
  );
}
