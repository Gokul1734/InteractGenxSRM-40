import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pagesAPI } from '../services/api.js';
import {
  FileText,
  Plus,
  Trash2,
  Users,
  User,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';

const STORAGE_KEY = 'cobrowser_pages_v1';

function uid() {
  return `pg_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function defaultState() {
  const teamId = uid();
  const personalId = uid();
  return {
    version: 1,
    selected: { workspace: 'team', pageId: teamId },
    workspaces: {
      team: [
        {
          id: teamId,
          title: 'Team Notes',
          contentHtml: '<p>Shared notes for the team workspace.</p>',
          updatedAt: nowIso(),
        },
      ],
      personal: [
        {
          id: personalId,
          title: 'Personal Notes',
          contentHtml: '<p>Private notes for your personal workspace.</p>',
          updatedAt: nowIso(),
        },
      ],
    },
  };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function normalizeClipBlocks(rootEl) {
  try {
    if (!rootEl) return;

    // Ensure clips remain editable, but always leave an editable paragraph after them
    // so users can click below and continue typing outside the clip.
    rootEl.querySelectorAll('.cb-clip').forEach((el) => {
      el.removeAttribute('contenteditable');

      const next = el.nextSibling;
      const isNextEditableParagraph =
        next && next.nodeType === Node.ELEMENT_NODE && next.nodeName === 'P';

      if (!isNextEditableParagraph) {
        const p = document.createElement('p');
        p.innerHTML = '<br/>';
        el.after(p);
      }
    });
  } catch {
    // ignore
  }
}

function normalizeImageBlocks(rootEl) {
  try {
    if (!rootEl) return;
    rootEl.querySelectorAll('.cb-image-block').forEach((el) => {
      // Prevent HTML5 drag/drop jitter. We implement smooth pointer-drag instead.
      el.setAttribute('draggable', 'false');
    });
  } catch {
    // ignore
  }
}

function SidebarSection({
  icon: Icon,
  title,
  workspaceKey,
  pages,
  selectedPageId,
  onSelect,
  onAdd,
  onDelete,
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <div className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.04em' }}>
            {title}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAdd(workspaceKey)}
          className="rounded-md p-1"
          style={{
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-dark)',
            color: 'var(--color-text-secondary)',
          }}
          aria-label={`Add page to ${title}`}
          title="Add page"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1">
        {pages.map((p) => {
          const isActive = p.id === selectedPageId;
          return (
            <div
              key={p.id}
              className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2"
              style={{
                background: isActive ? 'var(--color-surface)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'var(--color-border-hover)' : 'transparent',
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(workspaceKey, p.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                title={p.title}
              >
                <FileText size={14} style={{ color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }} />
                <span className="truncate text-sm font-medium">{p.title || 'Untitled'}</span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(workspaceKey, p.id)}
                className="invisible rounded-md p-1 group-hover:visible"
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                }}
                aria-label="Delete page"
                title="Delete page"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PagesDashboard({ user }) {
  const initial = useMemo(() => loadInitialState() ?? defaultState(), []);
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const saveTimer = useRef(null);
  const remoteSaveTimerRef = useRef(null);
  const pendingRemoteRef = useRef({ workspace: null, id: null, patch: {} });
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectionRef = useRef(null);
  const draggedImageIdRef = useRef(null);
  const imgDragRef = useRef({
    active: false,
    ghostEl: null,
    placeholderEl: null,
    blockEl: null,
    offsetX: 0,
    offsetY: 0,
    rafId: 0,
    x: 0,
    y: 0,
  });

  const userCode = user?.user_code ? String(user.user_code).trim().toUpperCase() : null;
  const lastLocalEditAtRef = useRef(0);
  const scrollByPageRef = useRef({});

  useEffect(() => {
    // slide in
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // debounced persistence
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveState(state), 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  // Load from backend (MongoDB) into the two workspaces:
  // - team => TeamPage collection
  // - personal => PrivatePage collection (linked to User by user_code)
  const normalizeRemotePage = (p) => ({
    id: p._id || p.id,
    title: p.title || 'Untitled',
    contentHtml: p.contentHtml ?? '<p></p>',
    updatedAt: p.updatedAt || p.updated_at || nowIso(),
  });

  const isCurrentlyEditingSelected = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    const active = document.activeElement === editor;
    const recent = Date.now() - (lastLocalEditAtRef.current || 0) < 1200;
    return active && recent;
  };

  const fetchPagesAndMerge = async ({ showSpinner = false } = {}) => {
    if (showSpinner) setLoading(true);
    setLoadError('');

    const [teamRes, personalRes] = await Promise.all([
      pagesAPI.getTeam(),
      userCode ? pagesAPI.getPrivate(userCode) : Promise.resolve({ success: true, data: [] }),
    ]);

    const remoteTeam = (teamRes.data || []).map(normalizeRemotePage);
    const remotePersonal = (personalRes.data || []).map(normalizeRemotePage);

    setState((prev) => {
      const next = {
        ...prev,
        workspaces: {
          team: remoteTeam,
          personal: remotePersonal,
        },
      };

      // If user is actively editing selected page, keep local selected page content/title in state
      // (prevents poll from clobbering in-progress typing).
      if (isCurrentlyEditingSelected()) {
        const w = prev.selected.workspace;
        const id = prev.selected.pageId;
        const localList = prev.workspaces[w] || [];
        const localSelected = localList.find((p) => p.id === id);
        if (localSelected) {
          next.workspaces[w] = (next.workspaces[w] || []).map((p) => (p.id === id ? localSelected : p));
        }
      }

      // Ensure selection stays valid after refresh
      const w = next.selected?.workspace || 'team';
      const id = next.selected?.pageId;
      const list = next.workspaces[w] || [];
      const exists = id && list.some((p) => p.id === id);

      if (!exists) {
        const fallbackWorkspace = remoteTeam.length ? 'team' : remotePersonal.length ? 'personal' : 'team';
        const fallbackPage = next.workspaces[fallbackWorkspace]?.[0] || null;
        next.selected = { workspace: fallbackWorkspace, pageId: fallbackPage?.id || null };
      }

      return next;
    });
  };

  // Initial load (shows spinner)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchPagesAndMerge({ showSpinner: true });
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || 'Failed to load pages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCode]);

  // Continuous retrier: keep pulling latest pages in near-realtime.
  // User-requested: poll every 500ms. We also prevent overlapping fetches.
  useEffect(() => {
    let cancelled = false;
    const delayMs = 500;
    let timer = null;
    let inFlight = false;

    const tick = async () => {
      if (cancelled) return;
      if (inFlight) {
        timer = setTimeout(tick, delayMs);
        return;
      }
      inFlight = true;
      try {
        await fetchPagesAndMerge({ showSpinner: false });
      } catch (err) {
        console.warn('Pages live refresh failed:', err);
      } finally {
        inFlight = false;
        if (!cancelled) {
          timer = setTimeout(tick, delayMs);
        }
      }
    };

    timer = setTimeout(tick, delayMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userCode]);

  const selectedWorkspaceKey = state.selected.workspace;
  const selectedPageId = state.selected.pageId;

  const selectedPage = useMemo(() => {
    const list = state.workspaces[selectedWorkspaceKey] || [];
    return list.find((p) => p.id === selectedPageId) || null;
  }, [state, selectedWorkspaceKey, selectedPageId]);

  // Migrate legacy "content" -> "contentHtml"
  useEffect(() => {
    setState((prev) => {
      const migrateList = (list) =>
        (list || []).map((p) => {
          if (p.contentHtml != null) return p;
          const text = typeof p.content === 'string' ? p.content : '';
          const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');
          const { content, ...rest } = p;
          return { ...rest, contentHtml: escaped ? `<p>${escaped}</p>` : '<p></p>' };
        });

      const next = {
        ...prev,
        workspaces: {
          team: migrateList(prev.workspaces?.team),
          personal: migrateList(prev.workspaces?.personal),
        },
      };
      return next;
    });
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selection changes, update editor HTML without re-rendering the contentEditable children
  // Hydrate editor HTML as soon as the editor mounts (important when loading flips from true->false),
  // and keep scroll position stable when remote refresh updates content.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (loading) return;

    const html = selectedPage?.contentHtml ?? '';
    // Don't stomp the editor DOM while the user is actively typing.
    if (isCurrentlyEditingSelected()) return;

    if (editor.innerHTML !== html) {
      const key = `${selectedWorkspaceKey}:${selectedPageId}`;
      const prevScrollTop = scrollByPageRef.current[key] ?? editor.scrollTop ?? 0;

      editor.innerHTML = html;
      // Ensure clipped blocks stay editable, and typing outside remains easy.
      normalizeClipBlocks(editor);
      normalizeImageBlocks(editor);

      // Restore scroll (best-effort)
      editor.scrollTop = prevScrollTop;
    }
  }, [loading, selectedWorkspaceKey, selectedPageId, selectedPage?.contentHtml]);

  const saveSelection = () => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const editor = editorRef.current;
      if (!editor) return;
      if (editor.contains(range.commonAncestorContainer)) {
        selectionRef.current = range.cloneRange();
      }
    } catch {
      // ignore
    }
  };

  const restoreSelection = () => {
    try {
      const editor = editorRef.current;
      const sel = window.getSelection();
      if (!editor || !sel) return;

      // Prefer live selection if it's already inside the editor.
      if (sel.rangeCount > 0) {
        const live = sel.getRangeAt(0);
        if (editor.contains(live.commonAncestorContainer)) {
          return;
        }
      }

      const saved = selectionRef.current;
      if (saved && editor.contains(saved.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(saved);
        return;
      }

      // Fallback: put caret at end of editor (prevents "stuck" toggles).
      const end = document.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
      selectionRef.current = end.cloneRange();
    } catch {
      // ignore
    }
  };

  const selectPage = (workspaceKey, pageId) => {
    setState((prev) => ({
      ...prev,
      selected: { workspace: workspaceKey, pageId },
    }));
  };

  const addPage = async (workspaceKey) => {
    try {
      if (workspaceKey === 'personal' && !userCode) {
        alert('Please login to create private pages.');
        return;
      }
      // Create in backend first (source of truth), then add to UI.
      const created =
        workspaceKey === 'team'
          ? await pagesAPI.createTeam({
              title: 'Untitled',
              contentHtml: '<p></p>',
              created_by_user_code: userCode || undefined,
            })
          : await pagesAPI.createPrivate(userCode, { title: 'Untitled', contentHtml: '<p></p>' });

      const p = created?.data;
      const newPage = {
        id: p?._id || p?.id,
        title: p?.title || 'Untitled',
        contentHtml: p?.contentHtml ?? '<p></p>',
        updatedAt: p?.updatedAt || nowIso(),
      };

      setState((prev) => ({
        ...prev,
        selected: { workspace: workspaceKey, pageId: newPage.id },
        workspaces: {
          ...prev.workspaces,
          [workspaceKey]: [newPage, ...(prev.workspaces[workspaceKey] || [])],
        },
      }));
    } catch (err) {
      alert(err?.message || 'Failed to create page (is MongoDB connected?)');
    }
  };

  const deletePage = async (workspaceKey, pageId) => {
    try {
      if (workspaceKey === 'team') {
        await pagesAPI.deleteTeam(pageId);
      } else {
        if (!userCode) {
          alert('Please login to manage private pages.');
          return;
        }
        await pagesAPI.deletePrivate(userCode, pageId);
      }
    } catch (err) {
      alert(err?.message || 'Failed to delete page');
      return;
    }

    setState((prev) => {
      const list = prev.workspaces[workspaceKey] || [];
      const nextList = list.filter((p) => p.id !== pageId);
      const isDeletingSelected = prev.selected.workspace === workspaceKey && prev.selected.pageId === pageId;

      let nextSelected = prev.selected;
      if (isDeletingSelected) {
        const fallback = nextList[0] || null;
        if (fallback) {
          nextSelected = { workspace: workspaceKey, pageId: fallback.id };
        } else {
          // if workspace becomes empty, switch to the other workspace if possible
          const otherKey = workspaceKey === 'team' ? 'personal' : 'team';
          const otherList = prev.workspaces[otherKey] || [];
          if (otherList[0]) {
            nextSelected = { workspace: otherKey, pageId: otherList[0].id };
          } else {
            // both empty; create one personal page
            const createdId = uid();
          const created = { id: createdId, title: 'Untitled', contentHtml: '<p></p>', updatedAt: nowIso() };
            return {
              ...prev,
              selected: { workspace: 'personal', pageId: createdId },
              workspaces: { ...prev.workspaces, [workspaceKey]: nextList, personal: [created] },
            };
          }
        }
      }

      return {
        ...prev,
        selected: nextSelected,
        workspaces: { ...prev.workspaces, [workspaceKey]: nextList },
      };
    });
  };

  const queueRemoteSave = (workspaceKey, pageId, patch) => {
    if (!pageId) return;
    if (workspaceKey === 'personal' && !userCode) return;
    if (!patch || (patch.title == null && patch.contentHtml == null)) return;

    pendingRemoteRef.current = {
      workspace: workspaceKey,
      id: pageId,
      patch: { ...pendingRemoteRef.current.patch, ...patch },
    };

    if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    remoteSaveTimerRef.current = setTimeout(async () => {
      const { workspace, id, patch: pending } = pendingRemoteRef.current;
      pendingRemoteRef.current = { workspace: null, id: null, patch: {} };
      if (!id) return;

      const payload = {};
      if (typeof pending.title === 'string') payload.title = pending.title;
      if (typeof pending.contentHtml === 'string') payload.contentHtml = pending.contentHtml;

      try {
        if (workspace === 'team') {
          await pagesAPI.updateTeam(id, payload);
        } else {
          await pagesAPI.updatePrivate(userCode, id, payload);
        }
      } catch (err) {
        // non-blocking; keep optimistic UI, but tell console for debugging
        console.warn('Failed to save page to backend:', err);
      }
    }, 650);
  };

  const updateSelected = (patch) => {
    lastLocalEditAtRef.current = Date.now();
    setState((prev) => {
      const w = prev.selected.workspace;
      const id = prev.selected.pageId;
      const list = prev.workspaces[w] || [];
      const nextList = list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p));
      return { ...prev, workspaces: { ...prev.workspaces, [w]: nextList } };
    });

    queueRemoteSave(selectedWorkspaceKey, selectedPageId, patch);
  };

  const exec = (command, value = null) => {
    // contentEditable formatting. (document.execCommand is deprecated but still works well for this lightweight editor)
    try {
      editorRef.current?.focus();
      restoreSelection();

      // Custom list indentation: execCommand('indent'/'outdent') is unreliable for <li>.
      if (command === 'indent' || command === 'outdent') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const li = findClosest(range.startContainer, (n) => n?.nodeName === 'LI');
          if (li && editorRef.current?.contains(li)) {
            if (command === 'indent') {
              indentListItem(li);
            } else {
              outdentListItem(li);
            }
            // Persist updated HTML and selection
            if (editorRef.current) updateSelected({ contentHtml: editorRef.current.innerHTML });
            saveSelection();
            return;
          }
        }
      }

      // Custom list alignment: text-align alone doesn't move list markers when list-style-position is "outside".
      // For center/right alignment, switch list items to list-style-position: inside so bullets "move" with the text.
      if (command === 'justifyLeft' || command === 'justifyCenter' || command === 'justifyRight') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const li = findClosest(range.startContainer, (n) => n?.nodeName === 'LI');
          if (li && editorRef.current?.contains(li)) {
            const align = command === 'justifyLeft' ? 'left' : command === 'justifyCenter' ? 'center' : 'right';
            li.style.textAlign = align;
            // This is the critical bit that makes the bullet marker participate in alignment.
            li.style.listStylePosition = align === 'left' ? 'outside' : 'inside';
            if (editorRef.current) updateSelected({ contentHtml: editorRef.current.innerHTML });
            saveSelection();
            return;
          }
        }
      }

      // eslint-disable-next-line deprecation/deprecation
      document.execCommand(command, false, value);
      // Persist updated HTML
      if (editorRef.current) {
        updateSelected({ contentHtml: editorRef.current.innerHTML });
      }
      // Save selection after DOM mutation so toggles can be turned off and combined.
      saveSelection();
    } catch {
      // ignore
    }
  };

  const findClosest = (node, predicate) => {
    let cur = node;
    while (cur) {
      if (predicate(cur)) return cur;
      cur = cur.parentNode;
    }
    return null;
  };

  const placeCaretAtStart = (el) => {
    try {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      selectionRef.current = r.cloneRange();
    } catch {
      // ignore
    }
  };

  const ensureNestedList = (parentLi, listTagName) => {
    const existing = Array.from(parentLi.children || []).find((c) => c?.nodeName === listTagName);
    if (existing) return existing;
    const list = document.createElement(listTagName.toLowerCase());
    parentLi.appendChild(list);
    return list;
  };

  const indentListItem = (li) => {
    const parentList = li.parentNode;
    if (!parentList || (parentList.nodeName !== 'UL' && parentList.nodeName !== 'OL')) {
      // fallback
      // eslint-disable-next-line deprecation/deprecation
      document.execCommand('indent', false);
      return;
    }

    // Indent by nesting under previous sibling <li>
    const prevLi = li.previousElementSibling;
    if (!prevLi || prevLi.nodeName !== 'LI') {
      // If no previous sibling, cannot indent (Notion behaves similarly)
      return;
    }

    const listTag = parentList.nodeName; // UL or OL
    const nested = ensureNestedList(prevLi, listTag);
    nested.appendChild(li);
    placeCaretAtStart(li);

    // Clean up empty list (rare but safe)
    if (parentList.children.length === 0) parentList.remove();
  };

  const outdentListItem = (li, opts = {}) => {
    const { forceRootToParagraph = false } = opts;
    const parentList = li.parentNode;
    if (!parentList || (parentList.nodeName !== 'UL' && parentList.nodeName !== 'OL')) {
      // eslint-disable-next-line deprecation/deprecation
      document.execCommand('outdent', false);
      return;
    }

    const parentLi = findClosest(parentList, (n) => n?.nodeName === 'LI');
    const grandList = parentLi?.parentNode;

    if (!parentLi || !grandList || (grandList.nodeName !== 'UL' && grandList.nodeName !== 'OL')) {
      // Already top-level: convert to paragraph when forced (Backspace at start),
      // or when empty (exit list).
      const text = (li.textContent || '').replace(/\u200B/g, '').trim();
      const hasMedia = li.querySelector && li.querySelector('img, video, audio');
      const isEmpty = text.length === 0 && !hasMedia;

      if (forceRootToParagraph || isEmpty) {
        const p = document.createElement('p');
        // Preserve inline formatting from the LI when possible.
        const liHtml = li.innerHTML || '';
        p.innerHTML = liHtml.trim().length ? liHtml : '<br/>';
        parentList.parentNode?.insertBefore(p, parentList.nextSibling);
        li.remove();
        if (parentList.children.length === 0) parentList.remove();
        placeCaretAtStart(p);
      }
      return;
    }

    // Move li to the grand list after the parentLi
    grandList.insertBefore(li, parentLi.nextSibling);
    placeCaretAtStart(li);

    // Remove now-empty nested list
    if (parentList.children.length === 0) parentList.remove();
  };

  const isCaretAtStartOfElement = (range, el) => {
    try {
      if (!range || !el) return false;
      const pre = range.cloneRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      const before = (pre.toString() || '').replace(/\u200B/g, '').trim();
      return before.length === 0;
    } catch {
      return false;
    }
  };

  const handleEditorKeyDown = (e) => {
    // Keyboard indentation controls:
    // - Tab => indent
    // - Shift+Tab => outdent
    // - Backspace on empty list item => outdent (so it "removes indent"/exits list)
    if (!editorRef.current) return;

    // Save selection early so toolbar / commands can restore it later
    saveSelection();

    if (e.key === 'Tab') {
      e.preventDefault();
      // Tab / Shift+Tab should indent/outdent list items and normal blocks.
      exec(e.shiftKey ? 'outdent' : 'indent');
      return;
    }

    if (e.key === 'Backspace') {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (!sel.isCollapsed) return;

      const range = sel.getRangeAt(0);
      const startNode = range.startContainer;

      // If we are inside an LI and caret is at the very start, outdent one level.
      // If we're already at root level, convert bullet -> normal paragraph.
      const li = findClosest(startNode, (n) => n?.nodeName === 'LI');
      if (li && editorRef.current.contains(li)) {
        const atStart = isCaretAtStartOfElement(range, li);
        if (atStart) {
          e.preventDefault();
          outdentListItem(li, { forceRootToParagraph: true });
          if (editorRef.current) updateSelected({ contentHtml: editorRef.current.innerHTML });
          saveSelection();
          return;
        }
      }
    }
  };

  const clearImageSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.querySelectorAll('.cb-image-block.cb-selected');
    selected.forEach((el) => el.classList.remove('cb-selected'));
  };

  const selectImageBlock = (blockEl) => {
    if (!blockEl) return;
    clearImageSelection();
    blockEl.classList.add('cb-selected');
  };

  const insertHtmlAtSelection = (html, opts = {}) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();

    let range = window.getSelection()?.rangeCount ? window.getSelection().getRangeAt(0) : null;
    // If the file picker was opened, selection is often lost; fall back to end-of-editor insertion.
    if (!range || !editor.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      selectionRef.current = range;
    }

    // If requested, avoid inserting inside a specific container (e.g., clip box).
    const avoidInsideSelector = opts?.avoidInsideSelector;
    if (avoidInsideSelector && range) {
      const startEl =
        range.startContainer?.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer?.parentElement;
      const blocked = startEl?.closest?.(avoidInsideSelector);
      if (blocked && editor.contains(blocked)) {
        const safeRange = document.createRange();
        safeRange.setStartAfter(blocked);
        safeRange.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(safeRange);
        selectionRef.current = safeRange.cloneRange();
        range = safeRange;
      }
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // Insert ALL nodes (not just firstChild). This avoids issues when the HTML string has
    // leading whitespace/newlines (firstChild becomes a text node) and supports multi-node inserts.
    const nodes = Array.from(wrapper.childNodes).filter((n) => {
      if (n.nodeType !== Node.TEXT_NODE) return true;
      return (n.textContent || '').trim().length > 0;
    });
    if (nodes.length === 0) return;

    const frag = document.createDocumentFragment();
    nodes.forEach((n) => frag.appendChild(n));

    range.deleteContents();
    range.insertNode(frag);

    // Move caret after last inserted node
    const lastNode = nodes[nodes.length - 1];
    const after = document.createRange();
    after.setStartAfter(lastNode);
    after.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(after);
    selectionRef.current = after;

    updateSelected({ contentHtml: editor.innerHTML });
  };

  const insertImageBlock = (src) => {
    const id = uid();
    // contenteditable=false so it behaves like a block (drag/resize without editing inside)
    const html = `
      <div class="cb-image-block" data-cb-id="${id}" contenteditable="false" draggable="true">
        <img src="${src}" alt="Inserted image" />
      </div>
      <p></p>
    `;
    // Images should never be inserted inside a clip block; always insert after it.
    insertHtmlAtSelection(html, { avoidInsideSelector: '.cb-clip' });
  };

  const promptImageUrl = () => {
    const url = window.prompt('Image URL');
    if (!url) return;
    insertImageBlock(url);
  };

  const promptLink = () => {
    const url = window.prompt('Link URL');
    if (!url) return;
    exec('createLink', url);
  };

  const chooseImageFile = () => {
    // Preserve cursor position before opening OS file picker.
    saveSelection();
    fileInputRef.current?.click();
  };

  const onImageFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      insertImageBlock(String(dataUrl));
      // Allow selecting the same file again to re-insert it.
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const getCaretRangeFromPoint = (x, y) => {
    // Cross-browser caret position lookup
    // eslint-disable-next-line deprecation/deprecation
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    // Safari
    // eslint-disable-next-line deprecation/deprecation
    if (document.caretPositionFromPoint) {
      // eslint-disable-next-line deprecation/deprecation
      const pos = document.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
    return null;
  };

  const handleEditorClick = (e) => {
    const editor = editorRef.current;
    if (!editor) return;
    const target = e.target;
    const block = target?.closest?.('.cb-image-block');
    if (block && editor.contains(block)) {
      selectImageBlock(block);
    } else {
      clearImageSelection();
    }
  };

  const stopImageDrag = () => {
    const editor = editorRef.current;
    const st = imgDragRef.current;
    if (!st.active) return;

    st.active = false;
    if (st.rafId) cancelAnimationFrame(st.rafId);
    st.rafId = 0;

    // Put image back into the editor where the placeholder is.
    if (editor && st.placeholderEl && st.blockEl) {
      st.placeholderEl.replaceWith(st.blockEl);
      st.blockEl.classList.remove('cb-image-ghost');
      st.blockEl.style.transform = '';
      st.blockEl.style.position = '';
      st.blockEl.style.left = '';
      st.blockEl.style.top = '';
      st.blockEl.style.margin = '';
      st.blockEl.style.pointerEvents = '';
      st.blockEl.style.zIndex = '';
      st.blockEl.style.opacity = '';
      updateSelected({ contentHtml: editor.innerHTML });
    }

    // Cleanup ghost if still in body
    if (st.ghostEl && st.ghostEl.parentNode) {
      st.ghostEl.remove();
    }

    st.ghostEl = null;
    st.placeholderEl = null;
    st.blockEl = null;
  };

  const scheduleImageDragFrame = () => {
    const st = imgDragRef.current;
    if (st.rafId) return;
    st.rafId = requestAnimationFrame(() => {
      st.rafId = 0;
      const editor = editorRef.current;
      if (!st.active || !editor) return;

      // Move ghost
      if (st.ghostEl) {
        const left = st.x - st.offsetX;
        const top = st.y - st.offsetY;
        st.ghostEl.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }

      // Move placeholder based on caret position (text reflows while dragging)
      const range = getCaretRangeFromPoint(st.x, st.y);
      if (!range || !editor.contains(range.startContainer) || !st.placeholderEl) return;

      // Avoid inserting inside clip boxes
      const startEl =
        range.startContainer?.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer?.parentElement;
      const clip = startEl?.closest?.('.cb-clip');
      try {
        st.placeholderEl.remove();
        const r = document.createRange();
        if (clip && editor.contains(clip)) {
          r.setStartAfter(clip);
        } else {
          r.setStart(range.startContainer, range.startOffset);
        }
        r.collapse(true);
        r.insertNode(st.placeholderEl);
      } catch {
        // ignore
      }
    });
  };

  const startImageDrag = (block, e) => {
    const editor = editorRef.current;
    if (!editor) return;

    const rect = block.getBoundingClientRect();

    // Placeholder keeps layout so text wraps/reflows while dragging
    const placeholder = document.createElement('span');
    placeholder.className = 'cb-image-placeholder';
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;

    // Replace block with placeholder in DOM
    block.replaceWith(placeholder);

    // Ghost follows pointer smoothly (overlay)
    const ghost = block;
    ghost.classList.add('cb-image-ghost');
    ghost.style.position = 'fixed';
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.margin = '0';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '2147483647';
    ghost.style.opacity = '0.92';
    document.body.appendChild(ghost);

    const st = imgDragRef.current;
    st.active = true;
    st.blockEl = block;
    st.placeholderEl = placeholder;
    st.ghostEl = ghost;
    st.offsetX = e.clientX - rect.left;
    st.offsetY = e.clientY - rect.top;
    st.x = e.clientX;
    st.y = e.clientY;

    scheduleImageDragFrame();
  };

  const handleEditorPointerDown = (e) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (e.button !== 0) return;

    const block = e.target?.closest?.('.cb-image-block');
    if (!block || !editor.contains(block)) return;

    // Let native CSS resize handle work. The resize grab zone is the bottom-right corner.
    // If we intercept that, resize becomes drag.
    try {
      const rect = block.getBoundingClientRect();
      const RESIZE_GRAB_PX = 18;
      const inResizeCorner =
        rect.right - e.clientX <= RESIZE_GRAB_PX &&
        rect.bottom - e.clientY <= RESIZE_GRAB_PX;
      if (inResizeCorner) {
        // Don't preventDefault/stopPropagation: allow the browser to resize.
        return;
      }
    } catch {
      // ignore
    }

    e.preventDefault();
    e.stopPropagation();

    selectImageBlock(block);
    saveSelection();
    startImageDrag(block, e);

    // Capture the pointer so pointerup still fires even if user drags outside the editor.
    try {
      if (typeof editor.setPointerCapture === 'function' && e.pointerId != null) {
        editor.setPointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  };

  const handleEditorPointerMove = (e) => {
    const st = imgDragRef.current;
    if (!st.active) return;
    st.x = e.clientX;
    st.y = e.clientY;
    scheduleImageDragFrame();
  };

  const handleEditorPointerUp = (e) => {
    // Release capture if we grabbed it
    try {
      const editor = editorRef.current;
      if (editor && typeof editor.releasePointerCapture === 'function' && e?.pointerId != null) {
        editor.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    stopImageDrag();
  };

  const handleDragStart = (e) => {
    const editor = editorRef.current;
    if (!editor) return;
    const target = e.target;
    const block = target?.closest?.('.cb-image-block');
    if (!block || !editor.contains(block)) return;
    // Disable HTML5 dragging (jittery). Pointer-drag handles image movement.
    e.preventDefault();
    return;

    const id = block.getAttribute('data-cb-id');
    draggedImageIdRef.current = id;
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id || '');
    } catch {
      // ignore
    }
  };

  const handleDragOver = (e) => {
    // Allow dropping inside editor
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;

    const id = (e.dataTransfer?.getData?.('text/plain') || '').trim() || draggedImageIdRef.current;
    if (!id) return;

    const block = editor.querySelector(`.cb-image-block[data-cb-id="${CSS.escape(id)}"]`);
    if (!block) return;

    // Figure out where to insert based on caret position
    const range = getCaretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;

    // Only allow drop inside editor
    if (!editor.contains(range.startContainer)) return;

    // Move the block
    block.remove();
    range.insertNode(block);

    // Put a paragraph after so user can type below
    const p = document.createElement('p');
    p.innerHTML = '<br/>';
    block.after(p);

    // Persist
    updateSelected({ contentHtml: editor.innerHTML });
  };

  const handleEditorMouseUp = () => {
    // Resizing the cb-image-block does not fire input events.
    // Persist editor HTML on mouseup (covers resize end).
    const editor = editorRef.current;
    if (!editor) return;
    updateSelected({ contentHtml: editor.innerHTML });
  };

  return (
    <div
      className="w-full flex-1 min-h-0 flex flex-col"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0px)' : 'translateX(14px)',
        transition: 'opacity 220ms ease, transform 220ms ease',
      }}
    >
      <div className="flex w-full flex-1 min-h-0 gap-6 items-stretch">
        {/* Sidebar */}
        <aside
          className="shrink-0 rounded-2xl p-4 min-h-0 overflow-auto"
          style={{
            width: 340,
            background: 'var(--color-surface-dark)',
            border: '1px solid var(--color-border)',
          }}
        >
          <SidebarSection
            icon={Users}
            title="TEAM WORKSPACE"
            workspaceKey="team"
            pages={state.workspaces.team}
            selectedPageId={state.selected.workspace === 'team' ? state.selected.pageId : null}
            onSelect={selectPage}
            onAdd={addPage}
            onDelete={deletePage}
          />
          <SidebarSection
            icon={User}
            title="PERSONAL WORKSPACE"
            workspaceKey="personal"
            pages={state.workspaces.personal}
            selectedPageId={state.selected.workspace === 'personal' ? state.selected.pageId : null}
            onSelect={selectPage}
            onAdd={addPage}
            onDelete={deletePage}
          />
        </aside>

        {/* Editor */}
        <section
          className="min-w-0 flex-1 rounded-2xl p-6 min-h-0 flex flex-col"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          {loading ? (
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Loading pages…
              {loadError ? (
                <div className="mt-2 text-xs" style={{ color: 'var(--color-error-text)' }}>
                  {loadError}
                </div>
              ) : null}
            </div>
          ) : !selectedPage ? (
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Select a page to begin.
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 flex-col">
              <input
                value={selectedPage.title}
                onChange={(e) => updateSelected({ title: e.target.value })}
                placeholder="Untitled"
                className="w-full bg-transparent text-2xl font-semibold outline-none"
                style={{ color: 'var(--color-text-primary)' }}
              />

              {/* Toolbar */}
              <div
                className="mt-4 flex flex-wrap items-center gap-2 rounded-xl p-2"
                style={{
                  background: 'var(--color-surface-dark)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('bold')}
                  title="Bold"
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('italic')}
                  title="Italic"
                >
                  <Italic size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('underline')}
                  title="Underline"
                >
                  <Underline size={16} />
                </button>
                <div className="mx-1 h-6 w-px" style={{ background: 'var(--color-border)' }} />
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('justifyLeft')}
                  title="Align left"
                >
                  <AlignLeft size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('justifyCenter')}
                  title="Align center"
                >
                  <AlignCenter size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('justifyRight')}
                  title="Align right"
                >
                  <AlignRight size={16} />
                </button>
                <div className="mx-1 h-6 w-px" style={{ background: 'var(--color-border)' }} />
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('insertUnorderedList')}
                  title="Bulleted list"
                >
                  <List size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('insertOrderedList')}
                  title="Numbered list"
                >
                  <ListOrdered size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('indent')}
                  title="Indent"
                >
                  <Indent size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('outdent')}
                  title="Outdent"
                >
                  <Outdent size={16} />
                </button>
                <div className="mx-1 h-6 w-px" style={{ background: 'var(--color-border)' }} />
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('formatBlock', '<h1>')}
                  title="Heading 1 (H1)"
                >
                  <Type size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('formatBlock', '<h2>')}
                  title="Heading 2 (H2)"
                >
                  H2
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => exec('formatBlock', 'P')}
                  title="Normal text"
                >
                  Normal
                </button>
                <div className="mx-1 h-6 w-px" style={{ background: 'var(--color-border)' }} />
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={promptLink}
                  title="Insert link"
                >
                  <LinkIcon size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={promptImageUrl}
                  title="Insert image by URL"
                >
                  <ImageIcon size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-xs font-semibold"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={chooseImageFile}
                  title="Upload image"
                >
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onImageFile(e.target.files?.[0])}
                />
              </div>

              <div
                ref={editorRef}
                  className="mt-4 flex-1 min-h-0 overflow-auto rounded-xl p-4 text-sm outline-none rich-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  updateSelected({ contentHtml: e.currentTarget.innerHTML });
                }}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={saveSelection}
                  onMouseUp={() => {
                    saveSelection();
                    handleEditorMouseUp();
                  }}
                  onFocus={saveSelection}
                onBlur={(e) => {
                  updateSelected({ contentHtml: e.currentTarget.innerHTML });
                }}
                  onClick={handleEditorClick}
                  onPointerDown={handleEditorPointerDown}
                  onPointerMove={handleEditorPointerMove}
                  onPointerUp={handleEditorPointerUp}
                  onPointerCancel={handleEditorPointerUp}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onScroll={(e) => {
                    const key = `${selectedWorkspaceKey}:${selectedPageId}`;
                    scrollByPageRef.current[key] = e.currentTarget.scrollTop;
                  }}
                style={{
                  background: 'var(--color-surface-dark)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.6,
                }}
                role="textbox"
                aria-label="Page content"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


