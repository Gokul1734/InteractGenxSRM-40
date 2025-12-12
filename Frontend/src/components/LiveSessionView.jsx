import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArrowLeft, Users, Clock, RefreshCw, Globe, 
  ExternalLink, Activity, Radio, User, Loader2,
  Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { sessionAPI } from '../services/api.js';

function MemberCard({ member, expanded, onToggle }) {
  const isRecording = member.is_recording || member.has_tracking;
  const currentState = member.current_state || member.navigation_tracking?.last_event;
  const recentEvents = member.recent_events || member.navigation_tracking?.navigation_events?.slice(-10) || [];

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'PAGE_LOADED':
      case 'PAGE_OPEN':
        return '📄';
      case 'TAB_ACTIVATED':
      case 'TAB_CREATED':
        return '📑';
      case 'TAB_CLOSED':
        return '❌';
      case 'PAGE_URL_CHANGE':
        return '🔗';
      case 'WINDOW_FOCUSED':
        return '🪟';
      default:
        return '📌';
    }
  };

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Member Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ 
              background: 'var(--color-surface-dark)',
              color: 'var(--color-text-primary)',
            }}
          >
            {member.user_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span 
                className="font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {member.user_name}
              </span>
              {isRecording && (
                <span 
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ 
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: 'var(--color-success-text)',
                  }}
                >
                  <Radio size={10} className="animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <code 
              className="text-xs"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {member.user_code}
            </code>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span 
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {member.event_count || 0} events
          </span>
          {expanded ? (
            <ChevronUp size={18} style={{ color: 'var(--color-text-tertiary)' }} />
          ) : (
            <ChevronDown size={18} style={{ color: 'var(--color-text-tertiary)' }} />
          )}
        </div>
      </button>

      {/* Current State */}
      {currentState && (
        <div 
          className="px-4 py-3 border-t"
          style={{ 
            background: 'var(--color-surface-dark)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} style={{ color: 'var(--color-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Current Page
            </span>
          </div>
          <div className="flex items-start gap-2">
            {currentState.favicon && (
              <img 
                src={currentState.favicon} 
                alt="" 
                className="w-4 h-4 mt-0.5 rounded"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <div className="flex-1 min-w-0">
              <div 
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {currentState.title || 'Untitled'}
              </div>
              <a
                href={currentState.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs truncate flex items-center gap-1 hover:underline"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                {currentState.url}
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
          {currentState.last_event_time && (
            <div 
              className="text-xs mt-2"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Last activity: {formatTime(currentState.last_event_time)}
            </div>
          )}
        </div>
      )}

      {/* Expanded: Recent Events */}
      {expanded && recentEvents.length > 0 && (
        <div 
          className="border-t max-h-64 overflow-y-auto"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div 
            className="px-4 py-2 text-xs font-medium sticky top-0"
            style={{ 
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Recent Activity
          </div>
          <div className="px-4 pb-3 space-y-2">
            {[...recentEvents].reverse().slice(0, 10).map((event, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-2 text-sm"
              >
                <span className="text-base">{getEventIcon(event.event_type)}</span>
                <div className="flex-1 min-w-0">
                  <div 
                    className="text-xs font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {event.event_type?.replace(/_/g, ' ')}
                  </div>
                  <div 
                    className="text-xs truncate"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {event.context?.title || event.context?.url || '—'}
                  </div>
                </div>
                <span 
                  className="text-xs shrink-0"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {formatTime(event.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveSessionView({ session, user, onBack }) {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedMembers, setExpandedMembers] = useState(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const lastUpdateRef = useRef(null);
  const intervalRef = useRef(null);

  const fetchLiveData = useCallback(async () => {
    try {
      const response = await sessionAPI.getLiveUpdate(
        session.session_code,
        lastUpdateRef.current
      );
      
      if (response.success) {
        setLiveData(response);
        if (response.timestamp) {
          lastUpdateRef.current = response.timestamp;
        }
        setError('');
      }
    } catch (err) {
      console.error('Failed to fetch live data:', err);
      setError('Failed to fetch live data');
    } finally {
      setLoading(false);
    }
  }, [session.session_code]);

  useEffect(() => {
    fetchLiveData();

    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLiveData, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLiveData, autoRefresh]);

  const toggleMember = (userCode) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(userCode)) {
        next.delete(userCode);
      } else {
        next.add(userCode);
      }
      return next;
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sessionInfo = liveData?.session || session;
  const members = liveData?.members || [];
  const summary = liveData?.summary || {};

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-colors"
            style={{ 
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-title)' }}
              >
                {sessionInfo.session_name || `Session ${sessionInfo.session_code}`}
              </h1>
              {sessionInfo.is_active && (
                <span 
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{ 
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: 'var(--color-success-text)',
                  }}
                >
                  <Activity size={10} className="animate-pulse" />
                  Live Session
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1">
              <code 
                className="text-xs px-2 py-0.5 rounded"
                style={{ 
                  background: 'var(--color-surface-dark)',
                  color: 'var(--color-text-tertiary)' 
                }}
              >
                {sessionInfo.session_code}
              </code>
              <span 
                className="text-sm flex items-center gap-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Clock size={14} />
                Started {formatDate(sessionInfo.started_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh ? 'animate-pulse' : ''
            }`}
            style={{
              background: autoRefresh ? 'rgba(34, 197, 94, 0.15)' : 'var(--color-surface)',
              border: '1px solid',
              borderColor: autoRefresh ? 'rgba(34, 197, 94, 0.3)' : 'var(--color-border)',
              color: autoRefresh ? 'var(--color-success-text)' : 'var(--color-text-secondary)',
            }}
          >
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div 
        className="flex items-center gap-6 px-6 py-3 border-b shrink-0"
        style={{ 
          background: 'var(--color-surface-dark)',
          borderColor: 'var(--color-border)' 
        }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {summary.member_count || members.length}
            </strong> members
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Radio size={16} style={{ color: 'var(--color-success-text)' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-success-text)' }}>
              {summary.active_recording_count || 0}
            </strong> recording
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Eye size={16} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>
              {summary.total_events || 0}
            </strong> total events
          </span>
        </div>
        {liveData?.timestamp && (
          <div 
            className="ml-auto text-xs"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Last update: {new Date(liveData.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && !liveData ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 
              size={32} 
              className="animate-spin mb-3"
              style={{ color: 'var(--color-primary)' }}
            />
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Loading live session data...
            </p>
          </div>
        ) : error && !liveData ? (
          <div 
            className="text-center py-12 px-4 rounded-xl"
            style={{
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
            }}
          >
            <p style={{ color: 'var(--color-error-text)' }}>{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                fetchLiveData();
              }}
              className="mt-3 px-4 py-2 rounded-lg text-sm"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Retry
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <Users 
              size={48} 
              className="mx-auto mb-4"
              style={{ color: 'var(--color-text-tertiary)' }}
            />
            <h3 
              className="text-lg font-medium mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No members yet
            </h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Invite team members to join this session and start tracking.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {members.map((member) => (
              <MemberCard
                key={member.user_code}
                member={member}
                expanded={expandedMembers.has(member.user_code)}
                onToggle={() => toggleMember(member.user_code)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

