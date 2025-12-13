// Background Service Worker - Browser Navigation Tracker
// This tracks ALL navigation events and stores them in a structured JSON format

// Import configuration
importScripts('config.js');
// API_BASE_URL is now available from config.js

// Global state
let recordingData = null;
let isRecording = false;
let autoSaveTimeout = null;
let backendAvailable = true;
let isSaving = false; // Prevent concurrent saves
let saveQueue = []; // Queue for pending saves
let retryAttempts = 0;
let maxRetries = 5;
let baseRetryDelay = 1000; // Start with 1 second

// Callout polling state
const CALLOUT_ALARM_NAME = 'callout_poll_alarm';
let lastCalloutTimestamp = null;
let seenCalloutIds = new Set(); // Track callouts we've already shown

// Initialize context menus (called on install and startup)
async function initializeContextMenus() {
  try {
    // Remove existing menus first to avoid duplicates
    await chrome.contextMenus.removeAll();
    
    chrome.contextMenus.create({
      id: 'cb_send_to_pages',
      title: 'Send selection to CoBrowser Pages',
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: 'cb_send_image_to_pages',
      title: 'Send image to CoBrowser Pages',
      contexts: ['image'],
    });
  } catch (e) {
    console.warn('Failed to create context menu:', e);
  }
}

// Restore recording state from storage (called on service worker startup)
async function restoreRecordingState() {
  try {
    const result = await chrome.storage.local.get([
      'user_code',
      'session_code',
      'is_recording',
      'callout_poll_active',
      'callout_last_timestamp',
      'callout_seen_ids'
    ]);

    if (result.is_recording && result.user_code && result.session_code) {
      console.log('🔄 Restoring recording state from storage');
      console.log(`   User: ${result.user_code}, Session: ${result.session_code}`);
      
      const normalizedUserCode = String(result.user_code).toUpperCase();
      const normalizedSessionCode = String(result.session_code);
      
      // Restore recording state
      isRecording = true;
      recordingData = {
        user_code: normalizedUserCode,
        session_code: normalizedSessionCode,
        recording_started_at: new Date().toISOString(), // Will be updated on next save
        recording_ended_at: null,
        navigation_events: []
      };
      
      // Restore callout polling state
      if (result.callout_last_timestamp) {
        lastCalloutTimestamp = result.callout_last_timestamp;
      }
      if (result.callout_seen_ids) {
        seenCalloutIds = new Set(result.callout_seen_ids);
      }
      
      // Mark that we're resuming (not starting fresh)
      addEvent('EXTENSION_RESUMED', {
        restored_from_storage: true
      });
      
      // Check if callout polling alarm exists, if not restart it
      const existingAlarm = await chrome.alarms.get(CALLOUT_ALARM_NAME);
      if (!existingAlarm) {
        console.log('📢 Restarting callout polling alarm...');
        await startCalloutPolling(normalizedUserCode, normalizedSessionCode);
      } else {
        console.log('📢 Callout polling alarm already exists');
      }
      
      console.log('✓ Recording state restored - tracking resumed');
    } else {
      console.log('ℹ No active recording to restore');
      // Make sure callout polling is stopped
      await stopCalloutPolling();
    }
  } catch (error) {
    console.error('Error restoring recording state:', error);
  }
}

// Initialize extension on install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('📦 Browser Navigation Tracker installed/updated');
  await initializeContextMenus();
  
  // Only add EXTENSION_LOADED event if we're actually recording
  if (isRecording) {
    addEvent('EXTENSION_LOADED', {});
  }
});

// Initialize extension on browser/Chrome startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('🚀 Browser Navigation Tracker - Browser startup detected');
  await initializeContextMenus();
  await restoreRecordingState();
});

// Also restore state when service worker wakes up (Manifest V3)
// This runs immediately when the service worker script loads
(async () => {
  console.log('⚡ Browser Navigation Tracker - Service Worker starting');
  await initializeContextMenus();
  await restoreRecordingState();
  console.log('✓ Service Worker initialized');
})();

// Pending clip payload is stored in session storage so it survives service worker suspension.
const PENDING_CLIP_KEY = 'cb_pending_clip';

async function setPendingClip(payload) {
  try {
    await chrome.storage.session.set({ [PENDING_CLIP_KEY]: payload });
  } catch (e) {
    // Fallback (older Chrome)
    await chrome.storage.local.set({ [PENDING_CLIP_KEY]: payload });
  }
}

