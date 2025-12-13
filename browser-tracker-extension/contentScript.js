// Content script: captures copied/selected text and offers "Send to Pages"

const OVERLAY_ID = 'cb-send-overlay';

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
});


