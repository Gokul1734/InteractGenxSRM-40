const Session = require('../models/Session');
const User = require('../models/User');
const NavigationTracking = require('../models/NavigationTracking');

/**
 * @desc    Create a new session
 * @route   POST /api/sessions
 * @access  Public
 */
const createSession = async (req, res) => {
  try {
    const { session_code, session_name, created_by_user_code } = req.body;

    // Validation
    if (!session_code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a session_code'
      });
    }

    // Check if session_code already exists
    const existingSession = await Session.findOne({ session_code });
    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'Session code already exists'
      });
    }

    // Get creator user if provided
    let creatorUser = null;
    if (created_by_user_code) {
      creatorUser = await User.findOne({ user_code: created_by_user_code });
    }

    // Create session
    const session = await Session.create({
      session_code,
      session_name: session_name || `Session ${session_code}`,
      created_by: creatorUser?._id || null,
      members: [],
      is_active: true
    });

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
    const { session_name, is_active } = req.body;

    const session = await Session.findOne({ session_code });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Update fields
    if (session_name) session.session_name = session_name;
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

    if (!user_code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_code'
      });
    }

    const userCodeNum = parseInt(user_code);
    if (isNaN(userCodeNum)) {
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

    // Find user
    const user = await User.findOne({ user_code: userCodeNum });
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
        user_code: userCodeNum,
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
    const userCodeNum = parseInt(user_code);

    if (isNaN(userCodeNum)) {
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
    await session.removeMember(userCodeNum);

    res.status(200).json({
      success: true,
      message: 'User removed from session successfully',
      data: {
        session_code,
        user_code: userCodeNum
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
  getFullSessionData
};

