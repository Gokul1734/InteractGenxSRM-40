const mongoose = require('mongoose');
const User = require('../models/User');
const TeamPage = require('../models/TeamPage');
const PrivatePage = require('../models/PrivatePage');

function ensureMongoConnected(res) {
  // 1 = connected
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message: 'MongoDB is not connected. Set MONGO_URI to enable pages storage.',
    });
    return false;
  }
  return true;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildClipHtml({ text, sourceUrl, sourceTitle, capturedAt }) {
  const safeText = escapeHtml(text || '').replace(/\n/g, '<br/>');
  const safeUrl = sourceUrl ? escapeHtml(sourceUrl) : '';
  const safeTitle = sourceTitle ? escapeHtml(sourceTitle) : '';
  const safeAt = capturedAt ? escapeHtml(capturedAt) : new Date().toISOString();

  return `
    <div class="cb-clip" style="padding:12px;border:1px solid #3A3A3C;border-radius:10px;margin:12px 0;background:#1C1C1E;">
      <div style="font-size:12px;color:#8E8E93;margin-bottom:8px;">
        <span>Clipped</span>
        <span> • </span>
        <span>${safeAt}</span>
        ${safeUrl ? `<span> • </span><a href="${safeUrl}" target="_blank" rel="noreferrer" style="color:#94C9B8;text-decoration:none;">${safeTitle || safeUrl}</a>` : ''}
      </div>
      <div style="font-size:14px;color:#E5E5EA;line-height:1.55;">${safeText || '<br/>'}</div>
    </div>
    <p><br/></p>
  `.trim();
}

function buildImageClipHtml({ imageSrc, imageUrl, sourceUrl, sourceTitle, capturedAt }) {
  const safeSrc = imageSrc ? escapeHtml(imageSrc) : '';
  const safeImageUrl = imageUrl ? escapeHtml(imageUrl) : '';
  const safeUrl = sourceUrl ? escapeHtml(sourceUrl) : '';
  const safeTitle = sourceTitle ? escapeHtml(sourceTitle) : '';
  const safeAt = capturedAt ? escapeHtml(capturedAt) : new Date().toISOString();

  return `
    <div class="cb-clip" style="padding:12px;border:1px solid #3A3A3C;border-radius:10px;margin:12px 0;background:#1C1C1E;">
      <div style="font-size:12px;color:#8E8E93;margin-bottom:8px;">
        <span>Image</span>
        <span> • </span>
        <span>${safeAt}</span>
        ${safeUrl ? `<span> • </span><a href="${safeUrl}" target="_blank" rel="noreferrer" style="color:#94C9B8;text-decoration:none;">${safeTitle || safeUrl}</a>` : ''}
        ${safeImageUrl ? `<span> • </span><a href="${safeImageUrl}" target="_blank" rel="noreferrer" style="color:#94C9B8;text-decoration:none;">Original image</a>` : ''}
      </div>
      ${safeSrc ? `<img src="${safeSrc}" alt="Clipped image" style="max-width:100%;height:auto;border-radius:10px;display:block;" />` : '<p><br/></p>'}
    </div>
    <p><br/></p>
  `.trim();
}

// ===================== TEAM PAGES =====================

