// Content script: captures copied/selected text and offers "Send to Pages"
// Also handles callout notifications and deep-linking

const OVERLAY_ID = 'cb-send-overlay';
const CALLOUT_NOTIFICATION_ID = 'cb-callout-notification';

function getSelectionText() {
  try {
    return window.getSelection()?.toString() || '';
  } catch {
    return '';
  }
}

function removeOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.remove();
}

function showOverlay(textPreview) {
  removeOverlay();

  const wrap = document.createElement('div');
  wrap.id = OVERLAY_ID;
  wrap.style.position = 'fixed';
  wrap.style.right = '16px';
  wrap.style.bottom = '16px';
  wrap.style.zIndex = '2147483647';
  wrap.style.width = '320px';
  wrap.style.background = '#1C1C1E';
  wrap.style.border = '1px solid #3A3A3C';
  wrap.style.borderRadius = '12px';
  wrap.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)';
  wrap.style.padding = '12px';
  wrap.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  wrap.style.color = '#E5E5EA';

  const title = document.createElement('div');
  title.textContent = 'Copy captured';
  title.style.fontSize = '12px';
  title.style.color = '#D1D1D6';
  title.style.fontWeight = '600';
  title.style.marginBottom = '8px';

  const preview = document.createElement('div');
  preview.textContent = textPreview;
  preview.style.fontSize = '12px';
  preview.style.color = '#8E8E93';
  preview.style.lineHeight = '1.4';
  preview.style.maxHeight = '54px';
  preview.style.overflow = 'hidden';
  preview.style.marginBottom = '10px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '8px';

  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send to Pages';
  sendBtn.style.flex = '1';
  sendBtn.style.background = '#5B6B9E';
  sendBtn.style.border = '1px solid #4A5887';
  sendBtn.style.color = '#E5E5EA';
  sendBtn.style.padding = '8px 10px';
  sendBtn.style.borderRadius = '10px';
  sendBtn.style.cursor = 'pointer';
  sendBtn.style.fontSize = '12px';
  sendBtn.style.fontWeight = '600';

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.style.background = 'transparent';
  dismissBtn.style.border = '1px solid #3A3A3C';
  dismissBtn.style.color = '#8E8E93';
  dismissBtn.style.padding = '8px 10px';
  dismissBtn.style.borderRadius = '10px';
  dismissBtn.style.cursor = 'pointer';
  dismissBtn.style.fontSize = '12px';
  dismissBtn.style.fontWeight = '600';

  sendBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'CB_OPEN_SEND_FROM_PAGE' });
    } catch {
      // ignore
    } finally {
      removeOverlay();
    }
  });

  dismissBtn.addEventListener('click', removeOverlay);

  row.appendChild(sendBtn);
  row.appendChild(dismissBtn);

  wrap.appendChild(title);
  wrap.appendChild(preview);
  wrap.appendChild(row);

  document.documentElement.appendChild(wrap);

  // Auto-dismiss after a few seconds
  setTimeout(removeOverlay, 8000);
}

// When user copies, store the selection and show the option
document.addEventListener(
  'copy',
  async () => {
    const text = getSelectionText().trim();
    if (!text) return;

    try {
      await chrome.runtime.sendMessage({
        action: 'CB_SET_PENDING_CLIP',
        text,
        sourceUrl: location.href,
        sourceTitle: document.title || '',
        capturedAt: new Date().toISOString(),
      });
    } catch {
      // ignore
    }

    showOverlay(text.length > 180 ? `${text.slice(0, 180)}…` : text);
  },
  true
);

// ============================================================================
// CALLOUT NOTIFICATION SYSTEM
// ============================================================================

// Remove callout notification
function removeCalloutNotification() {
  const el = document.getElementById(CALLOUT_NOTIFICATION_ID);
  if (el) {
    el.style.animation = 'cbSlideOut 0.3s ease-out forwards';
    setTimeout(() => el.remove(), 300);
  }
}

