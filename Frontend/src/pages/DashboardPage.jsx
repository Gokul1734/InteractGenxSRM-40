import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import TopNav from '../components/TopNav.jsx';
import SessionCard from '../components/SessionCard.jsx';
import CreateSessionModal from '../components/CreateSessionModal.jsx';
import InviteModal from '../components/InviteModal.jsx';
import InvitationsPanel from '../components/InvitationsPanel.jsx';
import LiveSessionView from '../components/LiveSessionView.jsx';
import { userAPI, sessionAPI } from '../services/api.js';

function Panel({ title, children, action }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
          {title}
        </div>
        {action}
      </div>
      <div className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

export default function DashboardPage({ user, activeKey, onNavigate, onLogout }) {
  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState('');

  // Modal states
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(null);
  const [showInvitations, setShowInvitations] = useState(false);

  // Live session view
  const [liveSession, setLiveSession] = useState(null);

  // Fetch user's sessions
  const fetchSessions = useCallback(async () => {
    if (!user?.user_code) return;
    
    setLoadingSessions(true);
    setSessionsError('');

    try {
      const response = await userAPI.getSessions(user.user_code);
      setSessions(response.data || []);
    } catch (err) {
      setSessionsError(err.message || 'Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, [user?.user_code]);

  useEffect(() => {
    if (activeKey === 'sessions') {
      fetchSessions();
    }
  }, [activeKey, fetchSessions]);

  // Handlers
  const handleSessionCreated = (newSession) => {
    setSessions(prev => [newSession, ...prev]);
  };

  const handleInvitationAccepted = (data) => {
    // Refresh sessions after accepting an invitation
    fetchSessions();
    setShowInvitations(false);
    // Navigate to the session
    if (data?.session_code) {
      const session = sessions.find(s => s.session_code === data.session_code);
      if (session) {
        setLiveSession(session);
      }
    }
  };

  const handleDeleteSession = async (session) => {
    if (!confirm(`Are you sure you want to delete "${session.session_name || session.session_code}"?`)) {
      return;
    }

    try {
      await sessionAPI.delete(session.session_code);
      setSessions(prev => prev.filter(s => s.session_code !== session.session_code));
    } catch (err) {
      alert(err.message || 'Failed to delete session');
    }
  };

  const handleJoinLive = (session) => {
    setLiveSession(session);
  };

  // If viewing a live session, show the live view
  if (liveSession) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-background)' }}>
        <TopNav 
          activeKey={activeKey} 
          onNavigate={onNavigate} 
          user={user} 
          onLogout={onLogout}
          onNotificationClick={() => setShowInvitations(true)}
        />
        <div className="flex-1 overflow-hidden">
          <LiveSessionView
            session={liveSession}
            user={user}
            onBack={() => setLiveSession(null)}
          />
        </div>

        {/* Invitations Modal */}
        {showInvitations && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={(e) => e.target === e.currentTarget && setShowInvitations(false)}
          >
            <div className="w-full max-w-md">
              <InvitationsPanel
                user={user}
                onAccept={handleInvitationAccepted}
              />
              <button
                onClick={() => setShowInvitations(false)}
                className="w-full mt-3 px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <TopNav 
        activeKey={activeKey} 
        onNavigate={onNavigate} 
        user={user} 
        onLogout={onLogout}
        onNotificationClick={() => setShowInvitations(true)}
      />

      <main className="w-full px-8 py-8">
        {activeKey === 'home' && (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Welcome Back">
                <p>
                  Hello, <span style={{ color: 'var(--color-text-primary)' }}>{user?.name}</span>!
                </p>
                <p className="mt-2">
                  Your user code is{' '}
                  <code 
                    className="px-2 py-1 rounded text-sm"
                    style={{ 
                      background: 'var(--color-surface-dark)',
                      color: 'var(--color-text-title)',
                    }}
                  >
                    {user?.user_code}
                  </code>
                </p>
                <p className="mt-2 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  Share this code with others so they can invite you to sessions.
                </p>
              </Panel>

              <Panel title="Quick Actions">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowCreateSession(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      background: 'var(--color-primary)',
                      border: '1px solid var(--color-primary-border)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <Plus size={16} />
                    Create Session
                  </button>
                  <button
                    onClick={() => onNavigate('sessions')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    View All Sessions
                  </button>
                  <button
                    onClick={() => setShowInvitations(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Check Invitations
                  </button>
                </div>
              </Panel>
            </div>

            {/* Pending Invitations */}
            <InvitationsPanel
              user={user}
              onAccept={handleInvitationAccepted}
            />
          </div>
        )}

        {activeKey === 'sessions' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-text-title)' }}
                >
                  Your Sessions
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Sessions you've created or joined
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchSessions}
                  disabled={loadingSessions}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowCreateSession(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    background: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <Plus size={16} />
                  New Session
                </button>
              </div>
            </div>

            {/* Error */}
            {sessionsError && (
              <div 
                className="flex items-center gap-2 px-4 py-3 rounded-lg"
                style={{
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  color: 'var(--color-error-text)',
                }}
              >
                <AlertCircle size={16} />
                {sessionsError}
              </div>
            )}

            {/* Loading */}
            {loadingSessions ? (
              <div className="flex flex-col items-center py-12">
                <Loader2 
                  size={32} 
                  className="animate-spin mb-3"
                  style={{ color: 'var(--color-primary)' }}
                />
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  Loading sessions...
                </p>
              </div>
            ) : sessions.length === 0 ? (
              <div 
                className="text-center py-12 rounded-2xl"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--color-surface-dark)' }}
                >
                  <Plus size={24} style={{ color: 'var(--color-text-tertiary)' }} />
                </div>
                <h3 
                  className="text-lg font-medium mb-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  No sessions yet
                </h3>
                <p className="mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  Create a session to start collaborative browser tracking
                </p>
                <button
                  onClick={() => setShowCreateSession(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
                  style={{
                    background: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-border)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <Plus size={16} />
                  Create Your First Session
                </button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.session_code || session._id}
                    session={session}
                    isCreator={session.created_by?.user_code === user.user_code}
                    onInvite={(s) => setShowInviteModal(s)}
                    onView={(s) => handleJoinLive(s)}
                    onJoinLive={handleJoinLive}
                    onDelete={handleDeleteSession}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeKey === 'pages' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Navigation Pages">
              This will show captured navigation pages, grouped by session. 
              Join a live session to see real-time page navigation.
            </Panel>
            <Panel title="Filters">
              Filter by domain, date range, and event types will be available soon.
            </Panel>
          </div>
        )}

        {activeKey === 'ai' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="AI Studio">
              Workspace for running AI workflows on recorded data (coming soon).
            </Panel>
            <Panel title="Notes">
              We'll wire this later once the data model and ingestion stabilize.
            </Panel>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateSession && (
        <CreateSessionModal
          user={user}
          onClose={() => setShowCreateSession(false)}
          onCreated={handleSessionCreated}
        />
      )}

      {showInviteModal && (
        <InviteModal
          session={showInviteModal}
          user={user}
          onClose={() => setShowInviteModal(null)}
          onInvited={() => {/* Optional: show success toast */}}
        />
      )}

      {showInvitations && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setShowInvitations(false)}
        >
          <div className="w-full max-w-md">
            <InvitationsPanel
              user={user}
              onAccept={handleInvitationAccepted}
            />
            <button
              onClick={() => setShowInvitations(false)}
              className="w-full mt-3 px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
