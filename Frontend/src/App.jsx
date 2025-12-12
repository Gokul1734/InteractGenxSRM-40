import React, { useState } from 'react';
import AuthPage from './pages/AuthPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeKey, setActiveKey] = useState('home');

  if (!user) {
    return (
      <AuthPage
        onLogin={({ name, email }) => {
          // Later: check in DB
          setUser({ name, email });
          setActiveKey('home');
        }}
        onSignup={({ name, email }) => {
          // Later: add to DB
          setUser({ name, email });
          setActiveKey('home');
        }}
      />
    );
  }

  return (
    <DashboardPage
      user={user}
      activeKey={activeKey}
      onNavigate={setActiveKey}
      onLogout={() => {
        setUser(null);
        setActiveKey('home');
      }}
    />
  );
}