// Inject CSS styles for callout notification
function injectCalloutStyles() {
  if (document.getElementById('cb-callout-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'cb-callout-styles';
  style.textContent = `
    @keyframes cbSlideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes cbSlideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    @keyframes cbPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes cbRing {
      0% { transform: rotate(0deg); }
      10% { transform: rotate(15deg); }
      20% { transform: rotate(-15deg); }
      30% { transform: rotate(10deg); }
      40% { transform: rotate(-10deg); }
      50% { transform: rotate(5deg); }
      60% { transform: rotate(-5deg); }
      70% { transform: rotate(0deg); }
      100% { transform: rotate(0deg); }
    }
    #${CALLOUT_NOTIFICATION_ID} {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      width: 380px;
      background: linear-gradient(135deg, #1C1C1E 0%, #161618 100%);
      border: 1px solid rgba(91, 107, 158, 0.3);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(91, 107, 158, 0.15);
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #E5E5EA;
      animation: cbSlideIn 0.4s ease-out;
      overflow: hidden;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-header {
      background: linear-gradient(135deg, rgba(91, 107, 158, 0.2) 0%, rgba(91, 107, 158, 0.05) 100%);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(91, 107, 158, 0.2);
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-icon {
      font-size: 24px;
      animation: cbRing 1s ease-in-out;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-header-text {
      flex: 1;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-title {
      font-size: 14px;
      font-weight: 700;
      color: #7B8BB8;
      margin-bottom: 2px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-subtitle {
      font-size: 11px;
      color: #8E8E93;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-close {
      background: transparent;
      border: none;
      color: #636366;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-close:hover {
      background: rgba(255,255,255,0.1);
      color: #E5E5EA;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-body {
      padding: 16px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-user {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #5B6B9E 0%, #4A5887 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      color: #FFFFFF;
      flex-shrink: 0;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-user-info {
      flex: 1;
      min-width: 0;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-user-name {
      font-size: 14px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 2px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-user-code {
      font-size: 11px;
      color: #8E8E93;
      font-family: 'SF Mono', Monaco, monospace;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-message {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #D1D1D6;
      line-height: 1.5;
      border-left: 3px solid #5B6B9E;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-page-info {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 16px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-page-title {
      font-size: 13px;
      font-weight: 600;
      color: #FFFFFF;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-page-url {
      font-size: 11px;
      color: #7B8BB8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-selection {
      background: rgba(91, 107, 158, 0.1);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 14px;
      font-size: 12px;
      color: #A8B4D4;
      font-style: italic;
      border: 1px dashed rgba(91, 107, 158, 0.3);
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-selection::before {
      content: '"';
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-selection::after {
      content: '"';
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-actions {
      display: flex;
      gap: 10px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-btn {
      flex: 1;
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-btn-primary {
      background: linear-gradient(135deg, #5B6B9E 0%, #4A5887 100%);
      color: #FFFFFF;
      border: 1px solid #4A5887;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-btn-primary:hover {
      background: linear-gradient(135deg, #6575A8 0%, #5B6B9E 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(91, 107, 158, 0.4);
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-btn-secondary {
      background: linear-gradient(135deg, #2C2C2E 0%, #1C1C1E 100%);
      color: #8E8E93;
      border: 1px solid #3A3A3C;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-btn-secondary:hover {
      background: linear-gradient(135deg, #3A3A3C 0%, #2C2C2E 100%);
      color: #AEAEB2;
      border-color: #48484A;
    }
    #${CALLOUT_NOTIFICATION_ID} .cb-time {
      text-align: center;
      font-size: 10px;
      color: #636366;
      margin-top: 12px;
    }
  `;
  document.head.appendChild(style);
}

// Show callout notification popup
function showCalloutNotification(callout) {
  // Inject styles first
  injectCalloutStyles();
  
  // Remove any existing notification
  const existing = document.getElementById(CALLOUT_NOTIFICATION_ID);
  if (existing) existing.remove();
  
  // Get user initials
  const initials = (callout.user_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  // Format time
  const timeAgo = getTimeAgo(new Date(callout.created_at));
  
  // Truncate URL for display
  const displayUrl = callout.page_url.length > 50 
    ? callout.page_url.substring(0, 50) + '...' 
    : callout.page_url;
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = CALLOUT_NOTIFICATION_ID;
  
  notification.innerHTML = `
    <div class="cb-header">
      <span class="cb-icon">📢</span>
      <div class="cb-header-text">
        <div class="cb-title">Team Callout!</div>
        <div class="cb-subtitle">Someone wants your attention</div>
      </div>
      <button class="cb-close" title="Dismiss">×</button>
    </div>
    <div class="cb-body">
      <div class="cb-user">
        <div class="cb-avatar">${initials}</div>
        <div class="cb-user-info">
          <div class="cb-user-name">${escapeHtml(callout.user_name || 'Team Member')}</div>
          <div class="cb-user-code">${callout.user_code}</div>
        </div>
      </div>
      ${callout.message ? `<div class="cb-message">${escapeHtml(callout.message)}</div>` : ''}
      ${callout.selected_text ? `<div class="cb-selection">${escapeHtml(callout.selected_text.substring(0, 150))}${callout.selected_text.length > 150 ? '...' : ''}</div>` : ''}
      <div class="cb-page-info">
        <div class="cb-page-title">📄 ${escapeHtml(callout.page_title || 'Untitled Page')}</div>
        <div class="cb-page-url">${escapeHtml(displayUrl)}</div>
      </div>
      <div class="cb-actions">
        <button class="cb-btn cb-btn-primary" data-action="goto">
          <span>🚀</span> Go to Page
        </button>
        <button class="cb-btn cb-btn-secondary" data-action="dismiss">
          Dismiss
        </button>
      </div>
      <div class="cb-time">${timeAgo}</div>
    </div>
  `;
  
  // Add event listeners
  notification.querySelector('.cb-close').addEventListener('click', removeCalloutNotification);
  notification.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
    acknowledgeCallout(callout._id);
    removeCalloutNotification();
  });
  notification.querySelector('[data-action="goto"]').addEventListener('click', () => {
    navigateToCallout(callout);
    acknowledgeCallout(callout._id);
    removeCalloutNotification();
  });
  
  // Add to page
  document.documentElement.appendChild(notification);
  
  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    const el = document.getElementById(CALLOUT_NOTIFICATION_ID);
    if (el) removeCalloutNotification();
  }, 30000);
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Helper: Get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

