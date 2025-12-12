import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Radio, Users, Monitor, Square, Globe, Loader2 } from 'lucide-react';
import { sessionAPI } from '../services/api.js';

function LiveStatus({ session, isSharing, selectedTab, onStopSharing }) {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberUrls, setMemberUrls] = useState(new Map()); // Map<user_code, URL[]>
  const lastUpdateRef = useRef(null);
  const intervalRef = useRef(null);
  const accumulatedEventsRef = useRef(new Map()); // Map<user_code, Event[]>
  const memberUrlsRef = useRef(new Map()); // Ref to track URLs for deduplication

  // Fetch live data from API
  const fetchLiveData = useCallback(async () => {
    if (!session?.session_code) return;

    try {
      const response = await sessionAPI.getLiveUpdate(
        session.session_code,
        lastUpdateRef.current
      );

      if (response.success) {
        // Process members and accumulate events
        const updatedMembers = response.members?.map(member => {
          const userCode = member.user_code;
          const existingEvents = accumulatedEventsRef.current.get(userCode) || [];
          const newEvents = member.recent_events || [];

          // Create a Set to track unique events
          const eventKey = (e) => {
            const url = e.context?.url || e.context?.full_url || '';
            const tabId = e.context?.tab_id || '';
            return `${e.timestamp}-${e.event_type}-${url}-${tabId}`;
          };
          const existingKeys = new Set(existingEvents.map(eventKey));

          // Add only truly new events
          const uniqueNewEvents = newEvents.filter(e => {
            const key = eventKey(e);
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              return true;
            }
            return false;
          });

          // Merge events
          const allEvents = [...existingEvents, ...uniqueNewEvents].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          );

          // Update accumulated events
          accumulatedEventsRef.current.set(userCode, allEvents);

          return {
            ...member,
            all_accumulated_events: allEvents
          };
        }) || [];

        setLiveData({
          ...response,
          members: updatedMembers
        });

        // Extract PAGE_LOADED events and update URLs per member
        const newMemberUrls = new Map();
        updatedMembers.forEach(member => {
          const userCode = member.user_code;
          const allEvents = member.all_accumulated_events || [];
          
          // Filter PAGE_LOADED events and extract URLs
          const pageLoadedUrls = allEvents
            .filter(event => event.event_type === 'PAGE_LOADED')
            .map(event => ({
              url: event.context?.url || event.context?.full_url || '',
              title: event.context?.title || '',
              timestamp: event.timestamp,
              favicon: event.context?.favicon || event.context?.favIconUrl || ''
            }))
            .filter(item => item.url); // Remove empty URLs

          // Get existing URLs for this member from ref
          const existingUrls = memberUrlsRef.current.get(userCode) || [];
          
          // Merge and deduplicate by URL (keep most recent)
          const urlMap = new Map();
          [...existingUrls, ...pageLoadedUrls].forEach(item => {
            if (!urlMap.has(item.url) || new Date(item.timestamp) > new Date(urlMap.get(item.url).timestamp)) {
              urlMap.set(item.url, item);
            }
          });

          const urlsArray = Array.from(urlMap.values());
          newMemberUrls.set(userCode, urlsArray);
          memberUrlsRef.current.set(userCode, urlsArray);
        });

        setMemberUrls(newMemberUrls);

        if (response.timestamp) {
          lastUpdateRef.current = response.timestamp;
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch live data:', error);
      setLoading(false);
    }
  }, [session?.session_code]);

  // Set up polling
  useEffect(() => {
    if (!session?.session_code) return;

    // Initial fetch
    fetchLiveData();

    // Poll every 3 seconds
    intervalRef.current = setInterval(fetchLiveData, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [session?.session_code, fetchLiveData]);

  // Reset accumulated events when session changes
  useEffect(() => {
    accumulatedEventsRef.current.clear();
    memberUrlsRef.current.clear();
    setMemberUrls(new Map());
    lastUpdateRef.current = null;
  }, [session?.session_code]);

  const members = liveData?.members || [];
  const summary = liveData?.summary || {};

  // Extract domain from URL for display
  const getDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">LIVE</h2>
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            </div>
            <p className="text-green-100 text-sm">Session is active</p>
          </div>
        </div>
        {isSharing && (
          <button
            onClick={onStopSharing}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all transform hover:scale-105 shadow-lg"
          >
            <Square className="w-5 h-5" />
            Stop
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Session ID */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-5 h-5" />
            <span className="text-sm font-semibold text-green-100">Session ID</span>
          </div>
          <p className="text-lg font-bold truncate">{session?.session_code || session?.id || 'N/A'}</p>
        </div>

        {/* Viewers */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5" />
            <span className="text-sm font-semibold text-green-100">Team Members</span>
          </div>
          <p className="text-lg font-bold">
            {summary.member_count || members.length || 0} connected
          </p>
        </div>

        {/* Current Tab */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-5 h-5" />
            <span className="text-sm font-semibold text-green-100">Current Tab</span>
          </div>
          <p className="text-lg font-bold truncate">
            {isSharing && selectedTab ? selectedTab.title : 'Not sharing'}
          </p>
        </div>
      </div>

      {/* Team Members with URL Runners */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Team Activity</h3>
        </div>

        {loading && !liveData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading team data...</span>
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
            <p className="text-green-100">No team members active yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {members.map((member) => {
              const urls = memberUrls.get(member.user_code) || [];
              const isRecording = member.is_recording || false;

              return (
                <div
                  key={member.user_code}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* Member Name and Status */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-green-300 animate-pulse' : 'bg-gray-400'}`} />
                        <span className="font-semibold text-lg">{member.user_name || member.user_code}</span>
                      </div>
                      {isRecording && (
                        <span className="text-xs bg-green-400/30 px-2 py-1 rounded-full">
                          Recording
                        </span>
                      )}
                    </div>

                    {/* Scrollable URL Runner */}
                    <div className="flex-1 overflow-hidden">
                      {urls.length > 0 ? (
                        <div className="relative">
                          {/* Gradient overlays for scroll indication */}
                          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-green-500 to-transparent z-10 pointer-events-none" />
                          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-green-500 to-transparent z-10 pointer-events-none" />
                          
                          {/* Scrollable container */}
                          <div 
                            className="flex gap-2 overflow-x-auto scrollbar-hide py-2 px-2" 
                            style={{ 
                              scrollbarWidth: 'none', 
                              msOverflowStyle: 'none',
                              scrollBehavior: 'smooth'
                            }}
                          >
                            {urls.map((urlItem, idx) => (
                              <a
                                key={`${urlItem.url}-${idx}`}
                                href={urlItem.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-2 whitespace-nowrap transition-all transform hover:scale-105 flex-shrink-0"
                                title={urlItem.title || urlItem.url}
                              >
                                {urlItem.favicon ? (
                                  <img
                                    src={urlItem.favicon}
                                    alt=""
                                    className="w-4 h-4 rounded"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Globe className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium truncate max-w-[200px]">
                                  {urlItem.title || getDomain(urlItem.url)}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-green-100/70 text-sm py-2">
                          No pages visited yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sharing Status */}
      <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${isSharing ? 'bg-green-300 animate-pulse' : 'bg-gray-400'}`} />
            <span className="font-semibold">
              {isSharing ? '🎥 Sharing Active' : '⏸️ Not Sharing'}
            </span>
          </div>
          {isSharing && selectedTab && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-100">{selectedTab.favicon}</span>
              <span>{selectedTab.url}</span>
            </div>
          )}
        </div>
      </div>

      {!isSharing && (
        <div className="mt-4 p-3 bg-amber-500/20 backdrop-blur-sm rounded-lg border border-amber-300/30">
          <p className="text-sm">
            ⚠️ Session is active but not sharing. Select a tab and click "Start Sharing" to begin.
          </p>
        </div>
      )}
    </div>
  );
}

export default LiveStatus;
