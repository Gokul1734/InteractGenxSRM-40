const Session = require('../models/Session');
const User = require('../models/User');
const NavigationTracking = require('../models/NavigationTracking');

/**
 * @desc    Create a new session
 * @route   POST /api/sessions
 * @access  Public (requires valid user_code)
 */
const createSession = async (req, res) => {
  try {
    const { session_name, session_description, created_by_user_code } = req.body;

    // Validation - created_by_user_code is required
    if (!created_by_user_code || created_by_user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide created_by_user_code. Only existing users can create sessions.'
      });
    }

    // Validation - session_description is required
    if (!session_description || session_description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide session_description'
      });
    }

    // Verify the user exists
    const creatorUser = await User.findOne({ user_code: created_by_user_code.toUpperCase() });
    if (!creatorUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Only existing users can create sessions. Please register first.'
      });
    }

    // Auto-generate unique session_code with 'S' suffix (format: XXXXXXS)
    const session_code = await Session.generateSessionCode();

    // Create session with creator's ObjectId
    const session = await Session.create({
      session_code,
      session_name: session_name || `Session ${session_code}`,
      session_description: session_description.trim(),
      created_by: creatorUser._id,
      members: [],
      is_active: true
    });

    // Populate created_by for response
    await session.populate('created_by', 'user_name user_code user_email');

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: session
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all sessions
 * @route   GET /api/sessions
 * @access  Public
 */