async function openSendWindow() {
  const url = chrome.runtime.getURL('send.html');
  await chrome.windows.create({
    url,
    type: 'popup',
    width: 440,
    height: 640,
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'cb_send_to_pages' && info.menuItemId !== 'cb_send_image_to_pages') return;
  try {
    // Image: store image srcUrl as a pending clip of type "image"
    if (info.menuItemId === 'cb_send_image_to_pages') {
      const imageUrl = (info.srcUrl || '').trim();
      if (!imageUrl) return;

      await setPendingClip({
        type: 'image',
        imageUrl,
        sourceUrl: tab?.url || '',
        sourceTitle: tab?.title || '',
        capturedAt: new Date().toISOString(),
      });
      await openSendWindow();
      return;
    }

    let clip = {
      type: 'text',
      text: (info.selectionText || '').trim(),
      sourceUrl: tab?.url || '',
      sourceTitle: tab?.title || '',
      capturedAt: new Date().toISOString(),
    };

    // Prefer getting selection text from content script (more accurate) if available.
    if (tab?.id) {
      try {
        const resp = await chrome.tabs.sendMessage(tab.id, { action: 'CB_GET_SELECTION' });
        if (resp?.text) clip = { ...clip, ...resp };
      } catch {
        // ignore
      }
    }

    if (!clip.text) return;
    await setPendingClip(clip);
    await openSendWindow();
  } catch (e) {
    console.error('Failed to open send window:', e);
  }
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
  // Callout functionality
  else if (message.action === 'CREATE_CALLOUT') {
    (async () => {
      try {
        const result = await createCallout(message.user_code, message.session_code, message.message);
        console.log('Sending callout response:', result);
        sendResponse(result);
      } catch (error) {
        console.error('Error in CREATE_CALLOUT handler:', error);
        sendResponse({ success: false, error: error.message || 'Unknown error' });
      }
    })();
  }
  // Acknowledge callout
  else if (message.action === 'CB_ACKNOWLEDGE_CALLOUT') {
    (async () => {
      try {
        if (recordingData) {
          const result = await acknowledgeCallout(
            message.callout_id,
            recordingData.user_code,
            recordingData.user_name || recordingData.user_code
          );
          sendResponse(result);
        } else {
          sendResponse({ success: false, error: 'Not recording' });
        }
      } catch (error) {
        console.error('Error acknowledging callout:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
  }
  // Clip + Send to Pages
  else if (message.action === 'CB_SET_PENDING_CLIP') {
    setPendingClip({
      text: (message.text || '').toString(),
      sourceUrl: message.sourceUrl || sender?.tab?.url || '',
      sourceTitle: message.sourceTitle || sender?.tab?.title || '',
      capturedAt: message.capturedAt || new Date().toISOString(),
    })
      .then(() => sendResponse({ success: true }))
      .catch((e) => {
        console.error('Failed to set pending clip:', e);
        sendResponse({ success: false });
      });
  }
  else if (message.action === 'CB_OPEN_SEND_FROM_PAGE') {
    openSendWindow()
      .then(() => sendResponse({ success: true }))
      .catch((e) => {
        console.error('Failed to open send window:', e);
        sendResponse({ success: false });
      });
  }
  
  return true; // Keep message channel open for async response
});

// ============================================================================
// CALLOUT FUNCTIONALITY
// ============================================================================

/**
 * Create a callout for the current active tab
 * Captures: URL, title, scroll position, selected text
 */
async function createCallout(userCode, sessionCode, message = '') {
  console.log('📢 Creating callout...', { userCode, sessionCode, message });
  
  try {
    // Get the current active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
    
    if (!activeTab) {
      console.error('No active tab found');
      return { success: false, error: 'No active tab found' };
    }

    console.log('Active tab:', activeTab.url);

    // Skip internal Chrome pages
    if (activeTab.url.startsWith('chrome://') || 
        activeTab.url.startsWith('chrome-extension://') ||
        activeTab.url.startsWith('about:')) {
      return { success: false, error: 'Cannot create callout on browser internal pages' };
    }

    // Try to get scroll position and selected text from content script
    let scrollPosition = { x: 0, y: 0, y_percentage: 0 };
    let selectedText = null;

    try {
      const contentData = await chrome.tabs.sendMessage(activeTab.id, { 
        action: 'CB_GET_PAGE_DATA' 
      });
      
      if (contentData) {
        scrollPosition = contentData.scrollPosition || scrollPosition;
        selectedText = contentData.selectedText || null;
      }
      console.log('Content data received:', { scrollPosition, selectedText: !!selectedText });
    } catch (e) {
      // Content script might not be loaded on some pages
      console.warn('Could not get page data from content script:', e.message);
    }

    // Prepare callout data
    const calloutData = {
      session_code: sessionCode,
      user_code: userCode.toUpperCase(),
      page_url: activeTab.url,
      page_title: activeTab.title || '',
      page_favicon: activeTab.favIconUrl || '',
      scroll_position: scrollPosition,
      selected_text: selectedText,
      message: message || '',
      tab_context: {
        tab_id: activeTab.id,
        window_id: activeTab.windowId
      }
    };

    console.log('Sending callout to API:', `${API_ROOT}/callouts`);

    // Send to backend API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(`${API_ROOT}/callouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(calloutData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('API error:', response.status, errorText);
      return { success: false, error: `Server error: ${response.status}` };
    }

    const result = await response.json();
    console.log('API response:', result);

    if (result.success) {
      console.log('✓ Callout created:', result.data._id);
      
      // Also add as an event in tracking (if recording)
      if (isRecording && recordingData) {
        addEvent('CALLOUT_CREATED', {
          callout_id: result.data._id,
          page_url: calloutData.page_url,
          page_title: calloutData.page_title,
          message: calloutData.message,
          has_selection: !!selectedText
        });
      }
      
      return { success: true, data: result.data };
    } else {
      console.error('API returned failure:', result.message);
      return { success: false, error: result.message || 'Failed to create callout' };
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Callout request timed out');
      return { success: false, error: 'Request timed out. Please try again.' };
    }
    console.error('Error creating callout:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

// ============================================================================
// CALLOUT POLLING & NOTIFICATIONS (using Chrome Alarms for reliability)
// ============================================================================

/**
 * Start polling for new callouts in the session using Chrome Alarms API
 * This survives service worker suspension in Manifest V3
 */
async function startCalloutPolling(userCode, sessionCode) {
  // Stop any existing polling
  await stopCalloutPolling();
  
  console.log('📢 Starting callout polling for session:', sessionCode);
  
  // Store polling state in chrome.storage for persistence
  const now = new Date().toISOString();
  await chrome.storage.local.set({
    callout_poll_active: true,
    callout_poll_user: userCode.toUpperCase(),
    callout_poll_session: sessionCode,
    callout_last_timestamp: now,
    callout_seen_ids: []
  });
  
  // Reset local state
  lastCalloutTimestamp = now;
  seenCalloutIds.clear();
  
  // Poll immediately
  await pollForCallouts(userCode, sessionCode);
  
  // Create alarm to poll every 5 seconds
  // Note: Chrome alarms have a minimum of 1 minute in production, but we'll use 0.1 (6 seconds) for testing
  await chrome.alarms.create(CALLOUT_ALARM_NAME, {
    periodInMinutes: 0.1 // ~6 seconds (minimum supported)
  });
  
  console.log('📢 Callout alarm created');
}

/**
 * Stop callout polling
 */
async function stopCalloutPolling() {
  try {
    await chrome.alarms.clear(CALLOUT_ALARM_NAME);
    await chrome.storage.local.set({
      callout_poll_active: false
    });
    console.log('📢 Stopped callout polling');
  } catch (e) {
    console.warn('Error stopping callout polling:', e);
  }
}

/**
 * Handle alarm events - this is called when the alarm fires
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === CALLOUT_ALARM_NAME) {
    console.log('⏰ Callout poll alarm triggered');
    
    // Get stored polling state
    const state = await chrome.storage.local.get([
      'callout_poll_active',
      'callout_poll_user',
      'callout_poll_session',
      'callout_last_timestamp',
      'callout_seen_ids',
      'is_recording'
    ]);
    
    if (state.callout_poll_active && state.is_recording && state.callout_poll_session) {
      // Restore local state from storage
      lastCalloutTimestamp = state.callout_last_timestamp || new Date().toISOString();
      seenCalloutIds = new Set(state.callout_seen_ids || []);
      
      // Poll for callouts
      await pollForCallouts(state.callout_poll_user, state.callout_poll_session);
    } else {
      // Stop polling if not recording
      await stopCalloutPolling();
    }
  }
});

/**
 * Poll for new callouts and notify user
 */
async function pollForCallouts(userCode, sessionCode) {
  if (!sessionCode) return;
  
  // Check if still recording
  const state = await chrome.storage.local.get(['is_recording']);
  if (!state.is_recording) {
    console.log('📢 Not recording, skipping poll');
    return;
  }
  
  console.log('📢 Polling for callouts...', { userCode, sessionCode });
  
  try {
    // Build URL with query params
    const params = new URLSearchParams({
      exclude_user: userCode.toUpperCase()
    });
    
    // Only add 'since' if we have a timestamp
    if (lastCalloutTimestamp) {
      params.append('since', lastCalloutTimestamp);
    }
    
    const response = await fetch(
      `${API_ROOT}/callouts/session/${sessionCode}/active?${params}`,
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    if (!response.ok) {
      console.warn('Callout poll failed:', response.status);
      return;
    }
    
    const result = await response.json();
    console.log('📢 Poll result:', result.success, 'count:', result.data?.length || 0);
    
    if (result.success && result.data && result.data.length > 0) {
      // Update timestamp for next poll
      lastCalloutTimestamp = result.timestamp || new Date().toISOString();
      
      // Process new callouts
      let newCalloutCount = 0;
      for (const callout of result.data) {
        // Skip if we've already seen this callout
        if (seenCalloutIds.has(callout._id)) {
          console.log('📢 Skipping seen callout:', callout._id);
          continue;
        }
        
        // Mark as seen
        seenCalloutIds.add(callout._id);
        newCalloutCount++;
        
        console.log('📢 New callout detected:', callout._id, 'from', callout.user_name);
        
        // Show notification to user
        await showCalloutNotificationToUser(callout);
      }
      
      // Persist updated state
      await chrome.storage.local.set({
        callout_last_timestamp: lastCalloutTimestamp,
        callout_seen_ids: Array.from(seenCalloutIds)
      });
      
      if (newCalloutCount > 0) {
        console.log(`📢 Processed ${newCalloutCount} new callout(s)`);
      }
    }
  } catch (error) {
    console.warn('Error polling for callouts:', error.message);
  }
}

/**
 * Show callout notification to user via content script
 * Tries multiple methods to ensure notification is shown
 */
async function showCalloutNotificationToUser(callout) {
  console.log('📢 Showing notification for callout:', callout._id);
  
  let notificationShown = false;
  
  try {
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Find the active tab in the current window
    const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const activeTab = activeTabs[0];
    
    // First, try to show on the active tab
    if (activeTab && activeTab.url && isValidTabUrl(activeTab.url)) {
      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, {
          action: 'CB_SHOW_CALLOUT_NOTIFICATION',
          callout: callout
        });
        if (response && response.success) {
          console.log('📢 Notification shown on active tab:', activeTab.id);
          notificationShown = true;
        }
      } catch (e) {
        console.log('📢 Active tab unavailable, trying other tabs...');
      }
    }
    
    // If not shown yet, try all other tabs
    if (!notificationShown) {
      for (const tab of tabs) {
        if (tab.url && isValidTabUrl(tab.url) && tab.id !== activeTab?.id) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'CB_SHOW_CALLOUT_NOTIFICATION',
              callout: callout
            });
            if (response && response.success) {
              console.log('📢 Notification shown on tab:', tab.id);
              notificationShown = true;
              break;
            }
          } catch (e) {
            // Content script not loaded on this tab, continue
          }
        }
      }
    }
    
    // Always show Chrome notification as backup (appears in system tray)
    showChromeNotification(callout);
    
  } catch (error) {
    console.error('Error showing callout notification:', error);
    // Fallback to Chrome notification
    showChromeNotification(callout);
  }
}

/**
 * Check if tab URL is valid for content script
 */
function isValidTabUrl(url) {
  return url && 
    !url.startsWith('chrome://') && 
    !url.startsWith('chrome-extension://') && 
    !url.startsWith('about:') &&
    !url.startsWith('edge://') &&
    !url.startsWith('brave://');
}

/**
 * Show Chrome system notification
 */
function showChromeNotification(callout) {
  const iconDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAGASURBVFhH7ZY9TsMwGIZdlYUJVmZuwMTIyMgNOAIHYGRkZOQG3ICJkZGRGzAxMnIDsqCqSL+8dpyf2nFSp1JFeKRPseN837OJEzsJJSYm5r8xDAL7TirZ6qJu8hIEwmCw2+0Okyb0/NRLB4MgEMcHg6DrA+d+6qeOFJuBqoJ7J99YYPd8fAuwJpbLgMYS/TsLqGYCq9VqJ5MNnU6n0Wx4vTOBZgI4S7SQ1x0oEvgNAk2UHoLAcQTq1mhbNxL4KdBMA0UCP0Wgmd6vn/oJWAK4hCYBnAfUAmC324W7+/sTEZ+0Wq1n8p8JNNPAeYAv0IH7x8cTEd+USqUFYT8BnAeqAeCCEhWK+IIQXhLqBHACdRZQi4DneV9i+73X622I+8T9JZALwOv3+5fEve/7W+I3YjcBnEAdBE4qlUqb+Cd5Pxf3iF0FcAJlAji/BX7k+Xwe5fO8I7YVwAnkApD+FgifCoXCO/mIuC4ATiANAH8B7vr1el1F/IW4SwDnP5BI/AFTQIorMl9fdgAAAABJRU5ErkJggg==';
  
  try {
    chrome.notifications.create(`callout_${callout._id}`, {
      type: 'basic',
      iconUrl: iconDataUrl,
      title: `📢 Callout from ${callout.user_name}`,
      message: callout.message || `Check out: ${callout.page_title || callout.page_url}`,
      priority: 2,
      requireInteraction: true
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('Chrome notification error:', chrome.runtime.lastError.message);
        return;
      }
      console.log('📢 Chrome notification created:', notificationId);
      // Store callout data for when notification is clicked
      if (notificationId) {
        chrome.storage.local.set({
          [`notification_${notificationId}`]: callout
        });
      }
    });
  } catch (error) {
    console.error('Error creating Chrome notification:', error);
  }
}

