import React, { useState } from 'react';
import { Plus, Link2, Clock, Circle, Monitor, Play, Square, Users } from 'lucide-react';

function SessionSelector({
  sessions,
  currentSession,
  selectedTab,
  isSharing,
  tabs,
  onCreateSession,
  onJoinSession,
  onTabSelect,
  onStartSharing,
  onStopSharing
}) {
  const [joinSessionId, setJoinSessionId] = useState('');

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (joinSessionId.trim()) {
      onJoinSession(joinSessionId.trim());
      setJoinSessionId('');
    }
  };

  const formatTime = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / 60000);
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white p-2 rounded-lg">
          <Link2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Session Manager</h2>
          <p className="text-gray-600 text-sm">Create or join a co-browsing session</p>
        </div>
      </div>

      {/* Create & Join Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Create Session */}
        <button
          onClick={onCreateSession}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all transform hover:scale-105 shadow-md"
        >
          <Plus className="w-5 h-5" />
          Create New Session
        </button>

        {/* Join Session */}
        <form onSubmit={handleJoinSubmit} className="flex gap-2">
          <input
            type="text"
            value={joinSessionId}
            onChange={(e) => setJoinSessionId(e.target.value)}
            placeholder="Enter Session ID"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Join
          </button>
        </form>
      </div>

      {/* Existing Sessions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Active Sessions</h3>
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No active sessions</p>
              <p className="text-sm">Create a new session to get started</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`p-4 border-2 rounded-lg transition-all ${
                  currentSession?.id === session.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => onJoinSession(session.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      session.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-semibold text-gray-800">{session.id}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(session.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Circle className="w-4 h-4" />
                          {session.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  {currentSession?.id === session.id && (
                    <span className="px-3 py-1 bg-blue-500 text-white text-sm rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                
                {/* Users in Session */}
                {session.users && session.users.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Monitor className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-700">
                        Users in Session ({session.users.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {session.users.map((user) => (
                        <div 
                          key={user.id} 
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                              user.role === 'host' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'host'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role === 'host' ? '👑 Host' : '👁️ Viewer'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tab Selector & Sharing Controls */}
      {currentSession && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Sharing Controls</h3>
          
          {/* Tab Selector */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Tab to Share
            </label>
            <select
              value={selectedTab?.id || ''}
              onChange={(e) => {
                const tab = tabs.find(t => t.id === e.target.value);
                if (tab) onTabSelect(tab);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">-- Select a tab --</option>
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id} disabled={!tab.shareable}>
                  {tab.favicon} {tab.title} {!tab.shareable ? '(Not shareable)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sharing Buttons */}
          <div className="flex gap-3">
            {!isSharing ? (
              <button
                onClick={onStartSharing}
                disabled={!selectedTab}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-all transform hover:scale-105 shadow-md"
              >
                <Play className="w-5 h-5" />
                Start Sharing
              </button>
            ) : (
              <button
                onClick={onStopSharing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-lg transition-all transform hover:scale-105 shadow-md"
              >
                <Square className="w-5 h-5" />
                Stop Sharing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionSelector;
