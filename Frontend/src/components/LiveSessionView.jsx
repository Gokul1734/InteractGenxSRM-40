import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Users, Clock, RefreshCw, Globe, 
  ExternalLink, Activity, Radio, User, Loader2,
  Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { sessionAPI } from '../services/api.js';

function MemberCard({ member, expanded, onToggle, memberNumber }) {
  const isRecording = member.is_recording === true; // Only show as recording if explicitly true
  // Use current_state from API (which now shows latest PAGE_LOADED event)
  const currentState = member.current_state;
  // Use navigation_events from API (which now only contains PAGE_LOADED events, unique by URL)
  const allEvents = member.navigation_events || 
                    member.all_accumulated_events || 
                    member.navigation_tracking?.navigation_events || 
                    member.recent_events || 
                    [];
  // For recent events display, use the last 10 from all accumulated events
  const recentEvents = allEvents.slice(-10);

  // Extract unique pages from events where URL exists in context
  const uniquePages = useMemo(() => {
    const pageMap = new Map();
    
    allEvents.forEach(event => {
      const url = event.context?.url || event.context?.full_url;
      if (url) {
        // Use URL as key to ensure uniqueness
        if (!pageMap.has(url)) {
          let domain = event.context?.domain;
          if (!domain) {
            try {
              domain = new URL(url).hostname;
            } catch (e) {
              // Invalid URL, skip domain extraction
              domain = url;
            }
          }
          pageMap.set(url, {
            url: url,
            title: event.context?.title || url,
            favicon: event.context?.favicon || event.context?.favIconUrl,
            lastSeen: event.timestamp,
            eventType: event.event_type,
            domain: domain
          });
        } else {
          // Update with most recent timestamp if newer
          const existing = pageMap.get(url);
          if (new Date(event.timestamp) > new Date(existing.lastSeen)) {
            existing.lastSeen = event.timestamp;
            existing.eventType = event.event_type;
            if (event.context?.title && !existing.title) {
              existing.title = event.context.title;
            }
            const favicon = event.context?.favicon || event.context?.favIconUrl;
            if (favicon && !existing.favicon) {
              existing.favicon = favicon;
            }
          }
        }
      }
    });

    // Sort by last seen (most recent first)
    return Array.from(pageMap.values()).sort((a, b) => 
      new Date(b.lastSeen) - new Date(a.lastSeen)
    );
  }, [allEvents]);

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
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
            style={{ 
              background: 'var(--color-surface-dark)',
              color: 'var(--color-text-primary)',
            }}
          >
            {memberNumber !== undefined ? memberNumber : (member.user_name?.charAt(0)?.toUpperCase() || '?')}
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
  // Accumulate all events across updates for each member
  const accumulatedEventsRef = useRef(new Map()); // Map<user_code, Event[]>

  const fetchLiveData = useCallback(async () => {
    try {
      const response = await sessionAPI.getLiveUpdate(
        session.session_code,
        lastUpdateRef.current
      );
      
      if (response.success) {
        // Use navigation_events from API (already filtered to PAGE_LOADED and unique by URL)
        // Accumulate all PAGE_LOADED events for each member
        const updatedMembers = response.members?.map(member => {
          const userCode = member.user_code;
          const existingEvents = accumulatedEventsRef.current.get(userCode) || [];
          // Use navigation_events which contains all PAGE_LOADED events (unique by URL)
          const newEvents = member.navigation_events || [];
          
          // Create a Set to track unique events by URL (since backend already ensures uniqueness)
          const existingUrls = new Set(existingEvents.map(e => e.context?.url || e.context?.full_url || ''));
          
          // Add only new events (by URL)
          const uniqueNewEvents = newEvents.filter(e => {
            const url = e.context?.url || e.context?.full_url || '';
            if (url && !existingUrls.has(url)) {
              existingUrls.add(url);
              return true;
            }
            return false;
          });
          
          // Merge: combine existing + new, then sort by timestamp
          const allEvents = [...existingEvents, ...uniqueNewEvents].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );
          
          // Update accumulated events
          accumulatedEventsRef.current.set(userCode, allEvents);
          
          // Return member with all accumulated events and navigation_events
          return {
            ...member,
            all_accumulated_events: allEvents,
            navigation_events: allEvents // Use accumulated events
          };
        }) || [];
        
        setLiveData({
          ...response,
          members: updatedMembers
        });
        
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

  // Reset accumulated events when session changes
  useEffect(() => {
    accumulatedEventsRef.current.clear();
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

  // Aggregate all PAGE_LOADED events from all members
  // Each event is already unique by URL from the backend
  const allUniquePages = useMemo(() => {
    const pageMap = new Map();
    
    members.forEach(member => {
      // Use navigation_events which now only contains PAGE_LOADED events (unique by URL)
      const pageLoadedEvents = member.navigation_events || 
                               member.all_accumulated_events || 
                               [];
      
      pageLoadedEvents.forEach(event => {
        const url = event.context?.url || event.context?.full_url;
        if (url && event.event_type === 'PAGE_LOADED') {
          if (!pageMap.has(url)) {
            let domain = event.context?.domain;
            if (!domain) {
              try {
                domain = new URL(url).hostname;
              } catch (e) {
                domain = url;
              }
            }
            pageMap.set(url, {
              url: url,
              title: event.context?.title || url,
              favicon: event.context?.favicon || event.context?.favIconUrl,
              lastSeen: event.timestamp,
              eventType: event.event_type,
              domain: domain,
              visitedBy: [member.user_name || member.user_code]
            });
          } else {
            const existing = pageMap.get(url);
            // Update with most recent timestamp if newer
            if (new Date(event.timestamp) > new Date(existing.lastSeen)) {
              existing.lastSeen = event.timestamp;
              existing.eventType = event.event_type;
              if (event.context?.title && !existing.title) {
                existing.title = event.context.title;
              }
              const favicon = event.context?.favicon || event.context?.favIconUrl;
              if (favicon && !existing.favicon) {
                existing.favicon = favicon;
              }
            }
            // Add member to visitedBy if not already there
            const memberName = member.user_name || member.user_code;
            if (!existing.visitedBy.includes(memberName)) {
              existing.visitedBy.push(memberName);
            }
          }
        }
      });
    });

    // Sort by last seen (most recent first)
    return Array.from(pageMap.values()).sort((a, b) => 
      new Date(b.lastSeen) - new Date(a.lastSeen)
    );
  }, [members]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

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
          <div className="flex gap-6 items-start">
            {/* Left Column: Members List */}
            <div className="flex-1 min-w-0 space-y-4">
              {members.map((member, index) => (
                <MemberCard
                  key={member.user_code}
                  member={member}
                  memberNumber={index + 1}
                  expanded={expandedMembers.has(member.user_code)}
                  onToggle={() => toggleMember(member.user_code)}
                />
              ))}
            </div>

            {/* Right Column: Visited Pages */}
            <div 
              className="w-96 shrink-0 rounded-xl overflow-hidden flex flex-col"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                maxHeight: 'calc(100vh - 200px)',
              }}
            >
              <div 
                className="px-4 py-3 border-b shrink-0"
                style={{ 
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Globe size={16} style={{ color: 'var(--color-primary)' }} />
                  <h2 
                    className="text-sm font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Visited Pages by team!
                  </h2>
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ 
                      background: 'var(--color-surface-dark)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {allUniquePages.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {allUniquePages.length === 0 ? (
                  <div className="p-6 text-center">
                    <Globe 
                      size={32} 
                      className="mx-auto mb-2"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    />
                    <p 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      No pages visited yet
                    </p>
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {allUniquePages.map((page, idx) => (
                      <div
                        key={page.url || idx}
                        className="flex items-start gap-2 p-3 rounded-lg transition-colors hover:bg-opacity-50"
                        style={{
                          background: idx === 0 ? 'rgba(34, 197, 94, 0.1)' : 'var(--color-surface-dark)',
                          border: '1px solid',
                          borderColor: idx === 0 ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-border)',
                        }}
                      >
                        {page.favicon ? (
                          <img 
                            src={page.favicon} 
                            alt="" 
                            className="w-5 h-5 mt-0.5 rounded shrink-0"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        ) : (
                          <Globe size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div 
                            className="text-sm font-medium truncate mb-1"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {page.title || 'Untitled'}
                          </div>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs truncate flex items-center gap-1 hover:underline mb-1"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            {page.url}
                            <ExternalLink size={10} />
                          </a>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {page.visitedBy && page.visitedBy.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <User size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                                <span 
                                  className="text-xs font-medium"
                                  style={{ color: 'var(--color-text-secondary)' }}
                                >
                                  {page.visitedBy.length === 1 
                                    ? page.visitedBy[0]
                                    : `${page.visitedBy.join(', ')}`
                                  }
                                </span>
                              </div>
                            )}
                            <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                            <span 
                              className="text-xs"
                              style={{ color: 'var(--color-text-tertiary)' }}
                            >
                              {formatTime(page.lastSeen)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