/**
 * Acknowledge a callout
 */
async function acknowledgeCallout(calloutId, userCode, userName) {
  try {
    const response = await fetch(`${API_ROOT}/callouts/${calloutId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_code: userCode,
        user_name: userName
      })
    });
    
    const result = await response.json();
    console.log('Callout acknowledged:', result.success);
    return result;
  } catch (error) {
    console.error('Error acknowledging callout:', error);
    return { success: false, error: error.message };
  }
}

// Handle Chrome notification click
chrome.notifications.onClicked.addListener(async (notificationId) => {
  try {
    const data = await chrome.storage.local.get([`notification_${notificationId}`]);
    const callout = data[`notification_${notificationId}`];
    
    if (callout && callout.page_url) {
      // Open the callout URL in a new tab
      const tab = await chrome.tabs.create({ url: callout.page_url });
      
      // After a delay, scroll to position
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'CB_NAVIGATE_TO_CALLOUT',
            callout: callout
          });
        } catch (e) {
          // Content script might not be ready yet
        }
      }, 2000);
      
      // Clean up stored data
      chrome.storage.local.remove([`notification_${notificationId}`]);
    }
    
    // Close the notification
    chrome.notifications.clear(notificationId);
  } catch (error) {
    console.error('Error handling notification click:', error);
  }
});

// ============================================================================
// RECORDING CONTROL
// ============================================================================

async function startRecording(userCode, sessionCode) {
  // Ensure user_code and session_code are strings
  const normalizedUserCode = String(userCode).toUpperCase();
  const normalizedSessionCode = String(sessionCode);
  
  console.log(`Starting recording for user ${normalizedUserCode}, session ${normalizedSessionCode}`);
  
  isRecording = true;
  
  // Initialize new recording data structure
  recordingData = {
    user_code: normalizedUserCode,
    session_code: normalizedSessionCode,
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
        user_code: normalizedUserCode,
        session_code: normalizedSessionCode
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
    is_recording: true
  });
  
  // Reset save state when starting new recording
  isSaving = false;
  saveQueue = [];
  retryAttempts = 0;
  backendAvailable = true;
  
  // Initial save when starting
  scheduleAutoSave();
  
  // Start polling for callouts from team members
  startCalloutPolling(normalizedUserCode, normalizedSessionCode);
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
  
  console.log(`EVENT: ${eventType}`, context);
  
  // Check backend health if it was previously unavailable
  if (!backendAvailable && retryAttempts === 0) {
    checkBackendHealth().then(available => {
      if (available) {
        console.log('✓ Backend health check passed, resuming saves');
      }
    });
  }
  
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
    enqueueSave();
  }, 2000);
}

// Queue save operation to prevent concurrent saves
function enqueueSave(immediate = false) {
  if (!recordingData) {
    return;
  }
  
  // Create a save task
  const saveTask = {
    timestamp: Date.now(),
    immediate
  };
  
  // Add to queue if not already queued (prevent duplicate saves)
  const existingIndex = saveQueue.findIndex(
    task => Math.abs(task.timestamp - saveTask.timestamp) < 100
  );
  
  if (existingIndex === -1) {
    saveQueue.push(saveTask);
  } else if (immediate) {
    // Replace with immediate save
    saveQueue[existingIndex] = saveTask;
  }
  
  // Process queue
  processSaveQueue();
}

// Process save queue one at a time
async function processSaveQueue() {
  // Skip if already saving or no items in queue
  if (isSaving || saveQueue.length === 0) {
    return;
  }
  
  // Get the oldest save task (or immediate one if available)
  const immediateIndex = saveQueue.findIndex(task => task.immediate);
  const taskIndex = immediateIndex !== -1 ? immediateIndex : 0;
  const task = saveQueue[taskIndex];
  saveQueue.splice(taskIndex, 1);
  
  isSaving = true;
  
  try {
    await saveToBackend();
    // Success - reset retry counter and mark backend as available
    retryAttempts = 0;
    if (!backendAvailable) {
      backendAvailable = true;
      console.log('✓ Backend connection recovered');
    }
  } catch (error) {
    // Handle error with retry logic
    await handleSaveError(error);
  } finally {
    isSaving = false;
    // Process next item in queue if any
    if (saveQueue.length > 0) {
      setTimeout(() => processSaveQueue(), 100);
    }
  }
}

// Handle save errors with retry logic
async function handleSaveError(error) {
  const isNetworkError = error.name === 'TypeError' || 
                        error.message.includes('fetch') ||
                        error.message.includes('network') ||
                        error.message.includes('Failed to fetch');
  
  const isTimeoutError = error.name === 'AbortError' || 
                        error.message.includes('timeout');
  
  // If it's a network error or timeout, try to recover
  if ((isNetworkError || isTimeoutError) && retryAttempts < maxRetries) {
    retryAttempts++;
    const delay = baseRetryDelay * Math.pow(2, retryAttempts - 1); // Exponential backoff
    
    console.warn(`⚠ Save failed (attempt ${retryAttempts}/${maxRetries}), retrying in ${delay}ms...`, error.message);
    
    // Re-queue the save with delay
    setTimeout(() => {
      enqueueSave();
    }, delay);
    
    // Don't mark backend as unavailable yet if we're still retrying
    if (retryAttempts < maxRetries) {
      return;
    }
  }
  
  // Mark backend as unavailable only after max retries
  if (retryAttempts >= maxRetries) {
    backendAvailable = false;
    console.error(`❌ Backend unavailable after ${maxRetries} attempts. Will retry on next event.`);
    
    // Reset retry counter for next attempt (after user activity resumes)
    setTimeout(() => {
      retryAttempts = 0;
    }, 30000); // Reset after 30 seconds
  }
}

// Main save function with improved error handling
async function saveToBackend() {
  if (!recordingData) {
    throw new Error('No recording data available');
  }
  
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
  
  try {
    const response = await fetch(`${API_BASE_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_code: recordingData.user_code,
        session_code: recordingData.session_code,
        data: recordingData
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Check if response is ok
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✓ Backend updated: ${result.data.event_count} events`);
      return result;
    } else {
      throw new Error(result.message || 'Backend returned unsuccessful response');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Re-throw for retry logic
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 10 seconds');
    }
    throw error;
  }
}

// Health check function to test backend availability
async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health check
    
    // API_BASE_URL is already the base path, just append /health
    const healthUrl = API_BASE_URL.endsWith('/update') 
      ? API_BASE_URL.replace('/update', '/health')
      : `${API_BASE_URL}/health`;
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      backendAvailable = true;
      retryAttempts = 0;
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Save immediately when recording stops
async function stopRecording() {
  console.log('Stopping recording');
  
  isRecording = false;
  
  // Stop callout polling
  await stopCalloutPolling();
  
  if (recordingData) {
    recordingData.recording_ended_at = new Date().toISOString();
    
    // Final save to backend (enqueue as immediate to ensure it's processed first)
    enqueueSave(true);
    
    // Wait for save to complete (with timeout)
    let attempts = 0;
    while (isSaving && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    // Try one more time if backend was marked unavailable
    if (!backendAvailable && retryAttempts < maxRetries) {
      try {
        await saveToBackend();
        backendAvailable = true;
        retryAttempts = 0;
      } catch (error) {
        console.warn('Final save attempt failed:', error);
      }
    }
    
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
    is_recording: false
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

