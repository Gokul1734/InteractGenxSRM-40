// Background Service Worker - Browser Navigation Tracker
// This tracks ALL navigation events and stores them in a structured JSON format

// Backend Configuration
const API_BASE_URL = 'http://localhost:5000/api/tracking-files';

// Global state
let recordingData = null;
let isRecording = false;
let autoSaveTimeout = null;
let backendAvailable = true;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Browser Navigation Tracker installed');
  addEvent('EXTENSION_LOADED', {});
});

// Message handler from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_RECORDING') {
    startRecording(message.user_code, message.session_code)
      .then(() => {
        sendResponse({ success: true, backend_connected: backendAvailable });
      })
      .catch((error) => {
        console.error('Error starting recording:', error);
        sendResponse({ success: false, error: error.message });
      });
  } 
  else if (message.action === 'STOP_RECORDING') {
    stopRecording()
      .then((count) => {
        sendResponse({ success: true, event_count: count });
      })
      .catch((error) => {
        console.error('Error stopping recording:', error);
        sendResponse({ success: false, error: error.message });
      });
  }
  else if (message.action === 'GET_RECORDING_DATA') {
    sendResponse({ data: recordingData });
  }
  
  return true; // Keep message channel open for async response
});

// ============================================================================
// RECORDING CONTROL
// ============================================================================

async function startRecording(userCode, sessionCode) {
  console.log(`Starting recording for user ${userCode}, session ${sessionCode}`);
  
  isRecording = true;
  
  // Initialize new recording data structure
  recordingData = {
    user_code: userCode,
    session_code: sessionCode,
    recording_started_at: new Date().toISOString(),
    recording_ended_at: null,
    navigation_events: []
  };
  
  // Initialize session on backend
  try {
    const response = await fetch(`${API_BASE_URL}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_code: userCode,
        session_code: sessionCode
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      backendAvailable = true;
      console.log('✓ Backend session initialized:', result.data.folder);
    } else {
      backendAvailable = false;
      console.warn('⚠ Backend initialization failed');
    }
  } catch (error) {
    backendAvailable = false;
    console.error('❌ Backend connection failed:', error);
  }
  
  // Add recording started event
  addEvent('RECORDING_STARTED', {});
  
  // Capture snapshot of all currently open tabs
  captureExistingTabs();
  
  // Update storage
  chrome.storage.local.set({ 
    is_recording: true,
    event_count: 0 
  });
  
  // Initial save when starting
  scheduleAutoSave();
}

// Capture all currently open tabs when recording starts
async function captureExistingTabs() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    const allTabs = [];
    
    windows.forEach(window => {
      window.tabs.forEach(tab => {
        allTabs.push({
          tab_id: tab.id,
          window_id: tab.windowId,
          url: tab.url,
          title: tab.title,
          active: tab.active
        });
      });
    });
    
    addEvent('EXISTING_TABS_SNAPSHOT', {
      total_tabs: allTabs.length,
      tabs: allTabs
    });
  } catch (error) {
    console.error('Error capturing existing tabs:', error);
  }
}

// ============================================================================
// EVENT RECORDING
// ============================================================================

function addEvent(eventType, context) {
  if (!isRecording || !recordingData) {
    return;
  }
  
  const event = {
    event_type: eventType,
    timestamp: new Date().toISOString(),
    context: context
  };
  
  recordingData.navigation_events.push(event);
  
  // Update event count in storage and notify popup
  const count = recordingData.navigation_events.length;
  chrome.storage.local.set({ event_count: count });
  
  // Notify popup of count update (if open)
  chrome.runtime.sendMessage({ 
    action: 'EVENT_COUNT_UPDATE', 
    count: count 
  }).catch(() => {
    // Popup might be closed, ignore error
  });
  
  console.log(`EVENT: ${eventType}`, context);
  
  // Auto-save after each event (with debouncing)
  scheduleAutoSave();
}

// ============================================================================
// AUTO-SAVE FUNCTIONALITY
// ============================================================================

function scheduleAutoSave() {
  // Clear any pending auto-save
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // Schedule auto-save after 2 seconds of inactivity
  autoSaveTimeout = setTimeout(() => {
    saveToBackend();
  }, 2000);
}

async function saveToBackend() {
  if (!recordingData || !backendAvailable) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_code: recordingData.user_code,
        session_code: recordingData.session_code,
        data: recordingData
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✓ Backend updated: ${result.data.event_count} events`);
    } else {
      console.warn('⚠ Backend update failed:', result.message);
    }
  } catch (error) {
    console.error('❌ Backend update error:', error);
    backendAvailable = false;
  }
}

