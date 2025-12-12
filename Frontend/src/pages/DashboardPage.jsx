import React from 'react';
import TopNav from '../components/TopNav.jsx';

function Panel({ title, children }) {
  return (
    <div
      className="rounded-2xl p-7"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="mb-4 text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
        {title}
      </div>
      <div className="text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {children}
      </div>
    </div>
  );
}

export default function DashboardPage({ user, activeKey, onNavigate, onLogout }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      <TopNav activeKey={activeKey} onNavigate={onNavigate} user={user} onLogout={onLogout} />

      <main className="w-full px-8 py-8">
        {activeKey === 'home' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Overview">
              Welcome back, <span style={{ color: 'var(--color-text-primary)' }}>{user?.name}</span>. Use the top
              navigation to explore sessions and pages.
            </Panel>
            <Panel title="System Status">
              UI is now using the matte dark theme from <code>theme.js</code>.
            </Panel>
          </div>
        )}

        {activeKey === 'sessions' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Sessions Page">
              This will list recorded sessions and allow filtering by user/session codes.
            </Panel>
            <Panel title="Actions">
              Create, view, and manage sessions (placeholder for now).
            </Panel>
          </div>
        )}

        {activeKey === 'pages' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Pages">
              This will show captured navigation pages, grouped by session (placeholder for now).
            </Panel>
            <Panel title="Filters">
              Filter by domain, date range, and event types (placeholder).
            </Panel>
          </div>
        )}

        {activeKey === 'ai' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="AI Studio">
              Workspace for running AI workflows on recorded data (placeholder for now).
            </Panel>
            <Panel title="Notes">
              We’ll wire this later once the data model and ingestion stabilize.
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
}


