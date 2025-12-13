import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Globe, 
  CheckSquare, 
  Square, 
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { sessionAPI, pagesAPI, teamAnalysisAPI } from '../services/api.js';

export default function AIStudio({ user }) {
  // Session selection
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  // Pages data
  const [teamPages, setTeamPages] = useState([]);
  const [personalPages, setPersonalPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  
  // Websites data (from selected session)
  const [websites, setWebsites] = useState([]);
  const [loadingWebsites, setLoadingWebsites] = useState(false);
  
  // Selected sources (for ingestion)
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [selectedWebsites, setSelectedWebsites] = useState(new Set());
  const [ingestedPages, setIngestedPages] = useState(new Set()); // Track already ingested
  const [ingestedWebsites, setIngestedWebsites] = useState(new Set()); // Track already ingested
  
  // UI states
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState('');

  const userCode = user?.user_code ? String(user.user_code).trim().toUpperCase() : null;

  // Fetch all sessions
  const fetchSessions = useCallback(async () => {
    if (!userCode) return;
    
    setLoadingSessions(true);
    setError('');
    
    try {
      const response = await sessionAPI.getAll(false);
      setSessions(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, [userCode]);

  // Fetch pages (team and personal)
  const fetchPages = useCallback(async () => {
    setLoadingPages(true);
    setError('');
    
    try {
      const [teamRes, personalRes] = await Promise.all([
        pagesAPI.getTeam(),
        userCode ? pagesAPI.getPrivate(userCode) : Promise.resolve({ data: [] }),
      ]);
      
      setTeamPages(teamRes.data || []);
      setPersonalPages(personalRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load pages');
    } finally {
      setLoadingPages(false);
    }
  }, [userCode]);

  // Fetch websites from selected session
  const fetchWebsites = useCallback(async () => {
    if (!selectedSession) {
      setWebsites([]);
      return;
    }
    
    setLoadingWebsites(true);
    setError('');
    
    try {
      // Fetch session data and team analysis in parallel
      const [sessionResponse, teamAnalysisResponse] = await Promise.all([
        sessionAPI.getFull(selectedSession.session_code),
        teamAnalysisAPI.get(selectedSession.session_code).catch(() => null), // Team analysis is optional
      ]);
      
      const sessionData = sessionResponse.data || sessionResponse; // Handle both response formats
      
      // Create a map of URL to relevance data from team analysis
      const relevanceMap = new Map();
      if (teamAnalysisResponse?.data?.sites) {
        teamAnalysisResponse.data.sites.forEach(site => {
          if (site.url) {
            relevanceMap.set(site.url, {
              relevance_score: site.relevance_score,
              relevance_explanation: site.relevance_explanation,
            });
          }
        });
      }
      
      // Extract unique URLs from navigation events from ALL members in the session
      const urlSet = new Set();
      const websiteList = [];
      
      if (sessionData.members) {
        // Iterate through all members in the session
        sessionData.members.forEach(member => {
          if (member.navigation_tracking?.navigation_events) {
            member.navigation_tracking.navigation_events.forEach(event => {
              if (event.event_type === 'PAGE_LOADED' || event.event_type === 'PAGE_OPEN') {
                const url = event.context?.url || event.context?.full_url || '';
                if (url && !urlSet.has(url)) {
                  urlSet.add(url);
                  try {
                    const urlObj = new URL(url);
                    const domain = urlObj.hostname;
                    const relevanceData = relevanceMap.get(url) || {};
                    websiteList.push({
                      url,
                      domain,
                      title: event.context?.title || domain,
                      timestamp: event.timestamp,
                      user_code: member.user_code,
                      user_name: member.user_name || member.user_code,
                      relevance_score: relevanceData.relevance_score ?? null,
                      relevance_explanation: relevanceData.relevance_explanation || null,
                    });
                  } catch {
                    // Invalid URL, skip
                  }
                }
              }
            });
          }
        });
      }
      
      // Sort by relevance_score (highest first), then by timestamp (most recent first) for sites without scores
      websiteList.sort((a, b) => {
        // Sites with relevance scores come first
        if (a.relevance_score !== null && b.relevance_score !== null) {
          return b.relevance_score - a.relevance_score; // Descending order
        }
        if (a.relevance_score !== null) return -1; // a has score, b doesn't
        if (b.relevance_score !== null) return 1;  // b has score, a doesn't
        // Both don't have scores, sort by timestamp
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      setWebsites(websiteList);
    } catch (err) {
      setError(err.message || 'Failed to load websites');
      setWebsites([]);
    } finally {
      setLoadingWebsites(false);
    }
  }, [selectedSession]);

  // Load sessions and pages on mount
  useEffect(() => {
    fetchSessions();
    fetchPages();
  }, [fetchSessions, fetchPages]);

  // Load websites when session changes
  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  // Toggle page selection
  const togglePage = (pageId, isTeam) => {
    const key = `${isTeam ? 'team' : 'personal'}_${pageId}`;
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Toggle website selection
  const toggleWebsite = (url) => {
    setSelectedWebsites(prev => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  // Select all pages
  const selectAllPages = () => {
    const allPages = new Set();
    teamPages.forEach(p => allPages.add(`team_${p._id || p.id}`));
    personalPages.forEach(p => allPages.add(`personal_${p._id || p.id}`));
    setSelectedPages(allPages);
  };

  // Deselect all pages
  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  // Select all websites
  const selectAllWebsites = () => {
    const allUrls = new Set(websites.map(w => w.url));
    setSelectedWebsites(allUrls);
  };

  // Deselect all websites
  const deselectAllWebsites = () => {
    setSelectedWebsites(new Set());
  };

  // Handle ingest button click
  const handleIngest = async () => {
    const pagesToIngest = Array.from(selectedPages).filter(id => !ingestedPages.has(id));
    const websitesToIngest = Array.from(selectedWebsites).filter(url => !ingestedWebsites.has(url));
    
    if (pagesToIngest.length === 0 && websitesToIngest.length === 0) {
      setError('No new sources selected for ingestion. Select sources that haven\'t been ingested yet.');
      return;
    }
    
    setIsIngesting(true);
    setError('');
    
    try {
      // TODO: Implement actual ingestion API call
      // For now, just mark as ingested
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // Mark pages as ingested
      pagesToIngest.forEach(id => {
        setIngestedPages(prev => new Set([...prev, id]));
      });
      
      // Mark websites as ingested
      websitesToIngest.forEach(url => {
        setIngestedWebsites(prev => new Set([...prev, url]));
      });
      
      // Clear selections
      setSelectedPages(new Set());
      setSelectedWebsites(new Set());
      
      // Show success (could use a toast in the future)
      console.log(`Ingested ${pagesToIngest.length} pages and ${websitesToIngest.length} websites`);
    } catch (err) {
      setError(err.message || 'Failed to ingest sources');
    } finally {
      setIsIngesting(false);
    }
  };

  const allPages = [
    ...teamPages.map(p => ({ ...p, isTeam: true, key: `team_${p._id || p.id}` })),
    ...personalPages.map(p => ({ ...p, isTeam: false, key: `personal_${p._id || p.id}` })),
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-6">
      {/* Error Message */}
      {error && (
        <div 
          className="flex items-center gap-2 px-4 py-3 rounded-lg"
          style={{
            background: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            color: 'var(--color-error-text)',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Main Content - 1:2 ratio */}
      <div className="flex-1 min-h-0 grid gap-6" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Sources Section */}
        <div
          className="rounded-2xl p-6 flex flex-col"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
              Sources
            </div>
            <button
              onClick={fetchPages}
              disabled={loadingPages}
              className="p-2 rounded-lg hover:bg-opacity-80 transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
              title="Refresh pages"
            >
              <RefreshCw size={14} className={loadingPages ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-y-auto">
            {/* Session Selector (for Websites) */}
            <div>
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-label)' }}
              >
                Select Session (for Websites)
              </label>
              <select
                value={selectedSession?.session_code || ''}
                onChange={(e) => {
                  const session = sessions.find(s => s.session_code === e.target.value);
                  setSelectedSession(session || null);
                  setSelectedWebsites(new Set()); // Clear website selections when session changes
                }}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
                disabled={loadingSessions}
              >
                <option value="">-- Select a session --</option>
                {sessions.map(session => (
                  <option key={session.session_code || session._id} value={session.session_code}>
                    {session.session_name || session.session_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Pages Subsection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} style={{ color: 'var(--color-text-secondary)' }} />
                  <div className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>
                    Pages
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllPages}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAllPages}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              {loadingPages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
              ) : allPages.length === 0 ? (
                <div 
                  className="text-sm py-4 text-center rounded-lg"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  No pages available
                </div>
              ) : (
                <div 
                  className="space-y-2 max-h-64 overflow-y-auto rounded-lg p-2"
                  style={{ background: 'var(--color-background)' }}
                >
                  {allPages.map(page => {
                    const key = page.key;
                    const isSelected = selectedPages.has(key);
                    const isIngested = ingestedPages.has(key);
                    
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-opacity-50 transition-colors"
                        style={{
                          background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <Square size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {page.title || 'Untitled'}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                            {page.isTeam ? 'Team' : 'Personal'}
                          </div>
                        </div>
                        {isIngested && (
                          <div className="flex-shrink-0 text-xs px-2 py-1 rounded" style={{ 
                            background: 'var(--color-success)',
                            color: 'var(--color-text-primary)',
                            opacity: 0.8,
                          }}>
                            Ingested
                          </div>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePage(page._id || page.id, page.isTeam)}
                          className="sr-only"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Websites Subsection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe size={16} style={{ color: 'var(--color-text-secondary)' }} />
                  <div className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>
                    Websites ({selectedSession ? websites.length : 'Select session'})
                  </div>
                </div>
                {selectedSession && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllWebsites}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllWebsites}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              
              {!selectedSession ? (
                <div 
                  className="text-sm py-4 text-center rounded-lg"
                  style={{ 
                    color: 'var(--color-text-tertiary)',
                    background: 'var(--color-background)',
                  }}
                >
                  Select a session to view websites
                </div>
              ) : loadingWebsites ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                </div>
              ) : websites.length === 0 ? (
                <div 
                  className="text-sm py-4 text-center rounded-lg"
                  style={{ 
                    color: 'var(--color-text-tertiary)',
                    background: 'var(--color-background)',
                  }}
                >
                  No websites found in this session
                </div>
              ) : (
                <div 
                  className="space-y-2 max-h-64 overflow-y-auto rounded-lg p-2"
                  style={{ background: 'var(--color-background)' }}
                >
                  {websites.map(website => {
                    const isSelected = selectedWebsites.has(website.url);
                    const isIngested = ingestedWebsites.has(website.url);
                    
                    return (
                      <label
                        key={website.url}
                        className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-opacity-50 transition-colors"
                        style={{
                          background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                          border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare size={18} style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <Square size={18} style={{ color: 'var(--color-text-tertiary)' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                              {website.title}
                            </div>
                            {website.relevance_score !== null && (
                              <div 
                                className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                                style={{
                                  background: website.relevance_score >= 70 
                                    ? 'rgba(34, 197, 94, 0.2)' 
                                    : website.relevance_score >= 40 
                                    ? 'rgba(250, 204, 21, 0.2)' 
                                    : 'rgba(239, 68, 68, 0.2)',
                                  color: website.relevance_score >= 70 
                                    ? 'rgb(34, 197, 94)' 
                                    : website.relevance_score >= 40 
                                    ? 'rgb(250, 204, 21)' 
                                    : 'rgb(239, 68, 68)',
                                  border: `1px solid ${
                                    website.relevance_score >= 70 
                                      ? 'rgba(34, 197, 94, 0.3)' 
                                      : website.relevance_score >= 40 
                                      ? 'rgba(250, 204, 21, 0.3)' 
                                      : 'rgba(239, 68, 68, 0.3)'
                                  }`,
                                }}
                                title={website.relevance_explanation || `Relevance: ${website.relevance_score}/100`}
                              >
                                {website.relevance_score}
                              </div>
                            )}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                            {website.domain}
                          </div>
                        </div>
                        {isIngested && (
                          <div className="flex-shrink-0 text-xs px-2 py-1 rounded" style={{ 
                            background: 'var(--color-success)',
                            color: 'var(--color-text-primary)',
                            opacity: 0.8,
                          }}>
                            Ingested
                          </div>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleWebsite(website.url)}
                          className="sr-only"
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ingest Button */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={handleIngest}
                disabled={isIngesting || (selectedPages.size === 0 && selectedWebsites.size === 0)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: isIngesting || (selectedPages.size === 0 && selectedWebsites.size === 0)
                    ? 'var(--color-surface-dark)'
                    : 'var(--color-primary)',
                  border: `1px solid ${
                    isIngesting || (selectedPages.size === 0 && selectedWebsites.size === 0)
                      ? 'var(--color-border)'
                      : 'var(--color-primary-border)'
                  }`,
                  color: isIngesting || (selectedPages.size === 0 && selectedWebsites.size === 0)
                    ? 'var(--color-text-tertiary)'
                    : 'var(--color-text-primary)',
                  cursor: isIngesting || (selectedPages.size === 0 && selectedWebsites.size === 0)
                    ? 'not-allowed'
                    : 'pointer',
                }}
              >
                {isIngesting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Ingesting...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Ingest Selected ({selectedPages.size + selectedWebsites.size})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* AI Studio Section */}
        <div
          className="rounded-2xl p-6 flex flex-col"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={20} style={{ color: 'var(--color-primary)' }} />
            <div className="text-base font-semibold" style={{ color: 'var(--color-text-title)' }}>
              AI Workspace
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--color-surface-dark)' }}
              >
                <Sparkles size={32} style={{ color: 'var(--color-text-tertiary)' }} />
              </div>
              <h3 
                className="text-lg font-medium mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                AI Workspace
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Ingest sources to start building AI workflows
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