// Navigate to the callout page and scroll
function navigateToCallout(callout) {
  console.log('📍 Navigating to callout:', callout.page_url, 'scroll:', callout.scroll_position);
  
  const currentUrl = window.location.href.split('#')[0].split('?')[0];
  const targetUrl = callout.page_url.split('#')[0].split('?')[0];
  
  // Normalize URLs for comparison (remove trailing slashes)
  const normalizedCurrent = currentUrl.replace(/\/$/, '');
  const normalizedTarget = targetUrl.replace(/\/$/, '');
  
  if (normalizedCurrent === normalizedTarget) {
    // Same page - just scroll
    console.log('📍 Same page - scrolling directly');
    scrollToPosition(callout.scroll_position);
  } else {
    // Different page - navigate with scroll position stored
    console.log('📍 Different page - navigating and storing scroll target');
    const scrollData = {
      y: callout.scroll_position?.y || 0,
      x: callout.scroll_position?.x || 0,
      timestamp: Date.now()
    };
    // Store scroll target in both session and local storage for reliability
    try {
      sessionStorage.setItem('cb_scroll_target', JSON.stringify(scrollData));
      localStorage.setItem('cb_scroll_target', JSON.stringify(scrollData));
    } catch (e) {
      console.warn('Could not store scroll target:', e);
    }
    // Navigate to the page
    window.location.href = callout.page_url;
  }
}

// Scroll to position with smooth animation
function scrollToPosition(position) {
  console.log('📍 Scrolling to position:', position);
  
  const targetY = (position && position.y) ? position.y : 0;
  const targetX = (position && position.x) ? position.x : 0;
  
  // First, scroll instantly to near the target (for long pages)
  window.scrollTo(targetX, Math.max(0, targetY - 200));
  
  // Then smooth scroll to exact position
  setTimeout(() => {
    window.scrollTo({
      top: targetY,
      left: targetX,
      behavior: 'smooth'
    });
    
    // Show highlight after scroll completes
    setTimeout(() => {
      showScrollHighlight(targetY);
    }, 600);
  }, 100);
  
  console.log('📍 Scroll initiated to Y:', targetY);
}

