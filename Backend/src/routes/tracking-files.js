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
    const { user_code, session_code, user_name, user_email, session_name, session_description } = req.body;

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

    // Ensure user_code and session_code are strings and normalize
    const normalizedUserCode = String(user_code).toUpperCase();
    const normalizedSessionCode = String(session_code);

    // Create or find user (if user info provided)
    let user = null;
    if (user_name && user_email) {
      user = await User.findOrCreateUser({ user_code: normalizedUserCode, user_name, user_email });
    }

    // Create or find collaborative session
    const session = await Session.findOrCreateSession(
      normalizedSessionCode,
      session_name || `Session ${normalizedSessionCode}`,
      session_description || `Tracking session ${normalizedSessionCode}`,
      user
    );

    // Create navigation tracking record for this user in this session
    const tracking = await NavigationTracking.findOrCreateSession(
      normalizedUserCode,
      normalizedSessionCode,
      user?._id,
      session._id
    );

    // Add user to session members with their navigation tracking reference
    if (user) {
      await session.addMember(user, tracking._id);
    }

    console.log(`✓ Session started: ${normalizedUserCode}_${normalizedSessionCode} (MongoDB)`);

    res.status(201).json({
      success: true,
      message: 'Tracking session started',
      data: {
        folder: `${normalizedUserCode}_${normalizedSessionCode}`,
        user_code: normalizedUserCode,
        session_code: normalizedSessionCode,
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

    // Ensure user_code and session_code are strings and normalize
    const normalizedUserCode = String(user_code).toUpperCase();
    const normalizedSessionCode = String(session_code);

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database not connected'
      });
    }

    // Prepare update data
    const navigationEvents = data.navigation_events || [];
    const eventCount = navigationEvents.length;
    const updateData = {
      navigation_events: navigationEvents,
      event_count: eventCount
    };
    
    if (data.recording_ended_at) {
      updateData.recording_ended_at = data.recording_ended_at;
    }

    // Use atomic findOneAndUpdate with upsert for concurrency safety
    // This prevents race conditions when multiple users are updating simultaneously
    const tracking = await NavigationTracking.findOneAndUpdate(
      {
        user_code: normalizedUserCode,
        session_code: normalizedSessionCode,
        is_active: true
      },
      {
        $set: updateData,
        $setOnInsert: {
          user_code: normalizedUserCode,
          session_code: normalizedSessionCode,
          recording_started_at: data.recording_started_at || new Date(),
          is_active: true
        }
      },
      { 
        new: true, 
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    // If this was a new tracking document (upserted), link it to the session member
    // Check if tracking was just created by comparing recording_started_at
    const wasJustCreated = tracking.navigation_events.length === eventCount && 
                           eventCount > 0 && 
                           !tracking.user && !tracking.session;
    
    if (wasJustCreated || !tracking.user || !tracking.session) {
      // Find user and session for linking (only if not already linked)
      const [user, session] = await Promise.all([
        !tracking.user ? User.findOne({ user_code: normalizedUserCode }) : null,
        !tracking.session ? Session.findOne({ session_code: normalizedSessionCode }) : null
      ]);

      // Update tracking with user and session references if found
      if (user || session) {
        const linkUpdate = {};
        if (user && !tracking.user) linkUpdate.user = user._id;
        if (session && !tracking.session) linkUpdate.session = session._id;
        
        if (Object.keys(linkUpdate).length > 0) {
          await NavigationTracking.findByIdAndUpdate(tracking._id, { $set: linkUpdate });
        }
      }

      // Link tracking to session member using atomic operation
      if (user && session) {
        await session.updateMemberTracking(normalizedUserCode, tracking._id);
      }
    }

    console.log(`✓ LIVE: ${normalizedUserCode}_${normalizedSessionCode} → ${eventCount} events`);

    res.status(200).json({
      success: true,
      message: 'Data updated live',
      data: {
        folder: `${normalizedUserCode}_${normalizedSessionCode}`,
        event_count: eventCount,
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

    // Ensure user_code and session_code are strings and normalize
    const normalizedUserCode = String(user_code).toUpperCase();
    const normalizedSessionCode = String(session_code);

    const tracking = await NavigationTracking.findOne({
      user_code: normalizedUserCode,
      session_code: normalizedSessionCode,
      is_active: true
    });

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'Active session not found'
      });
    }

    await tracking.endRecording();

    console.log(`✓ Session stopped: ${normalizedUserCode}_${normalizedSessionCode}`);

    res.status(200).json({
      success: true,
      message: 'Tracking session stopped',
      data: {
        folder: `${normalizedUserCode}_${normalizedSessionCode}`,
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

    // Ensure user_code and session_code are strings
    const normalizedUserCode = String(user_code).toUpperCase();
    const normalizedSessionCode = String(session_code);

    const tracking = await NavigationTracking.findOne({
      user_code: normalizedUserCode,
      session_code: normalizedSessionCode
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

    // Ensure session_code is string
    const normalizedSessionCode = String(session_code);

    const collaborativeData = await NavigationTracking.getCombinedSessionEvents(normalizedSessionCode);

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
// @desc    Get all members and their live status in a session (from Session model)
// @access  Public
router.get('/sessions/:session_code/members', async (req, res) => {
  try {
    const { session_code } = req.params;

    // Ensure session_code is string
    const normalizedSessionCode = String(session_code);

    // Get session with populated members and their navigation tracking
    const session = await Session.getSessionWithMembers(normalizedSessionCode);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const members = session.members.map(member => {
      const tracking = member.navigation_tracking;
      return {
        user_id: member.user?._id || null,
        user_code: member.user_code,
        user_name: member.user_name,
        is_active: member.is_active,
        joined_at: member.joined_at,
        left_at: member.left_at,
        navigation_tracking: tracking ? {
          tracking_id: tracking._id,
          event_count: tracking.event_count || tracking.navigation_events?.length || 0,
          is_recording: tracking.is_active,
          recording_started_at: tracking.recording_started_at,
          recording_ended_at: tracking.recording_ended_at,
          navigation_events: tracking.navigation_events || [],
          last_event: tracking.navigation_events?.length > 0 
            ? tracking.navigation_events[tracking.navigation_events.length - 1] 
            : null
        } : null
      };
    });

    res.status(200).json({
      success: true,
      session_code,
      session_id: session._id,
      session_name: session.session_name,
      is_active: session.is_active,
      started_at: session.started_at,
      ended_at: session.ended_at,
      created_by: session.created_by,
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

    // Ensure user_code and session_code are strings
    const normalizedUserCode = String(user_code).toUpperCase();
    const normalizedSessionCode = String(session_code);

    await NavigationTracking.deleteOne({
      user_code: normalizedUserCode,
      session_code: normalizedSessionCode
    });

    console.log(`✓ Session deleted: ${normalizedUserCode}_${normalizedSessionCode}`);

    res.status(200).json({
      success: true,
      message: 'Session deleted',
      data: { folder: `${normalizedUserCode}_${normalizedSessionCode}` }
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

// @route   GET /api/tracking-files/sessions/:session_code/full
// @desc    Get complete session data with all members and their navigation tracking
// @access  Public
router.get('/sessions/:session_code/full', async (req, res) => {
  try {
    const { session_code } = req.params;

    // Ensure session_code is string
    const normalizedSessionCode = String(session_code);

    // Get session with populated members and their navigation tracking
    const session = await Session.getSessionWithMembers(normalizedSessionCode);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Build comprehensive session response with embedded navigation tracking
    const sessionData = {
      session_id: session._id,
      session_code: session.session_code,
      session_name: session.session_name,
      is_active: session.is_active,
      started_at: session.started_at,
      ended_at: session.ended_at,
      created_by: session.created_by ? {
        user_id: session.created_by._id,
        user_name: session.created_by.user_name,
        user_code: session.created_by.user_code
      } : null,
      member_count: session.members.length,
      active_member_count: session.members.filter(m => m.is_active).length,
      members: session.members.map(member => {
        const tracking = member.navigation_tracking;
        return {
          user_id: member.user?._id || null,
          user_code: member.user_code,
          user_name: member.user_name,
          is_active: member.is_active,
          joined_at: member.joined_at,
          left_at: member.left_at,
          navigation_tracking: tracking ? {
            tracking_id: tracking._id,
            event_count: tracking.event_count || tracking.navigation_events?.length || 0,
            is_recording: tracking.is_active,
            recording_started_at: tracking.recording_started_at,
            recording_ended_at: tracking.recording_ended_at,
            navigation_events: tracking.navigation_events || []
          } : null
        };
      }),
      total_events: session.members.reduce((total, member) => {
        const tracking = member.navigation_tracking;
        return total + (tracking?.navigation_events?.length || 0);
      }, 0)
    };

    res.status(200).json({
      success: true,
      data: sessionData
    });

  } catch (error) {
    console.error('Error fetching full session data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/validate/user/:user_code
// @desc    Validate if user code exists in the database
// @access  Public
router.get('/validate/user/:user_code', async (req, res) => {
  console.log('📥 VALIDATE USER request received:', req.params.user_code);
  try {
    const { user_code } = req.params;

    // Ensure user_code is string
    const normalizedUserCode = String(user_code).trim().toUpperCase();

    if (!normalizedUserCode || normalizedUserCode === '') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid user code format.'
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        valid: false,
        message: 'Database not connected'
      });
    }

    const user = await User.findOne({ user_code: normalizedUserCode });

    if (!user) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'User code not found. Please register on the dashboard first.'
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      message: 'User code is valid',
      data: {
        user_code: user.user_code,
        user_name: user.user_name,
        is_active: user.is_active
      }
    });

  } catch (error) {
    console.error('Error validating user:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/validate/session/:session_code
// @desc    Validate if session code exists in the database
// @access  Public
router.get('/validate/session/:session_code', async (req, res) => {
  console.log('📥 VALIDATE SESSION request received:', req.params.session_code);
  try {
    const { session_code } = req.params;

    // Ensure session_code is string
    const normalizedSessionCode = String(session_code).trim();

    if (!normalizedSessionCode || normalizedSessionCode === '') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid session code format'
      });
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        valid: false,
        message: 'Database not connected'
      });
    }

    const session = await Session.findOne({ session_code: normalizedSessionCode });

    if (!session) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Session code not found. Please create a session on the dashboard first.'
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      message: 'Session code is valid',
      data: {
        session_code: session.session_code,
        session_name: session.session_name,
        is_active: session.is_active,
        member_count: session.members.filter(m => m.is_active).length
      }
    });

  } catch (error) {
    console.error('Error validating session:', error);
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/tracking-files/validate/:user_code/:session_code
// @desc    Validate both user code and session code in one request
// @access  Public
router.get('/validate/:user_code/:session_code', async (req, res) => {
  console.log('📥 VALIDATE BOTH request received:', req.params.user_code, req.params.session_code);
  try {
    const { user_code, session_code } = req.params;

    // Ensure user_code and session_code are strings
    const normalizedUserCode = String(user_code).trim().toUpperCase();
    const normalizedSessionCode = String(session_code).trim();

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        valid: false,
        message: 'Database not connected'
      });
    }

    const errors = [];
    let user = null;
    let session = null;

    // Validate user code
    if (!normalizedUserCode || normalizedUserCode === '') {
      errors.push('Invalid user code format.');
    } else {
      user = await User.findOne({ user_code: normalizedUserCode });
      if (!user) {
        errors.push('User code not found. Please register on the dashboard first.');
      }
    }

    // Validate session code
    if (!normalizedSessionCode || normalizedSessionCode === '') {
      errors.push('Invalid session code format.');
    } else {
      session = await Session.findOne({ session_code: normalizedSessionCode });
      if (!session) {
        errors.push('Session code not found. Please create a session on the dashboard first.');
      }
    }

    if (errors.length > 0) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: errors.join(' '),
        errors: errors
      });
    }

    res.status(200).json({
      success: true,
      valid: true,
      message: 'Both user code and session code are valid',
      data: {
        user: {
          user_code: user.user_code,
          user_name: user.user_name,
          is_active: user.is_active
        },
        session: {
          session_code: session.session_code,
          session_name: session.session_name,
          is_active: session.is_active,
          member_count: session.members.filter(m => m.is_active).length
        }
      }
    });

  } catch (error) {
    console.error('Error validating:', error);
    res.status(500).json({
      success: false,
      valid: false,
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

