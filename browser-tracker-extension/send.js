/* global PAGES_BASE_URL, ENVIRONMENT */

const PENDING_KEY = 'cb_pending_clip';

const clipPreview = document.getElementById('clipPreview');
const clipMeta = document.getElementById('clipMeta');
const envPill = document.getElementById('envPill');

const teamTab = document.getElementById('teamTab');
const personalTab = document.getElementById('personalTab');
const pageSelect = document.getElementById('pageSelect');
const refreshBtn = document.getElementById('refreshBtn');
const newBtn = document.getElementById('newBtn');
const newForm = document.getElementById('newForm');
const newTitle = document.getElementById('newTitle');
const createBtn = document.getElementById('createBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const sendBtn = document.getElementById('sendBtn');
const closeBtn = document.getElementById('closeBtn');
const statusEl = document.getElementById('status');
const destError = document.getElementById('destError');

let workspace = 'team'; // 'team' | 'personal'
let userCode = null;
let clip = null;
let teamPages = [];
let personalPages = [];

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function showError(msg) {
  if (!msg) {
    destError.style.display = 'none';
    destError.textContent = '';
    return;
  }
  destError.style.display = 'block';
  destError.textContent = msg;
}

function setWorkspace(next) {
  workspace = next;
  teamTab.classList.toggle('tabActive', workspace === 'team');
  personalTab.classList.toggle('tabActive', workspace === 'personal');
  renderSelect();
  showError('');
}

function option(label, value) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function renderSelect() {
  const list = workspace === 'team' ? teamPages : personalPages;
  pageSelect.innerHTML = '';
  if (!list.length) {
    pageSelect.appendChild(option('No pages yet — create one', ''));
    pageSelect.value = '';
    return;
  }
  list.forEach((p) => {
    pageSelect.appendChild(option(p.title || 'Untitled', p._id || p.id));
  });
}

async function apiJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `HTTP ${res.status}`);
  }
  return data;
}

async function loadUserCode() {
  const stored = await chrome.storage.local.get(['user_code']);
  userCode = stored.user_code ? String(stored.user_code).trim().toUpperCase() : null;
}

async function loadClip() {
  const getFrom = async (area) => {
    try {
      const out = await area.get([PENDING_KEY]);
      return out[PENDING_KEY] || null;
    } catch {
      return null;
    }
  };

  clip = (await getFrom(chrome.storage.session)) || (await getFrom(chrome.storage.local));
  const clipType = clip?.type || (clip?.imageUrl ? 'image' : 'text');
  clip.type = clipType;

  if (clipType === 'image') {
    if (!clip?.imageUrl) {
      clipPreview.textContent = '';
      clipMeta.textContent = '';
      showError('No image found. Right-click an image and choose "Send image to CoBrowser Pages".');
      return;
    }
    // Show a simple preview (as text) to avoid HTML injection in this window.
    clipPreview.textContent = `Image: ${clip.imageUrl}`;
  } else {
    if (!clip?.text) {
      clipPreview.textContent = '';
      clipMeta.textContent = '';
      showError('No copied/selected text found. Copy some text on a webpage and try again.');
      return;
    }
    clipPreview.textContent = clip.text;
  }

  const parts = [];
  if (clip.sourceTitle) parts.push(clip.sourceTitle);
  if (clip.sourceUrl) parts.push(clip.sourceUrl);
  if (clip.capturedAt) parts.push(clip.capturedAt);
  clipMeta.textContent = parts.join(' • ');
}