// Show a visual highlight at the scroll position
function showScrollHighlight(y) {
  console.log('📍 Showing highlight at Y:', y);
  
  // Remove any existing highlights
  const existingHighlight = document.getElementById('cb-scroll-highlight');
  if (existingHighlight) existingHighlight.remove();
  
  const highlight = document.createElement('div');
  highlight.id = 'cb-scroll-highlight';
  highlight.style.cssText = `
    position: absolute;
    top: ${y}px;
    left: 0;
    right: 0;
    height: 150px;
    background: linear-gradient(180deg, rgba(91, 107, 158, 0.4) 0%, rgba(91, 107, 158, 0.1) 50%, transparent 100%);
    pointer-events: none;
    z-index: 2147483646;
    border-top: 3px solid #5B6B9E;
    box-shadow: 0 0 30px rgba(91, 107, 158, 0.5);
  `;
  
  // Add pulsing animation
  const style = document.createElement('style');
  style.id = 'cb-highlight-style';
  style.textContent = `
    @keyframes cbHighlightPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes cbHighlightFade {
      0% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }
    #cb-scroll-highlight {
      animation: cbHighlightPulse 0.5s ease-in-out 3, cbHighlightFade 3s ease-out forwards;
    }
  `;
  
  // Remove old style if exists
  const oldStyle = document.getElementById('cb-highlight-style');
  if (oldStyle) oldStyle.remove();
  
  document.head.appendChild(style);
  document.body.appendChild(highlight);
  
  // Clean up after animation
  setTimeout(() => {
    highlight.remove();
    style.remove();
  }, 3000);
}

// Acknowledge callout via background script
async function acknowledgeCallout(calloutId) {
  try {
    await chrome.runtime.sendMessage({
      action: 'CB_ACKNOWLEDGE_CALLOUT',
      callout_id: calloutId
    });
  } catch (e) {
    // Ignore errors
  }
}

// Check for pending scroll target on page load
function checkPendingScroll() {
  console.log('📍 Checking for pending scroll target...');
  
  try {
    // Try sessionStorage first, then localStorage
    let scrollTarget = sessionStorage.getItem('cb_scroll_target') || localStorage.getItem('cb_scroll_target');
    
    if (scrollTarget) {
      const target = JSON.parse(scrollTarget);
      console.log('📍 Found scroll target:', target);
      
      // Only use if less than 30 seconds old
      if (Date.now() - target.timestamp < 30000) {
        // Wait for page to fully render, then scroll
        const doScroll = () => {
          console.log('📍 Executing pending scroll to Y:', target.y);
          scrollToPosition({ y: target.y, x: target.x || 0 });
        };
        
        // Try multiple times to ensure page is ready
        setTimeout(doScroll, 500);
        setTimeout(doScroll, 1500); // Retry in case page wasn't ready
      } else {
        console.log('📍 Scroll target too old, ignoring');
      }
      
      // Clean up
      sessionStorage.removeItem('cb_scroll_target');
      localStorage.removeItem('cb_scroll_target');
    } else {
      console.log('📍 No pending scroll target found');
    }
  } catch (e) {
    console.warn('📍 Error checking pending scroll:', e);
  }
}

// Run on page load - use multiple strategies to ensure it runs
if (document.readyState === 'complete') {
  checkPendingScroll();
} else {
  window.addEventListener('load', checkPendingScroll);
  // Also try on DOMContentLoaded as backup
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkPendingScroll, 100);
  });
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

// Allow background context menu to request selection text
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.action === 'CB_GET_SELECTION') {
    sendResponse({
      text: getSelectionText().trim(),
      sourceUrl: location.href,
      sourceTitle: document.title || '',
      capturedAt: new Date().toISOString(),
    });
    return true;
  }
  
  // Get page data for callout functionality
  if (msg?.action === 'CB_GET_PAGE_DATA') {
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    
    // Calculate scroll percentage
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    const windowHeight = window.innerHeight;
    const maxScroll = documentHeight - windowHeight;
    const scrollPercentage = maxScroll > 0 ? (scrollY / maxScroll) * 100 : 0;
    
    sendResponse({
      scrollPosition: {
        x: Math.round(scrollX),
        y: Math.round(scrollY),
        y_percentage: Math.round(scrollPercentage * 100) / 100 // Round to 2 decimal places
      },
      selectedText: getSelectionText().trim() || null,
      sourceUrl: location.href,
      sourceTitle: document.title || '',
      capturedAt: new Date().toISOString(),
    });
    return true;
  }
  
  // Show callout notification
  if (msg?.action === 'CB_SHOW_CALLOUT_NOTIFICATION') {
    if (msg.callout) {
      showCalloutNotification(msg.callout);
    }
    sendResponse({ success: true });
    return true;
  }
  
  // Navigate to callout (deep link)
  if (msg?.action === 'CB_NAVIGATE_TO_CALLOUT') {
    if (msg.callout) {
      navigateToCallout(msg.callout);
    }
    sendResponse({ success: true });
    return true;
  }
});