// Save immediately when recording stops
async function stopRecording() {
  console.log('Stopping recording');
  
  isRecording = false;
  
  if (recordingData) {
    recordingData.recording_ended_at = new Date().toISOString();
    
    // Final save to backend
    await saveToBackend();
    
    // Notify backend that session is stopped
    if (backendAvailable) {
      try {
        const response = await fetch(`${API_BASE_URL}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_code: recordingData.user_code,
            session_code: recordingData.session_code
          })
        });
        
        const result = await response.json();
        if (result.success) {
          console.log('✓ Backend session stopped');
        }
      } catch (error) {
        console.error('❌ Error stopping backend session:', error);
      }
    }
  }
  
  const eventCount = recordingData ? recordingData.navigation_events.length : 0;
  
  // Update storage
  chrome.storage.local.set({ 
    is_recording: false,
    event_count: eventCount
  });
  
  // Clear auto-save timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }
  
  return eventCount;
}

// ============================================================================
// WINDOW EVENTS (Simplified - removed to reduce noise)
// ============================================================================

// Note: Window events removed to focus on core navigation.
// TAB_OPEN/TAB_CLOSE already show activity across windows.

// ============================================================================
// TAB EVENTS
// ============================================================================

chrome.tabs.onCreated.addListener((tab) => {
  addEvent('TAB_OPEN', {
    tab_id: tab.id,
    window_id: tab.windowId,
    tab_index: tab.index,
    active: tab.active
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  addEvent('TAB_CLOSE', {
    tab_id: tabId,
    window_id: removeInfo.windowId,
    is_window_closing: removeInfo.isWindowClosing
  });
});

// TAB_ACTIVATED removed - now handled in PAGE_VISIBILITY tracking above

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only track when page is COMPLETELY loaded (definite state)
  if (changeInfo.status === 'complete' && tab.url) {
    // Skip internal Chrome pages
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      return;
    }
    
    // Check if it's a search FIRST (before PAGE_LOADED)
    // This makes chronological sense: search initiated the page load
    const isSearch = detectSearch(tab.url, tabId);
    
    // Then log that page completely loaded
    // If it was a search, we don't need separate PAGE_LOADED event
    if (!isSearch) {
      addEvent('PAGE_LOADED', {
        tab_id: tabId,
        url: tab.url,
        domain: extractDomain(tab.url),
        title: tab.title
      });
    }
  }
});

// ============================================================================
// WEB NAVIGATION EVENTS (Simplified - only definite actions)
// ============================================================================

chrome.webNavigation.onCommitted.addListener((details) => {
  // Only track definite user actions: reload, back, forward
  if (details.transitionType === 'reload') {
    addEvent('PAGE_RELOAD', {
      tab_id: details.tabId,
      url: details.url,
      domain: extractDomain(details.url)
    });
  }
  
  if (details.transitionQualifiers && details.transitionQualifiers.includes('forward_back')) {
    if (details.transitionQualifiers.includes('forward')) {
      addEvent('FORWARD_NAVIGATION', {
        tab_id: details.tabId,
        url: details.url,
        domain: extractDomain(details.url)
      });
    } else {
      addEvent('BACK_NAVIGATION', {
        tab_id: details.tabId,
        url: details.url,
        domain: extractDomain(details.url)
      });
    }
  }
  
  // Note: PAGE_URL_CHANGE removed - PAGE_LOADED captures the final URL
});

// ============================================================================
// SEARCH DETECTION
// ============================================================================

function detectSearch(url, tabId) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    let engine = null;
    let query = null;
    
    // Google
    if (hostname.includes('google.com') || hostname.includes('google.co')) {
      engine = 'google';
      query = urlObj.searchParams.get('q');
    }
    // Bing
    else if (hostname.includes('bing.com')) {
      engine = 'bing';
      query = urlObj.searchParams.get('q');
    }
    // DuckDuckGo
    else if (hostname.includes('duckduckgo.com')) {
      engine = 'duckduckgo';
      query = urlObj.searchParams.get('q');
    }
    // Yahoo
    else if (hostname.includes('yahoo.com')) {
      engine = 'yahoo';
      query = urlObj.searchParams.get('p');
    }
    // Baidu
    else if (hostname.includes('baidu.com')) {
      engine = 'baidu';
      query = urlObj.searchParams.get('wd');
    }
    // Yandex
    else if (hostname.includes('yandex.com') || hostname.includes('yandex.ru')) {
      engine = 'yandex';
      query = urlObj.searchParams.get('text');
    }
    // Ecosia
    else if (hostname.includes('ecosia.org')) {
      engine = 'ecosia';
      query = urlObj.searchParams.get('q');
    }
    // Brave Search
    else if (hostname.includes('search.brave.com')) {
      engine = 'brave';
      query = urlObj.searchParams.get('q');
    }
    // Startpage
    else if (hostname.includes('startpage.com')) {
      engine = 'startpage';
      query = urlObj.searchParams.get('query');
    }
    // Qwant
    else if (hostname.includes('qwant.com')) {
      engine = 'qwant';
      query = urlObj.searchParams.get('q');
    }
    
    // If search detected, record it
    if (engine && query) {
      addEvent('SEARCH', {
        tab_id: tabId,
        engine: engine,
        query: decodeURIComponent(query),
        url: url,
        domain: extractDomain(url)
      });
      return true; // Indicate this was a search
    }
    
    return false; // Not a search
    
  } catch (error) {
    // Invalid URL, ignore
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// WINDOW FOCUS TRACKING
// ============================================================================

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // User switched away from browser (e.g., to another app)
    addEvent('BROWSER_UNFOCUSED', {});
  } else {
    // User returned to browser
    addEvent('BROWSER_FOCUSED', {
      window_id: windowId
    });
  }
});

// ============================================================================
// PAGE VISIBILITY TRACKING
// ============================================================================

// Track when user switches between tabs (page becomes visible/hidden)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Get the newly activated tab
    const activeTab = await chrome.tabs.get(activeInfo.tabId);
    
    if (activeTab.url && !activeTab.url.startsWith('chrome://')) {
      addEvent('PAGE_VISIBLE', {
        tab_id: activeTab.id,
        url: activeTab.url,
        domain: extractDomain(activeTab.url),
        title: activeTab.title
      });
    }
    
    // Get all tabs in window to find which one was hidden
    const allTabs = await chrome.tabs.query({ windowId: activeInfo.windowId });
    allTabs.forEach(tab => {
      if (tab.id !== activeInfo.tabId && !tab.active && tab.url && !tab.url.startsWith('chrome://')) {
        // This tab was just hidden
        addEvent('PAGE_HIDDEN', {
          tab_id: tab.id,
          url: tab.url,
          domain: extractDomain(tab.url)
        });
      }
    });
  } catch (error) {
    // Ignore errors
  }
});

// ============================================================================
// CONSOLE LOGGING
// ============================================================================

console.log('Browser Navigation Tracker - Background Service Worker Loaded');

