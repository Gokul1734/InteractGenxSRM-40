const express = require('express');
const router = express.Router();
const {
  createSession,
  getAllSessions,
  getSessionByCode,
  getSessionById,
  updateSession,
  deleteSession,
  addUserToSession,
  removeUserFromSession,
  getSessionMembers,
  endSession,
  validateSessionCode,
  getFullSessionData,
  getLiveUpdate
} = require('../controllers/sessionController');
const {
  sendInvitation,
  getSessionInvitations
} = require('../controllers/invitationController');

// @route   POST /api/sessions
// @desc    Create a new session
router.post('/', createSession);

// @route   GET /api/sessions
// @desc    Get all sessions
router.get('/', getAllSessions);

// @route   GET /api/sessions/validate/:session_code
// @desc    Validate if session code exists
router.get('/validate/:session_code', validateSessionCode);

// @route   GET /api/sessions/id/:id
// @desc    Get session by MongoDB ID
router.get('/id/:id', getSessionById);

// @route   GET /api/sessions/:session_code
// @desc    Get session by session_code
router.get('/:session_code', getSessionByCode);

// @route   PUT /api/sessions/:session_code
// @desc    Update session
router.put('/:session_code', updateSession);

// @route   DELETE /api/sessions/:session_code
// @desc    Delete session
router.delete('/:session_code', deleteSession);

// @route   GET /api/sessions/:session_code/members
// @desc    Get session members
router.get('/:session_code/members', getSessionMembers);

// @route   POST /api/sessions/:session_code/members
// @desc    Add user to session
router.post('/:session_code/members', addUserToSession);

// @route   DELETE /api/sessions/:session_code/members/:user_code
// @desc    Remove user from session
router.delete('/:session_code/members/:user_code', removeUserFromSession);

// @route   POST /api/sessions/:session_code/end
// @desc    End session
router.post('/:session_code/end', endSession);

// @route   GET /api/sessions/:session_code/full
// @desc    Get full session data with all navigation tracking
router.get('/:session_code/full', getFullSessionData);

// @route   GET /api/sessions/:session_code/getLiveUpdate
// @desc    Get live navigation tracking updates for all session members (optimized for polling)
router.get('/:session_code/getLiveUpdate', getLiveUpdate);

// @route   POST /api/sessions/:session_code/invitations
// @desc    Send invitation to join a session (only session creator)
router.post('/:session_code/invitations', sendInvitation);

// @route   GET /api/sessions/:session_code/invitations
// @desc    Get all invitations for a session
router.get('/:session_code/invitations', getSessionInvitations);

module.exports = router;

