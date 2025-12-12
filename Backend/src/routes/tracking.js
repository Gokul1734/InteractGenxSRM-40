const express = require('express');
const router = express.Router();
const NavigationTracking = require('../models/NavigationTracking');

// @route   POST /api/tracking/start
// @desc    Start a new tracking session
// @access  Public
router.post('/start', async (req, res) => {
  try {
    const { user_code, session_code } = req.body;

    // Validation
    if (!user_code || !session_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code and session_code are required'
      });
    }

    // Check if session already exists
    let session = await NavigationTracking.findOne({
      user_code,
      session_code,
      is_active: true
    });

    if (session) {
      return res.status(200).json({
        success: true,
        message: 'Session already exists',
        data: {
          session_id: session._id,
          user_code: session.user_code,
          session_code: session.session_code,
          started_at: session.recording_started_at
        }
      });
    }

    // Create new session
    session = await NavigationTracking.create({
      user_code,
      session_code,
      recording_started_at: new Date(),
      navigation_events: [],
      is_active: true
    });

    res.status(201).json({
      success: true,
      message: 'Tracking session started',
      data: {
        session_id: session._id,
        user_code: session.user_code,
        session_code: session.session_code,
        started_at: session.recording_started_at
      }
    });

  } catch (error) {
    console.error('Error starting tracking session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/tracking/event
// @desc    Add a single navigation event to the session
// @access  Public
router.post('/event', async (req, res) => {
  try {
    const { user_code, session_code, event_type, timestamp, context } = req.body;

    // Validation
    if (!user_code || !session_code || !event_type) {
      return res.status(400).json({
        success: false,
        message: 'user_code, session_code, and event_type are required'
      });
    }

    // Find active session
    const session = await NavigationTracking.findOne({
      user_code,
      session_code,
      is_active: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found. Please start recording first.'
      });
    }

    // Add event
    session.navigation_events.push({
      event_type,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      context: context || {}
    });
    session.event_count = session.navigation_events.length;

    await session.save();

    res.status(200).json({
      success: true,
      message: 'Event added',
      data: {
        session_id: session._id,
        event_count: session.event_count
      }
    });

  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/tracking/events/batch
// @desc    Add multiple navigation events at once
// @access  Public
router.post('/events/batch', async (req, res) => {
  try {
    const { user_code, session_code, events } = req.body;

    // Validation
    if (!user_code || !session_code || !events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'user_code, session_code, and events array are required'
      });
    }

    // Find active session
    const session = await NavigationTracking.findOne({
      user_code,
      session_code,
      is_active: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found. Please start recording first.'
      });
    }

    // Add all events
    events.forEach(event => {
      session.navigation_events.push({
        event_type: event.event_type,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        context: event.context || {}
      });
    });
    session.event_count = session.navigation_events.length;

    await session.save();

    res.status(200).json({
      success: true,
      message: `${events.length} events added`,
      data: {
        session_id: session._id,
        event_count: session.event_count,
        events_added: events.length
      }
    });

  } catch (error) {
    console.error('Error adding batch events:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/tracking/stop
// @desc    Stop tracking session
// @access  Public
router.post('/stop', async (req, res) => {
  try {
    const { user_code, session_code } = req.body;

    // Validation
    if (!user_code || !session_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code and session_code are required'
      });
    }

    // Find and update session
    const session = await NavigationTracking.findOne({
      user_code,
      session_code,
      is_active: true
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    session.recording_ended_at = new Date();
    session.is_active = false;
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Tracking session stopped',
      data: {
        session_id: session._id,
        user_code: session.user_code,
        session_code: session.session_code,
        started_at: session.recording_started_at,
        ended_at: session.recording_ended_at,
        total_events: session.event_count,
        duration_ms: session.recording_ended_at - session.recording_started_at
      }
    });

  } catch (error) {
    console.error('Error stopping tracking session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking/session/:user_code/:session_code
// @desc    Get tracking session data
// @access  Public
router.get('/session/:user_code/:session_code', async (req, res) => {
  try {
    const { user_code, session_code } = req.params;

    const session = await NavigationTracking.findOne({
      user_code: parseInt(user_code),
      session_code
    }).sort({ recording_started_at: -1 });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking/sessions/user/:user_code
// @desc    Get all sessions for a user
// @access  Public
router.get('/sessions/user/:user_code', async (req, res) => {
  try {
    const { user_code } = req.params;

    const sessions = await NavigationTracking.find({
      user_code: parseInt(user_code)
    })
    .select('-navigation_events')  // Exclude events for list view
    .sort({ recording_started_at: -1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking/sessions/active
// @desc    Get all active tracking sessions
// @access  Public
router.get('/sessions/active', async (req, res) => {
  try {
    const sessions = await NavigationTracking.find({
      is_active: true
    })
    .select('-navigation_events')
    .sort({ recording_started_at: -1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Error fetching active sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/tracking/session/:session_id
// @desc    Delete a tracking session
// @access  Public
router.delete('/session/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    const session = await NavigationTracking.findByIdAndDelete(session_id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session deleted',
      data: {
        session_id: session._id,
        user_code: session.user_code,
        session_code: session.session_code
      }
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking/health
// @desc    Health check for tracking service
// @access  Public
router.get('/health', async (req, res) => {
  try {
    const activeCount = await NavigationTracking.countDocuments({ is_active: true });
    const totalCount = await NavigationTracking.countDocuments({});

    res.status(200).json({
      success: true,
      message: 'Tracking service is running',
      data: {
        active_sessions: activeCount,
        total_sessions: totalCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Service error',
      error: error.message
    });
  }
});

module.exports = router;