async function fetchImageAsDataUrl(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image (HTTP ${res.status})`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Failed to read image'));
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(blob);
  });
}

async function loadPages() {
  setStatus('Loading pages…');
  showError('');
  const [teamRes, personalRes] = await Promise.all([
    apiJson(`${PAGES_BASE_URL}/team`),
    userCode ? apiJson(`${PAGES_BASE_URL}/private/${encodeURIComponent(userCode)}`) : Promise.resolve({ data: [] }),
  ]);
  teamPages = teamRes.data || [];
  personalPages = personalRes.data || [];
  renderSelect();
  setStatus('');
}

function guessTitle() {
  if (clip?.sourceTitle) return clip.sourceTitle.slice(0, 80);
  if (clip?.text) return clip.text.trim().slice(0, 48) || 'Untitled';
  return 'Untitled';
}

async function createPage() {
  const title = (newTitle.value || '').trim() || guessTitle();
  setStatus('Creating page…');
  showError('');
  const created =
    workspace === 'team'
      ? await apiJson(`${PAGES_BASE_URL}/team`, {
          method: 'POST',
          body: JSON.stringify({
            title,
            contentHtml: '<p></p>',
            created_by_user_code: userCode || undefined,
          }),
        })
      : await apiJson(`${PAGES_BASE_URL}/private/${encodeURIComponent(userCode)}`, {
          method: 'POST',
          body: JSON.stringify({ title, contentHtml: '<p></p>' }),
        });

  // Update local list and select new page
  const p = created.data;
  if (workspace === 'team') teamPages = [p, ...teamPages];
  else personalPages = [p, ...personalPages];

  renderSelect();
  pageSelect.value = p._id || p.id;
  newForm.style.display = 'none';
  setStatus('Page created.');
  setTimeout(() => setStatus(''), 900);
}

async function appendToPage() {
  if (!clip) {
    showError('Nothing to send.');
    return;
  }
  const pageId = pageSelect.value;
  if (!pageId) {
    showError('Pick a page first (or create a new one).');
    return;
  }

  if (workspace === 'personal' && !userCode) {
    showError('No user_code set in the extension. Start recording once to set it, or enter it in the popup.');
    return;
  }

  setStatus('Appending…');
  showError('');

  const url =
    workspace === 'team'
      ? `${PAGES_BASE_URL}/team/${pageId}/append`
      : `${PAGES_BASE_URL}/private/${encodeURIComponent(userCode)}/${pageId}/append`;

  // Image: download and embed as data URL when possible (more reliable than hotlinking).
  if (clip.type === 'image') {
    let imageSrc = clip.imageUrl;
    try {
      imageSrc = await fetchImageAsDataUrl(clip.imageUrl);
    } catch (e) {
      // Fallback to hotlink if download fails
      console.warn('Image download failed, falling back to URL:', e);
    }

    await apiJson(url, {
      method: 'POST',
      body: JSON.stringify({
        type: 'image',
        imageSrc,
        imageUrl: clip.imageUrl,
        sourceUrl: clip.sourceUrl,
        sourceTitle: clip.sourceTitle,
        capturedAt: clip.capturedAt,
      }),
    });

    setStatus('Added image to page.');
    setTimeout(() => window.close(), 650);
    return;
  }

  await apiJson(url, {
    method: 'POST',
    body: JSON.stringify({
      type: 'text',
      text: clip.text,
      sourceUrl: clip.sourceUrl,
      sourceTitle: clip.sourceTitle,
      capturedAt: clip.capturedAt,
    }),
  });

  setStatus('Added to page.');
  setTimeout(() => window.close(), 650);
}

teamTab.addEventListener('click', () => setWorkspace('team'));
personalTab.addEventListener('click', () => setWorkspace('personal'));

refreshBtn.addEventListener('click', async () => {
  try {
    await loadPages();
  } catch (e) {
    showError(e.message || 'Failed to load pages');
    setStatus('');
  }
});

newBtn.addEventListener('click', () => {
  if (workspace === 'personal' && !userCode) {
    showError('Login/register on dashboard first so a user_code exists, then set it in the extension.');
    return;
  }
  newForm.style.display = newForm.style.display === 'none' ? 'block' : 'none';
  newTitle.value = guessTitle();
  if (newForm.style.display === 'block') newTitle.focus();
});

cancelCreateBtn.addEventListener('click', () => {
  newForm.style.display = 'none';
});

createBtn.addEventListener('click', async () => {
  try {
    await createPage();
  } catch (e) {
    showError(e.message || 'Failed to create page');
    setStatus('');
  }
});

sendBtn.addEventListener('click', async () => {
  try {
    await appendToPage();
  } catch (e) {
    showError(e.message || 'Failed to append to page');
    setStatus('');
  }
});

closeBtn.addEventListener('click', () => window.close());

async function boot() {
  envPill.textContent = ENVIRONMENT || 'local';
  await loadUserCode();
  await loadClip();
  // Load pages for both text clips and image clips
  if (!clip?.text && !clip?.imageUrl) return;
  try {
    await loadPages();
    // default workspace = personal if user has personal pages and no team pages
    if (personalPages.length && !teamPages.length) setWorkspace('personal');
  } catch (e) {
    showError(e.message || 'Failed to load pages');
    setStatus('');
  }
}

boot();


