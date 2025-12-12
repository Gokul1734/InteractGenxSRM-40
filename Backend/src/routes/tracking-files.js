const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models
const User = require('../models/User');
const Session = require('../models/Session');
const NavigationTracking = require('../models/NavigationTracking');

// @route   POST /api/tracking-files/start
// @desc    Start a new tracking session (directly in MongoDB)
// @access  Public
router.post('/start', async (req, res) => {
  console.log('📥 START request received:', req.body);
  try {
    const { user_code, session_code, user_name, user_email, session_name } = req.body;

    if (!user_code || !session_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code and session_code are required'
      });
    }

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }

    // Create or find user (if user info provided)
    let user = null;
    if (user_name && user_email) {
      user = await User.findOrCreateUser({ user_code, user_name, user_email });
    }

    // Create or find collaborative session
    const session = await Session.findOrCreateSession(
      session_code,
      session_name || `Session ${session_code}`,
      user
    );

    // Add user to session members if user exists
    if (user) {
      await session.addMember(user);
    }

    // Create navigation tracking record for this user in this session
    const tracking = await NavigationTracking.findOrCreateSession(
      user_code,
      session_code,
      user?._id,
      session._id
    );

    console.log(`✓ Session started: ${user_code}_${session_code} (MongoDB)`);

    res.status(201).json({
      success: true,
      message: 'Tracking session started',
      data: {
        folder: `${user_code}_${session_code}`,
        user_code,
        session_code,
        tracking_id: tracking._id,
        session_id: session._id
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

// @route   POST /api/tracking-files/update
// @desc    Update tracking data with new events (LIVE - every 2 seconds)
// @access  Public
router.post('/update', async (req, res) => {
  console.log('📥 LIVE UPDATE for:', req.body.user_code, req.body.session_code);
  try {
    const { user_code, session_code, data } = req.body;

    if (!user_code || !session_code || !data) {
      return res.status(400).json({
        success: false,
        message: 'user_code, session_code, and data are required'
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }

    // Find or create tracking record
    let tracking = await NavigationTracking.findOne({
      user_code,
      session_code,
      is_active: true
    });

    if (!tracking) {
      // Create new tracking if doesn't exist
      tracking = await NavigationTracking.create({
        user_code,
        session_code,
        recording_started_at: data.recording_started_at || new Date(),
        navigation_events: [],
        is_active: true
      });
    }

    // LIVE UPDATE: Replace navigation events with latest data
    tracking.navigation_events = data.navigation_events || [];
    tracking.event_count = tracking.navigation_events.length;

    if (data.recording_ended_at) {
      tracking.recording_ended_at = data.recording_ended_at;
    }

    await tracking.save();

    console.log(`✓ LIVE: ${user_code}_${session_code} → ${tracking.event_count} events`);

    res.status(200).json({
      success: true,
      message: 'Data updated live',
      data: {
        folder: `${user_code}_${session_code}`,
        event_count: tracking.event_count,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error updating tracking data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/tracking-files/stop
// @desc    Finalize tracking session
// @access  Public
router.post('/stop', async (req, res) => {
  try {
    const { user_code, session_code } = req.body;

    if (!user_code || !session_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code and session_code are required'
      });
    }

    const tracking = await NavigationTracking.findOne({
      user_code,
      session_code,
      is_active: true
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    await tracking.endRecording();

    console.log(`✓ Session stopped: ${user_code}_${session_code}`);

    res.status(200).json({
      success: true,
      message: 'Tracking session stopped',
      data: {
        folder: `${user_code}_${session_code}`,
        event_count: tracking.event_count,
        duration_ms: tracking.recording_ended_at - tracking.recording_started_at
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

// @route   GET /api/tracking-files/session/:user_code/:session_code
// @desc    Get tracking session data for a specific user
// @access  Public
router.get('/session/:user_code/:session_code', async (req, res) => {
  try {
    const { user_code, session_code } = req.params;

    const tracking = await NavigationTracking.findOne({
      user_code: parseInt(user_code),
      session_code
    }).populate('user').populate('session');

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user_code: tracking.user_code,
        session_code: tracking.session_code,
        recording_started_at: tracking.recording_started_at,
        recording_ended_at: tracking.recording_ended_at,
        navigation_events: tracking.navigation_events,
        event_count: tracking.event_count,
        is_active: tracking.is_active
      }
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

// @route   GET /api/tracking-files/live/:session_code
// @desc    Get LIVE collaborative data for all users in a session
// @access  Public
router.get('/live/:session_code', async (req, res) => {
  try {
    const { session_code } = req.params;

    const collaborativeData = await NavigationTracking.getCombinedSessionEvents(session_code);

    if (!collaborativeData || collaborativeData.total_participants === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data found for this session'
      });
    }

    res.status(200).json({
      success: true,
      data: collaborativeData
    });

  } catch (error) {
    console.error('Error fetching live data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/sessions
// @desc    List all tracking sessions
// @access  Public
router.get('/sessions', async (req, res) => {
  try {
    const trackings = await NavigationTracking.find()
      .sort({ recording_started_at: -1 })
      .select('user_code session_code recording_started_at recording_ended_at event_count is_active');

    const sessions = trackings.map(t => ({
      folder: `${t.user_code}_${t.session_code}`,
      user_code: t.user_code,
      session_code: t.session_code,
      started_at: t.recording_started_at,
      ended_at: t.recording_ended_at,
      event_count: t.event_count,
      is_active: t.is_active
    }));

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/sessions/:session_code/members
// @desc    Get all members and their live status in a session
// @access  Public
router.get('/sessions/:session_code/members', async (req, res) => {
  try {
    const { session_code } = req.params;

    const trackings = await NavigationTracking.find({ session_code })
      .populate('user')
      .sort({ recording_started_at: 1 });

    const members = trackings.map(t => ({
      user_code: t.user_code,
      user_name: t.user?.user_name || `User ${t.user_code}`,
      is_active: t.is_active,
      event_count: t.event_count,
      last_event: t.navigation_events.length > 0 
        ? t.navigation_events[t.navigation_events.length - 1] 
        : null,
      recording_started_at: t.recording_started_at
    }));

    res.status(200).json({
      success: true,
      session_code,
      member_count: members.length,
      active_count: members.filter(m => m.is_active).length,
      members
    });

  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/tracking-files/session/:user_code/:session_code
// @desc    Delete a tracking session
// @access  Public
router.delete('/session/:user_code/:session_code', async (req, res) => {
  try {
    const { user_code, session_code } = req.params;

    await NavigationTracking.deleteOne({
      user_code: parseInt(user_code),
      session_code
    });

    console.log(`✓ Session deleted: ${user_code}_${session_code}`);

    res.status(200).json({
      success: true,
      message: 'Session deleted',
      data: { folder: `${user_code}_${session_code}` }
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

// @route   GET /api/tracking-files/health
// @desc    Health check
// @access  Public
router.get('/health', async (req, res) => {
  console.log('📥 HEALTH check request received');
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const count = mongoose.connection.readyState === 1 
      ? await NavigationTracking.countDocuments() 
      : 0;

    res.status(200).json({
      success: true,
      message: 'Tracking service is running',
      data: {
        storage: 'MongoDB',
        database_status: dbStatus,
        session_count: count
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

// @route   GET /api/tracking-files/test
// @desc    Simple test endpoint
// @access  Public
router.get('/test', (req, res) => {
  console.log('📥 TEST request received');
  res.json({ success: true, message: 'API is working!', timestamp: new Date().toISOString() });
});

module.exports = router;