// GET /api/pages/team
const listTeamPages = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const pages = await TeamPage.find({ is_active: true }).sort({ updatedAt: -1 }).select('-__v');
    res.json({ success: true, count: pages.length, data: pages });
  } catch (err) {
    console.error('listTeamPages error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// POST /api/pages/team/:id/append
const appendTeamPage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const { id } = req.params;
    const { type, text, imageSrc, imageUrl, sourceUrl, sourceTitle, capturedAt } = req.body || {};

    const kind = type || (imageSrc || imageUrl ? 'image' : 'text');
    if (kind === 'image') {
      if (typeof imageSrc !== 'string' || imageSrc.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'imageSrc is required' });
      }
    } else {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'text is required' });
      }
    }

    const page = await TeamPage.findById(id);
    if (!page || !page.is_active) {
      return res.status(404).json({ success: false, message: 'Team page not found' });
    }

    const clipHtml =
      kind === 'image'
        ? buildImageClipHtml({
            imageSrc: imageSrc.trim(),
            imageUrl,
            sourceUrl,
            sourceTitle,
            capturedAt,
          })
        : buildClipHtml({
            text: text.trim(),
            sourceUrl,
            sourceTitle,
            capturedAt,
          });

    page.contentHtml = `${page.contentHtml || '<p></p>'}\n${clipHtml}`;
    await page.save();

    res.json({ success: true, data: page });
  } catch (err) {
    console.error('appendTeamPage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// POST /api/pages/team
const createTeamPage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const { title, contentHtml, created_by_user_code } = req.body || {};

    const safeTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Untitled';
    const safeHtml = typeof contentHtml === 'string' ? contentHtml : '<p></p>';

    let createdBy = null;
    let normalizedCode = null;
    if (created_by_user_code) {
      normalizedCode = String(created_by_user_code).trim().toUpperCase();
      createdBy = await User.findOne({ user_code: normalizedCode });
    }

    const page = await TeamPage.create({
      title: safeTitle,
      contentHtml: safeHtml,
      created_by: createdBy?._id,
      created_by_user_code: normalizedCode || undefined,
    });

    res.status(201).json({ success: true, data: page });
  } catch (err) {
    console.error('createTeamPage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// PUT /api/pages/team/:id
const updateTeamPage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const { id } = req.params;
    const { title, contentHtml } = req.body || {};

    const page = await TeamPage.findById(id);
    if (!page || !page.is_active) {
      return res.status(404).json({ success: false, message: 'Team page not found' });
    }

    if (typeof title === 'string') {
      page.title = title.trim().length > 0 ? title.trim() : 'Untitled';
    }
    if (typeof contentHtml === 'string') page.contentHtml = contentHtml;
    await page.save();

    res.json({ success: true, data: page });
  } catch (err) {
    console.error('updateTeamPage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// DELETE /api/pages/team/:id
const deleteTeamPage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const { id } = req.params;

    const page = await TeamPage.findById(id);
    if (!page || !page.is_active) {
      return res.status(404).json({ success: false, message: 'Team page not found' });
    }

    page.is_active = false;
    await page.save();

    res.json({ success: true, message: 'Team page deleted' });
  } catch (err) {
    console.error('deleteTeamPage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ===================== PRIVATE PAGES =====================

async function getUserByCodeOr404(res, user_code) {
  const normalized = String(user_code || '').trim().toUpperCase();
  if (!normalized) {
    res.status(400).json({ success: false, message: 'Invalid user_code' });
    return null;
  }
  const user = await User.findOne({ user_code: normalized });
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return null;
  }
  return user;
}

// GET /api/pages/private/:user_code
const listPrivatePages = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const user = await getUserByCodeOr404(res, req.params.user_code);
    if (!user) return;

    const pages = await PrivatePage.find({ user: user._id, is_active: true })
      .sort({ updatedAt: -1 })
      .select('-__v');

    res.json({ success: true, count: pages.length, data: pages });
  } catch (err) {
    console.error('listPrivatePages error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// POST /api/pages/private/:user_code
const createPrivatePage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const user = await getUserByCodeOr404(res, req.params.user_code);
    if (!user) return;

    const { title, contentHtml } = req.body || {};
    const safeTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim() : 'Untitled';
    const safeHtml = typeof contentHtml === 'string' ? contentHtml : '<p></p>';

    const page = await PrivatePage.create({
      user: user._id,
      user_code: user.user_code,
      title: safeTitle,
      contentHtml: safeHtml,
    });

    res.status(201).json({ success: true, data: page });
  } catch (err) {
    console.error('createPrivatePage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// PUT /api/pages/private/:user_code/:id
const updatePrivatePage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const user = await getUserByCodeOr404(res, req.params.user_code);
    if (!user) return;

    const { id } = req.params;
    const { title, contentHtml } = req.body || {};

    const page = await PrivatePage.findOne({ _id: id, user: user._id, is_active: true });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Private page not found' });
    }

    if (typeof title === 'string') page.title = title.trim().length > 0 ? title.trim() : 'Untitled';
    if (typeof contentHtml === 'string') page.contentHtml = contentHtml;
    await page.save();

    res.json({ success: true, data: page });
  } catch (err) {
    console.error('updatePrivatePage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// DELETE /api/pages/private/:user_code/:id
const deletePrivatePage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const user = await getUserByCodeOr404(res, req.params.user_code);
    if (!user) return;

    const { id } = req.params;
    const page = await PrivatePage.findOne({ _id: id, user: user._id, is_active: true });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Private page not found' });
    }

    page.is_active = false;
    await page.save();

    res.json({ success: true, message: 'Private page deleted' });
  } catch (err) {
    console.error('deletePrivatePage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// POST /api/pages/private/:user_code/:id/append
const appendPrivatePage = async (req, res) => {
  try {
    if (!ensureMongoConnected(res)) return;
    const user = await getUserByCodeOr404(res, req.params.user_code);
    if (!user) return;

    const { id } = req.params;
    const { type, text, imageSrc, imageUrl, sourceUrl, sourceTitle, capturedAt } = req.body || {};

    const kind = type || (imageSrc || imageUrl ? 'image' : 'text');
    if (kind === 'image') {
      if (typeof imageSrc !== 'string' || imageSrc.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'imageSrc is required' });
      }
    } else {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'text is required' });
      }
    }

    const page = await PrivatePage.findOne({ _id: id, user: user._id, is_active: true });
    if (!page) {
      return res.status(404).json({ success: false, message: 'Private page not found' });
    }

    const clipHtml =
      kind === 'image'
        ? buildImageClipHtml({
            imageSrc: imageSrc.trim(),
            imageUrl,
            sourceUrl,
            sourceTitle,
            capturedAt,
          })
        : buildClipHtml({
            text: text.trim(),
            sourceUrl,
            sourceTitle,
            capturedAt,
          });

    page.contentHtml = `${page.contentHtml || '<p></p>'}\n${clipHtml}`;
    await page.save();

    res.json({ success: true, data: page });
  } catch (err) {
    console.error('appendPrivatePage error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

module.exports = {
  listTeamPages,
  createTeamPage,
  updateTeamPage,
  deleteTeamPage,
  appendTeamPage,
  listPrivatePages,
  createPrivatePage,
  updatePrivatePage,
  deletePrivatePage,
  appendPrivatePage,
};