const getAllSessions = async (req, res) => {
  try {
    const { active_only } = req.query;
    
    let query = {};
    if (active_only === 'true') {
      query.is_active = true;
    }

    const sessions = await Session.find(query)
      .populate('created_by', 'user_name user_code user_email')
      .sort({ createdAt: -1 })
      .select('-__v');

    const sessionsWithCounts = sessions.map(session => ({
      ...session.toObject(),
      member_count: session.members.length,
      active_member_count: session.members.filter(m => m.is_active).length
    }));

    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessionsWithCounts
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get session by session_code
 * @route   GET /api/sessions/:session_code
 * @access  Public
 */
const getSessionByCode = async (req, res) => {
  try {
    const { session_code } = req.params;

    const session = await Session.findOne({ session_code })
      .populate('created_by', 'user_name user_code user_email')
      .populate('members.user', 'user_name user_code user_email')
      .select('-__v');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...session.toObject(),
        member_count: session.members.length,
        active_member_count: session.members.filter(m => m.is_active).length
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
};

/**
 * @desc    Get session by ID
 * @route   GET /api/sessions/id/:id
 * @access  Public
 */
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id)
      .populate('created_by', 'user_name user_code user_email')
      .populate('members.user', 'user_name user_code user_email')
      .select('-__v');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...session.toObject(),
        member_count: session.members.length,
        active_member_count: session.members.filter(m => m.is_active).length
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
};

/**
 * @desc    Update session
 * @route   PUT /api/sessions/:session_code
 * @access  Public
 */
const updateSession = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { session_name, session_description, is_active } = req.body;

    const session = await Session.findOne({ session_code });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Update fields
    if (session_name) session.session_name = session_name;
    if (session_description) session.session_description = session_description.trim();
    if (typeof is_active === 'boolean') session.is_active = is_active;

    await session.save();

    res.status(200).json({
      success: true,
      message: 'Session updated successfully',
      data: session
    });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete session
 * @route   DELETE /api/sessions/:session_code
 * @access  Public
 */
const deleteSession = async (req, res) => {
  try {
    const { session_code } = req.params;

    const session = await Session.findOneAndDelete({ session_code });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Also delete related navigation tracking data
    await NavigationTracking.deleteMany({ session_code });

    res.status(200).json({
      success: true,
      message: 'Session and related tracking data deleted successfully',
      data: { session_code }
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Add user to session
 * @route   POST /api/sessions/:session_code/members
 * @access  Public
 */
const addUserToSession = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { user_code } = req.body;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_code'
      });
    }

    // Find session
    const session = await Session.findOne({ session_code });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Find user
    const user = await User.findOne({ user_code: user_code.toUpperCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add user to session
    await session.addMember(user);

    res.status(200).json({
      success: true,
      message: 'User added to session successfully',
      data: {
        session_code,
        user_code: user.user_code,
        user_name: user.user_name,
        member_count: session.members.length
      }
    });

  } catch (error) {
    console.error('Error adding user to session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Remove user from session
 * @route   DELETE /api/sessions/:session_code/members/:user_code
 * @access  Public
 */
const removeUserFromSession = async (req, res) => {
  try {
    const { session_code, user_code } = req.params;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user code format'
      });
    }

    // Find session
    const session = await Session.findOne({ session_code });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Remove user from session (marks as inactive)
    await session.removeMember(user_code.toUpperCase());

    res.status(200).json({
      success: true,
      message: 'User removed from session successfully',
      data: {
        session_code,
        user_code: user_code.toUpperCase()
      }
    });

  } catch (error) {
    console.error('Error removing user from session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get session members
 * @route   GET /api/sessions/:session_code/members
 * @access  Public
 */
const getSessionMembers = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { active_only } = req.query;

    const session = await Session.findOne({ session_code })
      .populate('members.user', 'user_name user_code user_email')
      .populate('members.navigation_tracking');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    let members = session.members;
    if (active_only === 'true') {
      members = members.filter(m => m.is_active);
    }

    const membersData = members.map(member => ({
      user_id: member.user?._id || null,
      user_code: member.user_code,
      user_name: member.user_name,
      is_active: member.is_active,
      joined_at: member.joined_at,
      left_at: member.left_at,
      has_tracking: !!member.navigation_tracking
    }));

    res.status(200).json({
      success: true,
      session_code,
      session_name: session.session_name,
      count: membersData.length,
      data: membersData
    });

  } catch (error) {
    console.error('Error fetching session members:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    End session
 * @route   POST /api/sessions/:session_code/end
 * @access  Public
 */
const endSession = async (req, res) => {
  try {
    const { session_code } = req.params;

    const session = await Session.findOne({ session_code });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (!session.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Session is already ended'
      });
    }

    // End the session
    await session.endSession();

    // End all active tracking records for this session
    await NavigationTracking.updateMany(
      { session_code, is_active: true },
      { 
        is_active: false, 
        recording_ended_at: new Date() 
      }
    );

    res.status(200).json({
      success: true,
      message: 'Session ended successfully',
      data: {
        session_code,
        ended_at: session.ended_at
      }
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Validate if session code exists
 * @route   GET /api/sessions/validate/:session_code
 * @access  Public
 */
const validateSessionCode = async (req, res) => {
  try {
    const { session_code } = req.params;

    if (!session_code || session_code.trim() === '') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid session code format'
      });
    }

    const session = await Session.findOne({ session_code: session_code.trim() });

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
};

/**
 * @desc    Get full session data with all navigation tracking
 * @route   GET /api/sessions/:session_code/full
 * @access  Public
 */
const getFullSessionData = async (req, res) => {
  try {
    const { session_code } = req.params;

    const session = await Session.getSessionWithMembers(session_code);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Build comprehensive session response
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
};

/**
 * @desc    Get live navigation tracking updates for all session members
 * @route   GET /api/sessions/:session_code/getLiveUpdate
 * @access  Public
 * @query   since - Optional ISO timestamp to get only events after this time
 */
const getLiveUpdate = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { since } = req.query; // Optional: get only updates after this timestamp

    // Get session with members (using lean() for faster query)
    const session = await Session.findOne({ session_code })
      .populate('created_by', 'user_name user_code user_email')
      .lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Get all member user_codes from the session
    const memberUserCodes = session.members
      .filter(m => m.is_active)
      .map(m => m.user_code);

    if (memberUserCodes.length === 0) {
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        session: {
          session_code: session.session_code,
          session_name: session.session_name,
          session_description: session.session_description,
          is_active: session.is_active,
          started_at: session.started_at,
          created_by: session.created_by
        },
        member_count: 0,
        active_recording_count: 0,
        members: []
      });
    }

    // Fetch navigation tracking for all active members in this session
    const trackingData = await NavigationTracking.find({
      session_code: session_code,
      user_code: { $in: memberUserCodes }
    })
      .select('user_code is_active event_count navigation_events recording_started_at recording_ended_at updatedAt')
      .lean();

    // Build response with live status for each member
    const currentTime = new Date();
    const sinceTime = since ? new Date(since) : null;

    const membersLiveData = session.members
      .filter(m => m.is_active)
      .map(member => {
        // Find tracking data for this member
        const tracking = trackingData.find(t => t.user_code === member.user_code);

        if (!tracking) {
          return {
            user_code: member.user_code,
            user_name: member.user_name,
            joined_at: member.joined_at,
            is_recording: false,
            has_tracking: false,
            current_state: null,
            event_count: 0,
            recent_events: [],
            has_new_updates: false
          };
        }

        const events = tracking.navigation_events || [];
        const lastEvent = events.length > 0 ? events[events.length - 1] : null;

        // Get current browser state from recent events
        const currentTab = [...events]
          .reverse()
          .find(e => ['TAB_ACTIVATED', 'PAGE_OPEN', 'PAGE_URL_CHANGE', 'TAB_UPDATED', 'PAGE_LOADED'].includes(e.event_type));

        // Filter events based on 'since' parameter
        let recentEvents = [];
        let hasNewUpdates = false;

        if (sinceTime) {
          // Return only events after the 'since' timestamp
          recentEvents = events.filter(e => new Date(e.timestamp) > sinceTime);
          hasNewUpdates = recentEvents.length > 0;
        } else {
          // Return last 10 events if no 'since' parameter
          recentEvents = events.slice(-10);
          hasNewUpdates = events.length > 0;
        }

        return {
          user_code: member.user_code,
          user_name: member.user_name,
          joined_at: member.joined_at,
          is_recording: tracking.is_active,
          has_tracking: true,
          recording_started_at: tracking.recording_started_at,
          recording_ended_at: tracking.recording_ended_at,
          last_updated: tracking.updatedAt,
          event_count: tracking.event_count || events.length,
          has_new_updates: hasNewUpdates,
          current_state: currentTab ? {
            url: currentTab.context?.url || null,
            title: currentTab.context?.title || null,
            favicon: currentTab.context?.favIconUrl || null,
            tab_id: currentTab.context?.tabId || null,
            window_id: currentTab.context?.windowId || null,
            last_event_type: lastEvent?.event_type || null,
            last_event_time: lastEvent?.timestamp || null
          } : null,
          recent_events: recentEvents
        };
      });

    // Calculate summary stats
    const activeRecordingCount = membersLiveData.filter(m => m.is_recording).length;
    const totalEvents = membersLiveData.reduce((sum, m) => sum + m.event_count, 0);

    res.status(200).json({
      success: true,
      timestamp: currentTime.toISOString(),
      session: {
        session_code: session.session_code,
        session_name: session.session_name,
        session_description: session.session_description,
        is_active: session.is_active,
        started_at: session.started_at,
        ended_at: session.ended_at,
        created_by: session.created_by
      },
      summary: {
        member_count: membersLiveData.length,
        active_recording_count: activeRecordingCount,
        total_events: totalEvents,
        has_any_updates: sinceTime ? membersLiveData.some(m => m.has_new_updates) : true
      },
      members: membersLiveData
    });

  } catch (error) {
    console.error('Error fetching live update:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
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
};

