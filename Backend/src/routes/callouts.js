const express = require('express');
const router = express.Router();
const {
  createCallout,
  getSessionCallouts,
  getActiveCallouts,
  getCalloutById,
  acknowledgeCallout,
  dismissCallout,
  deleteCallout,
  getCalloutStats
} = require('../controllers/calloutController');

// @route   POST /api/callouts
// @desc    Create a new callout
router.post('/', createCallout);

// @route   GET /api/callouts/session/:session_code
// @desc    Get all callouts for a session
router.get('/session/:session_code', getSessionCallouts);

// @route   GET /api/callouts/session/:session_code/active
// @desc    Get active (non-expired) callouts for a session (optimized for polling)
router.get('/session/:session_code/active', getActiveCallouts);

// @route   GET /api/callouts/session/:session_code/stats
// @desc    Get callout statistics for a session
router.get('/session/:session_code/stats', getCalloutStats);

// @route   GET /api/callouts/:id
// @desc    Get a single callout by ID
router.get('/:id', getCalloutById);

// @route   POST /api/callouts/:id/acknowledge
// @desc    Acknowledge a callout (mark as seen)
router.post('/:id/acknowledge', acknowledgeCallout);

// @route   POST /api/callouts/:id/dismiss
// @desc    Dismiss a callout
router.post('/:id/dismiss', dismissCallout);

// @route   DELETE /api/callouts/:id
// @desc    Delete a callout
router.delete('/:id', deleteCallout);

module.exports = router;

