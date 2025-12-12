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

module.exports = {
  listTeamPages,
  createTeamPage,
  updateTeamPage,
  deleteTeamPage,
  listPrivatePages,
  createPrivatePage,
  updatePrivatePage,
  deletePrivatePage,
};


