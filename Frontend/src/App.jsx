import React, { useState, useEffect } from 'react';
import { 
  Users, Globe, Share2, Eye, MousePointer, Activity, 
  CheckCircle, XCircle, Clock, Monitor, Lock, UserCheck 
} from 'lucide-react';
import LoginSection from './components/LoginSection';
import SessionSelector from './components/SessionSelector';
import ShareableTabs from './components/ShareableTabs';
import LiveStatus from './components/LiveStatus';
import ToastNotification from './components/ToastNotification';

function App() {
  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([
    {
      id: 'sess-1234',
      status: 'online',
      createdAt: new Date(Date.now() - 3600000),
      viewers: 2,
      users: [
        { id: 1, name: 'John Doe', email: 'john@example.com', role: 'host' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'viewer' },
        { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'viewer' }
      ]
    }
  ]);
  const [currentSession, setCurrentSession] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [selectedTab, setSelectedTab] = useState(null);
  const [tabs, setTabs] = useState([
    {
      id: 'tab-1',
      title: 'GitHub - Homepage',
      url: 'https://github.com',
      favicon: '🔷',
      shareable: true
    },
    {
      id: 'tab-2',
      title: 'Google Search',
      url: 'https://www.google.com',
      favicon: '🔍',
      shareable: true
    },
    {
      id: 'tab-3',
      title: 'Chrome Web Store',
      url: 'chrome://extensions',
      favicon: '🛍️',
      shareable: false
    }
  ]);
  const [toasts, setToasts] = useState([]);

  // Simulate real-time events
  useEffect(() => {
    if (!user) return;

    // Simulate invite
    const inviteTimer = setTimeout(() => {
      addToast('invite', '🔔 John invited you to session sess-5678');
    }, 5000);

    // Simulate new session
    const sessionTimer = setTimeout(() => {
      const newSession = {
        id: 'sess-5678',
        status: 'online',
        createdAt: new Date(),
        viewers: 1,
        users: [
          { id: Date.now(), name: 'Alice Johnson', email: 'alice@example.com', role: 'host' }
        ]
      };
      setSessions(prev => [...prev, newSession]);
      addToast('session', '✨ New session created: sess-5678');
    }, 10000);

    // Simulate user joining session
    const userJoinTimer = setTimeout(() => {
      setSessions(prev => prev.map(s => {
        if (s.id === 'sess-1234') {
          return {
            ...s,
            users: [...(s.users || []), { id: Date.now(), name: 'Mike Brown', email: 'mike@example.com', role: 'viewer' }],
            viewers: (s.users?.length || 0) + 1
          };
        }
        return s;
      }));
      addToast('session', '👤 Mike Brown joined session sess-1234');
    }, 12000);

    // Simulate tab change
    const tabTimer = setTimeout(() => {
      if (isSharing) {
        addToast('tab', '🔄 Active tab changed to: Google Search');
      }
    }, 15000);

    // Simulate sharing status change
    const statusTimer = setTimeout(() => {
      if (currentSession) {
        addToast('status', isSharing ? '⏹️ Sharing stopped' : '▶️ Sharing started');
      }
    }, 20000);

    return () => {
      clearTimeout(inviteTimer);
      clearTimeout(sessionTimer);
      clearTimeout(userJoinTimer);
      clearTimeout(tabTimer);
      clearTimeout(statusTimer);
    };
  }, [user, currentSession, isSharing]);

  const addToast = (type, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleLogin = (name, email) => {
    setUser({ name, email });
    addToast('success', `✅ Welcome, ${name}!`);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentSession(null);
    setIsSharing(false);
    setSelectedTab(null);
    addToast('info', '👋 Logged out successfully');
  };

  const handleCreateSession = () => {
    const newSessionId = `sess-${Math.random().toString(36).substr(2, 9)}`;
    const newSession = {
      id: newSessionId,
      status: 'online',
      createdAt: new Date(),
      viewers: 0,
      users: [
        { id: Date.now(), name: user.name, email: user.email, role: 'host' }
      ]
    };
    setSessions(prev => [...prev, newSession]);
    setCurrentSession(newSession);
    addToast('session', `✨ Session created: ${newSessionId}`);
  };

  const handleJoinSession = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      // Add current user to session if not already present
      const updatedSessions = sessions.map(s => {
        if (s.id === sessionId) {
          const userExists = s.users?.some(u => u.email === user.email);
          if (!userExists) {
            return {
              ...s,
              users: [...(s.users || []), { id: Date.now(), name: user.name, email: user.email, role: 'viewer' }],
              viewers: (s.users?.length || 0) + 1
            };
          }
        }
        return s;
      });
      setSessions(updatedSessions);
      setCurrentSession(updatedSessions.find(s => s.id === sessionId));
      addToast('session', `🔗 Joined session: ${sessionId}`);
    } else {
      addToast('error', '❌ Session not found');
    }
  };

  const handleStartSharing = () => {
    if (!selectedTab) {
      addToast('error', '⚠️ Please select a tab first');
      return;
    }
    if (!selectedTab.shareable) {
      addToast('error', '⚠️ This tab cannot be shared');
      return;
    }
    setIsSharing(true);
    addToast('status', '▶️ Sharing started');
  };

  const handleStopSharing = () => {
    setIsSharing(false);
    addToast('status', '⏹️ Sharing stopped');
  };

  const handleTabSelect = (tab) => {
    setSelectedTab(tab);
    addToast('tab', `📑 Selected tab: ${tab.title}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <LoginSection onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-3 rounded-xl">
                <Share2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Co-Browsing Dashboard</h1>
                <p className="text-gray-600">Real-time view-only session sharing</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-semibold text-gray-800">{user.name}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Session Selector */}
          <SessionSelector
            sessions={sessions}
            currentSession={currentSession}
            selectedTab={selectedTab}
            isSharing={isSharing}
            tabs={tabs}
            onCreateSession={handleCreateSession}
            onJoinSession={handleJoinSession}
            onTabSelect={handleTabSelect}
            onStartSharing={handleStartSharing}
            onStopSharing={handleStopSharing}
          />

          {/* Live Status */}
          {currentSession && (
            <LiveStatus
              session={currentSession}
              isSharing={isSharing}
              selectedTab={selectedTab}
              onStopSharing={handleStopSharing}
            />
          )}

          {/* Shareable Tabs */}
          <ShareableTabs
            tabs={tabs}
            selectedTab={selectedTab}
            onTabSelect={handleTabSelect}
          />
        </div>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 space-y-3 z-50">
        {toasts.map(toast => (
          <ToastNotification
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
