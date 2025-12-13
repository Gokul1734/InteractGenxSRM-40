import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  FileText, 
  Globe, 
  CheckSquare, 
  Square, 
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  XCircle,
  Send,
  MessageSquare,
  Bot
} from 'lucide-react';
import { sessionAPI, pagesAPI, teamAnalysisAPI, ingestionAPI, chatbotAPI } from '../services/api.js';

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
  const [failedPages, setFailedPages] = useState(new Set()); // Track failed ingestion
  const [failedWebsites, setFailedWebsites] = useState(new Set()); // Track failed ingestion
  const [ingestionStatus, setIngestionStatus] = useState(new Map()); // Track status and error messages
  
  // UI states
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState('');
  
  // Chatbot states
  const [ingestedSources, setIngestedSources] = useState([]); // All ingested sources for the session
  const [loadingIngestedSources, setLoadingIngestedSources] = useState(false);
  const [selectedChatbotSources, setSelectedChatbotSources] = useState(new Set());
  const [chatbotPrompt, setChatbotPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState([]); // Chat history for the session
  const [loadingChatHistory, setLoadingChatHistory] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [chatbotError, setChatbotError] = useState('');
  const chatHistoryEndRef = useRef(null);

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

  const allPages = useMemo(() => [
    ...teamPages.map(p => ({ ...p, isTeam: true, key: `team_${p._id || p.id}` })),
    ...personalPages.map(p => ({ ...p, isTeam: false, key: `personal_${p._id || p.id}` })),
  ], [teamPages, personalPages]);

  // Separate pages into ingested, failed, and non-ingested
  const nonIngestedPages = useMemo(() => 
    allPages.filter(page => !ingestedPages.has(page.key) && !failedPages.has(page.key)), 
    [allPages, ingestedPages, failedPages]
  );
  const ingestedPagesList = useMemo(() => 
    allPages.filter(page => ingestedPages.has(page.key)), 
    [allPages, ingestedPages]
  );
  const failedPagesList = useMemo(() => 
    allPages.filter(page => failedPages.has(page.key)), 
    [allPages, failedPages]
  );
  
  // Separate websites into ingested, failed, and non-ingested
  const nonIngestedWebsites = useMemo(() => {
    return (websites || []).filter(website => !ingestedWebsites.has(website.url) && !failedWebsites.has(website.url));
  }, [websites, ingestedWebsites, failedWebsites]);
  
  const ingestedWebsitesList = useMemo(() => {
    return (websites || []).filter(website => ingestedWebsites.has(website.url));
  }, [websites, ingestedWebsites]);
  
  const failedWebsitesList = useMemo(() => {
    return (websites || []).filter(website => failedWebsites.has(website.url));
  }, [websites, failedWebsites]);

  // Select all pages (only non-ingested pages)
  const selectAllPages = () => {
    const pagesToSelect = new Set();
    nonIngestedPages.forEach(page => pagesToSelect.add(page.key));
    setSelectedPages(pagesToSelect);
  };

  // Deselect all pages
  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  // Select all websites (only non-ingested websites)
  const selectAllWebsites = () => {
    const urlsToSelect = new Set(nonIngestedWebsites.map(w => w.url));
    setSelectedWebsites(urlsToSelect);
  };

  // Deselect all websites
  const deselectAllWebsites = () => {
    setSelectedWebsites(new Set());
  };

  // Check ingested status when session is selected
  const checkIngestedStatus = useCallback(async () => {
    if (!userCode || !selectedSession?.session_code) {
      // Clear ingested status if no session selected
      setIngestedPages(new Set());
      setIngestedWebsites(new Set());
      setFailedPages(new Set());
      setFailedWebsites(new Set());
      setIngestionStatus(new Map());
      return;
    }
    
    try {
      const sources = [];
      
      // Add page sources
      allPages.forEach(page => {
        sources.push({
          type: 'page',
          pageId: page._id || page.id,
          isTeam: page.isTeam
        });
      });
      
      // Add website sources
      websites.forEach(website => {
        sources.push({
          type: 'website',
          url: website.url
        });
      });
      
      if (sources.length === 0) return;
      
      const response = await ingestionAPI.checkIngested(sources, selectedSession.session_code);
      if (response.success && response.ingested) {
        const ingestedPagesSet = new Set();
        const ingestedWebsitesSet = new Set();
        const failedPagesSet = new Set();
        const failedWebsitesSet = new Set();
        const statusMap = new Map();
        
        // Process page results
        allPages.forEach(page => {
          const key = `${page.isTeam ? 'team' : 'personal'}_${page._id || page.id}`;
          if (response.ingested[key]) {
            const statusInfo = response.status?.[key];
            if (statusInfo?.status === 'failed') {
              failedPagesSet.add(key);
            } else {
              ingestedPagesSet.add(key);
            }
            // Store status info
            if (statusInfo) {
              statusMap.set(key, statusInfo);
            }
          }
        });
        
        // Process website results
        websites.forEach(website => {
          if (response.ingested[website.url]) {
            const statusInfo = response.status?.[website.url];
            if (statusInfo?.status === 'failed') {
              failedWebsitesSet.add(website.url);
            } else {
              ingestedWebsitesSet.add(website.url);
            }
            // Store status info
            if (statusInfo) {
              statusMap.set(website.url, statusInfo);
            }
          }
        });
        
        setIngestedPages(ingestedPagesSet);
        setIngestedWebsites(ingestedWebsitesSet);
        setFailedPages(failedPagesSet);
        setFailedWebsites(failedWebsitesSet);
        setIngestionStatus(statusMap);
      }
    } catch (err) {
      console.error('Error checking ingested status:', err);
    }
  }, [userCode, selectedSession?.session_code, allPages, websites]);

  // Check ingested status when session, pages, or websites change
  useEffect(() => {
    checkIngestedStatus();
  }, [checkIngestedStatus]);

  // Fetch all ingested sources for chatbot when session changes
  const fetchIngestedSources = useCallback(async () => {
    if (!selectedSession?.session_code) {
      setIngestedSources([]);
      setSelectedChatbotSources(new Set());
      return;
    }
    
    setLoadingIngestedSources(true);
    setChatbotError('');
    
    try {
      const response = await ingestionAPI.getContent({
        session_code: selectedSession.session_code,
        status: 'completed' // Only get successfully ingested content
      });
      
      if (response.success && response.data) {
        setIngestedSources(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching ingested sources:', err);
      setChatbotError(err.message || 'Failed to load ingested sources');
    } finally {
      setLoadingIngestedSources(false);
    }
  }, [selectedSession?.session_code]);

  // Fetch ingested sources when session changes
  useEffect(() => {
    fetchIngestedSources();
  }, [fetchIngestedSources]);

  // Fetch chat history when session changes
  const fetchChatHistory = useCallback(async () => {
    if (!selectedSession?.session_code) {
      setChatHistory([]);
      return;
    }
    
    setLoadingChatHistory(true);
    
    try {
      const response = await chatbotAPI.getHistory(selectedSession.session_code);
      if (response.success && response.data) {
        setChatHistory(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    } finally {
      setLoadingChatHistory(false);
    }
  }, [selectedSession?.session_code]);

  // Fetch chat history when session changes
  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  // Auto-scroll to bottom when chat history changes
  useEffect(() => {
    if (chatHistoryEndRef.current) {
      chatHistoryEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  // Handle chatbot source selection
  const toggleChatbotSource = (sourceId) => {
    setSelectedChatbotSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  // Select all chatbot sources
  const selectAllChatbotSources = () => {
    const allIds = new Set(ingestedSources.map(s => s._id.toString()));
    setSelectedChatbotSources(allIds);
  };

  // Deselect all chatbot sources
  const deselectAllChatbotSources = () => {
    setSelectedChatbotSources(new Set());
  };

  // Handle chatbot query
  const handleChatbotQuery = async () => {
    if (!chatbotPrompt.trim()) {
      setChatbotError('Please enter a prompt');
      return;
    }
    
    if (selectedChatbotSources.size === 0) {
      setChatbotError('Please select at least one source');
      return;
    }
    
    if (!selectedSession?.session_code) {
      setChatbotError('Please select a session');
      return;
    }
    
    const currentPrompt = chatbotPrompt.trim();
    const sourceIds = Array.from(selectedChatbotSources);
    
    // Add current prompt to chat history immediately (as pending)
    const pendingMessage = {
      _id: `pending-${Date.now()}`,
      prompt: currentPrompt,
      response: null,
      source_ids: sourceIds,
      created_at: new Date(),
      isPending: true
    };
    setChatHistory(prev => [...prev, pendingMessage]);
    
    // Clear prompt input
    setChatbotPrompt('');
    setIsQuerying(true);
    setChatbotError('');
    
    try {
      const response = await chatbotAPI.query(
        currentPrompt,
        sourceIds,
        selectedSession.session_code,
        userCode
      );
      
      if (response.success && response.data) {
        // Refresh chat history from database to get the saved message with proper ID
        await fetchChatHistory();
      } else {
        setChatbotError(response.message || 'Failed to get response');
        // Remove pending message on error
        setChatHistory(prev => prev.filter(msg => !(msg.isPending && msg.prompt === currentPrompt)));
      }
    } catch (err) {
      console.error('Error querying chatbot:', err);
      setChatbotError(err.message || 'Failed to query chatbot');
      // Remove pending message on error
      setChatHistory(prev => prev.filter(msg => !(msg.isPending && msg.prompt === currentPrompt)));
    } finally {
      setIsQuerying(false);
    }
  };

  // Handle ingest button click
  const handleIngest = async () => {
    if (!selectedSession?.session_code) {
      setError('Please select a session before ingesting sources.');
      return;
    }
    
    const pagesToIngest = Array.from(selectedPages).filter(id => !ingestedPages.has(id));
    const websitesToIngest = Array.from(selectedWebsites).filter(url => !ingestedWebsites.has(url));
    
    if (pagesToIngest.length === 0 && websitesToIngest.length === 0) {
      setError('No new sources selected for ingestion. Select sources that haven\'t been ingested yet.');
      return;
    }
    
    setIsIngesting(true);
    setError('');
    
    try {
      // Prepare sources for API
      const sources = [];
      
      // Add pages
      pagesToIngest.forEach(id => {
        const [type, pageId] = id.split('_');
        const page = allPages.find(p => (p._id || p.id) === pageId);
        if (page) {
          sources.push({
            type: 'page',
            pageId: page._id || page.id,
            isTeam: page.isTeam
          });
        }
      });
      
      // Add websites
      websitesToIngest.forEach(url => {
        sources.push({
          type: 'website',
          url: url
        });
      });
      
      // Call ingestion API
      const response = await ingestionAPI.ingest(
        sources, 
        selectedSession.session_code,
        userCode
      );
      
      if (response.success) {
        // Mark as ingested
        pagesToIngest.forEach(id => {
          setIngestedPages(prev => new Set([...prev, id]));
        });
        
        websitesToIngest.forEach(url => {
          setIngestedWebsites(prev => new Set([...prev, url]));
        });
        
        // Clear selections
        setSelectedPages(new Set());
        setSelectedWebsites(new Set());
        
        // Show success message
        const successMsg = `Successfully ingested ${response.results.pages.success + response.results.websites.success} source(s)`;
        if (response.results.pages.failed + response.results.websites.failed > 0) {
          setError(`${successMsg}. ${response.results.pages.failed + response.results.websites.failed} failed.`);
        } else {
          console.log(successMsg);
        }
      } else {
        setError(response.message || 'Failed to ingest sources');
      }
    } catch (err) {
      setError(err.message || 'Failed to ingest sources');
    } finally {
      setIsIngesting(false);
    }
  };

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
                <div className="space-y-4">
                  {/* Non-Ingested Pages - Only show when session is selected */}
                  {selectedSession && nonIngestedPages.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Non-Ingested ({nonIngestedPages.length})
                      </div>
                      <div 
                        className="space-y-2 max-h-48 overflow-y-auto rounded-lg p-2"
                        style={{ background: 'var(--color-background)' }}
                      >
                        {nonIngestedPages.map(page => {
                    const key = page.key;
                    const isSelected = selectedPages.has(key);
                    
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
                    </div>
                  )}
                  
                  {/* Ingested Pages - Only show when session is selected */}
                  {selectedSession && ingestedPagesList.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Ingested ({ingestedPagesList.length})
                      </div>
                      <div 
                        className="space-y-2 max-h-48 overflow-y-auto rounded-lg p-2"
                        style={{ background: 'var(--color-background)' }}
                      >
                        {ingestedPagesList.map(page => {
                          const key = page.key;
                          
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-3 p-2 rounded-lg opacity-60"
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border)',
                              }}
                            >
                              <div className="flex-shrink-0">
                                <CheckSquare size={18} style={{ color: 'var(--color-success)' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                  {page.title || 'Untitled'}
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {page.isTeam ? 'Team' : 'Personal'}
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-xs px-2 py-1 rounded" style={{ 
                                background: 'var(--color-success)',
                                color: 'var(--color-text-primary)',
                                opacity: 0.8,
                              }}>
                                Ingested
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                <div className="space-y-4">
                  {/* Non-Ingested Websites - Only show when session is selected */}
                  {selectedSession && nonIngestedWebsites.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Non-Ingested ({nonIngestedWebsites.length})
                      </div>
                      <div 
                        className="space-y-2 max-h-48 overflow-y-auto rounded-lg p-2"
                        style={{ background: 'var(--color-background)' }}
                      >
                        {nonIngestedWebsites.map(website => {
                          const isSelected = selectedWebsites.has(website.url);
                          
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
                    </div>
                  )}
                  
                  {/* Failed Websites - Only show when session is selected */}
                  {selectedSession && failedWebsitesList.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Failed ({failedWebsitesList.length})
                      </div>
                      <div 
                        className="space-y-2 max-h-48 overflow-y-auto rounded-lg p-2"
                        style={{ background: 'var(--color-background)' }}
                      >
                        {failedWebsitesList.map(website => {
                          const statusInfo = ingestionStatus.get(website.url);
                          const errorMsg = statusInfo?.error_message || 'Ingestion failed';
                          
                          return (
                            <div
                              key={website.url}
                              className="flex items-start gap-3 p-2 rounded-lg"
                              style={{
                                background: 'rgba(220, 38, 38, 0.1)',
                                border: '1px solid rgba(220, 38, 38, 0.3)',
                              }}
                              title={errorMsg}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                <XCircle size={18} style={{ color: 'var(--color-error)' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                  {website.title || website.domain}
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                                  {website.domain}
                                </div>
                                <div className="text-xs mt-1 truncate" style={{ color: 'var(--color-error)' }}>
                                  {errorMsg}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Ingested Websites - Only show when session is selected */}
                  {selectedSession && ingestedWebsitesList.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-2 px-2" style={{ color: 'var(--color-text-secondary)' }}>
                        Ingested ({ingestedWebsitesList.length})
                      </div>
                      <div 
                        className="space-y-2 max-h-48 overflow-y-auto rounded-lg p-2"
                        style={{ background: 'var(--color-background)' }}
                      >
                        {ingestedWebsitesList.map(website => {
                          return (
                            <div
                              key={website.url}
                              className="flex items-center gap-3 p-2 rounded-lg opacity-60"
                              style={{
                                background: 'transparent',
                                border: '1px solid var(--color-border)',
                              }}
                            >
                              <div className="flex-shrink-0">
                                <CheckSquare size={18} style={{ color: 'var(--color-success)' }} />
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
                              <div className="flex-shrink-0 text-xs px-2 py-1 rounded" style={{ 
                                background: 'var(--color-success)',
                                color: 'var(--color-text-primary)',
                                opacity: 0.8,
                              }}>
                                Ingested
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ingest Button */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={handleIngest}
                disabled={isIngesting || !selectedSession || (selectedPages.size === 0 && selectedWebsites.size === 0)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: isIngesting || !selectedSession || (selectedPages.size === 0 && selectedWebsites.size === 0)
                    ? 'var(--color-surface-dark)'
                    : 'var(--color-primary)',
                  border: `1px solid ${
                    isIngesting || !selectedSession || (selectedPages.size === 0 && selectedWebsites.size === 0)
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
          
          {/* Chatbot Interface */}
          <div className="flex-1 min-h-0 flex flex-col">
            {!selectedSession ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Bot size={48} style={{ color: 'var(--color-text-tertiary)' }} className="mx-auto mb-4" />
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Select a session to start querying ingested sources
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Source Selection - Fixed at Top */}
                <div className="flex-shrink-0 mb-4 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>
                      Select Sources ({selectedChatbotSources.size} selected)
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllChatbotSources}
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
                        onClick={deselectAllChatbotSources}
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
                  
                  {loadingIngestedSources ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    </div>
                  ) : ingestedSources.length === 0 ? (
                    <div className="text-sm py-4 text-center rounded-lg" style={{ color: 'var(--color-text-tertiary)' }}>
                      No ingested sources available. Ingest some sources first.
                    </div>
                  ) : (
                    <div 
                      className="space-y-2 max-h-32 overflow-y-auto rounded-lg p-2"
                      style={{ background: 'var(--color-background)' }}
                    >
                      {ingestedSources.map(source => {
                        const sourceId = source._id.toString();
                        const isSelected = selectedChatbotSources.has(sourceId);
                        const title = source.title || source.page_title || 'Untitled';
                        const type = source.source_type === 'page' ? 'Page' : 'Website';
                        
                        return (
                          <label
                            key={sourceId}
                            className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-opacity-50 transition-colors"
                            style={{
                              background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                              border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            }}
                          >
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <CheckSquare size={16} style={{ color: 'var(--color-primary)' }} />
                              ) : (
                                <Square size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                                {title}
                              </div>
                              <div className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                                {type} {source.url ? `• ${source.domain || source.url}` : ''}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleChatbotSource(sourceId)}
                              className="sr-only"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Conversation Area - Scrollable */}
                <div className="flex-1 min-h-0 flex flex-col mb-4">
                  {/* Error Message */}
                  {chatbotError && (
                    <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm flex-shrink-0" style={{
                      background: 'rgba(220, 38, 38, 0.1)',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      color: 'var(--color-error-text)',
                    }}>
                      <AlertCircle size={16} />
                      {chatbotError}
                    </div>
                  )}

                  {/* Chat History - Scrollable */}
                  <div 
                    className="flex-1 overflow-y-auto rounded-lg p-4"
                    style={{
                      background: 'var(--color-background)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {loadingChatHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                      </div>
                    ) : chatHistory.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <MessageSquare size={48} style={{ color: 'var(--color-text-tertiary)' }} className="mx-auto mb-4" />
                          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            Select sources and ask a question to get started
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatHistory.map((message, idx) => (
                          <div key={message._id || idx} className="space-y-3">
                            {/* User Prompt */}
                            <div className="flex justify-end">
                              <div 
                                className="max-w-[80%] p-3 rounded-lg"
                                style={{
                                  background: 'var(--color-primary-light)',
                                  border: '1px solid var(--color-primary)',
                                }}
                              >
                                <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                                  {message.prompt}
                                </div>
                              </div>
                            </div>

                            {/* AI Response */}
                            {message.isPending ? (
                              <div className="flex justify-start">
                                <div 
                                  className="max-w-[80%] p-3 rounded-lg"
                                  style={{
                                    background: 'var(--color-surface-dark)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                    <Loader2 size={16} className="animate-spin" />
                                    Processing...
                                  </div>
                                </div>
                              </div>
                            ) : message.response ? (
                              <div className="flex justify-start">
                                <div 
                                  className="max-w-[80%] p-3 rounded-lg"
                                  style={{
                                    background: 'var(--color-surface-dark)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  {/* Answer */}
                                  <div className="mb-3">
                                    <div className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-title)' }}>
                                      <Bot size={14} />
                                      Answer
                                    </div>
                                    <div 
                                      className="text-sm whitespace-pre-wrap"
                                      style={{ color: 'var(--color-text-primary)' }}
                                    >
                                      {message.response.answer || 'No answer provided'}
                                    </div>
                                  </div>

                                  {/* Sources */}
                                  {message.response.sources && message.response.sources.length > 0 && (
                                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                      <div className="text-xs font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--color-text-title)' }}>
                                        <FileText size={12} />
                                        Sources ({message.response.sources.length})
                                      </div>
                                      <div className="space-y-2">
                                        {message.response.sources.map((source, sourceIdx) => (
                                          <div
                                            key={sourceIdx}
                                            className="p-2 rounded text-xs"
                                            style={{
                                              background: 'var(--color-background)',
                                              border: '1px solid var(--color-border)',
                                            }}
                                          >
                                            <div className="flex items-start gap-2 mb-1">
                                              <div className="text-xs font-medium px-1.5 py-0.5 rounded" style={{
                                                background: source.type === 'page' ? 'var(--color-primary-light)' : 'var(--color-success-light)',
                                                color: source.type === 'page' ? 'var(--color-primary)' : 'var(--color-success)',
                                              }}>
                                                {source.type === 'page' ? 'Page' : 'Website'}
                                              </div>
                                              <div className="flex-1">
                                                <div className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                                  {source.title || 'Untitled'}
                                                </div>
                                                {source.url && (
                                                  <div className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                                                    {source.url}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {source.relevance && (
                                              <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                                                <span className="font-medium">Relevance: </span>
                                                {source.relevance}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {/* Scroll anchor */}
                        <div ref={chatHistoryEndRef} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Prompt Input - Fixed at Bottom */}
                <div className="flex-shrink-0 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex gap-2">
                    <textarea
                      value={chatbotPrompt}
                      onChange={(e) => setChatbotPrompt(e.target.value)}
                      placeholder="Enter your question about the ingested sources..."
                      className="flex-1 px-4 py-3 rounded-lg text-sm resize-none"
                      style={{
                        background: 'var(--color-background)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-primary)',
                        minHeight: '80px',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleChatbotQuery();
                        }
                      }}
                    />
                    <button
                      onClick={handleChatbotQuery}
                      disabled={isQuerying || !chatbotPrompt.trim() || selectedChatbotSources.size === 0}
                      className="px-4 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors flex-shrink-0"
                      style={{
                        background: isQuerying || !chatbotPrompt.trim() || selectedChatbotSources.size === 0
                          ? 'var(--color-surface-dark)'
                          : 'var(--color-primary)',
                        color: isQuerying || !chatbotPrompt.trim() || selectedChatbotSources.size === 0
                          ? 'var(--color-text-tertiary)'
                          : 'var(--color-text-primary)',
                        cursor: isQuerying || !chatbotPrompt.trim() || selectedChatbotSources.size === 0
                          ? 'not-allowed'
                          : 'pointer',
                      }}
                    >
                      {isQuerying ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

