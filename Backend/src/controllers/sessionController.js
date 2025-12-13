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

    // Prepare creator member data
    const creatorMember = {
      user: creatorUser._id,
      user_code: creatorUser.user_code,
      user_name: creatorUser.user_name,
      is_active: true,
      joined_at: new Date()
    };

    // Create session with creator's ObjectId and auto-add creator as first member
    const session = await Session.create({
      session_code,
      session_name: session_name || `Session ${session_code}`,
      session_description: session_description.trim(),
      created_by: creatorUser._id,
      members: [creatorMember],
      is_active: true
    });

    console.log(`✓ Session ${session_code} created with ${session.members.length} member(s):`, session.members.map(m => m.user_code));

    // Re-fetch from database to ensure we return the persisted data with all fields
    const savedSession = await Session.findById(session._id)
      .populate('created_by', 'user_name user_code user_email');

    if (!savedSession) {
      throw new Error('Session was created but could not be retrieved');
    }

    // Verify creator is in members - if not, add them now
    const creatorInMembers = savedSession.members.some(
      m => m.user_code === creatorUser.user_code
    );

    if (!creatorInMembers) {
      console.log(`⚠ Creator ${creatorUser.user_code} not found in members, adding now...`);
      savedSession.members.push(creatorMember);
      await savedSession.save();
      console.log(`✓ Creator added to members. Total members: ${savedSession.members.length}`);
    }

    // Build response with explicit member data
    const responseData = {
      ...savedSession.toObject(),
      member_count: savedSession.members.length,
      active_member_count: savedSession.members.filter(m => m.is_active).length
    };

    console.log(`✓ Returning session with ${responseData.members.length} member(s)`);

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      data: responseData
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

    // Ensure creator is in members (safety check for older sessions)
    if (session.created_by) {
      const creatorInMembers = session.members.some(
        m => m.user_code === session.created_by.user_code
      );

      if (!creatorInMembers) {
        console.log(`⚠ getSessionByCode: Creator ${session.created_by.user_code} not in members, adding now...`);
        session.members.push({
          user: session.created_by._id,
          user_code: session.created_by.user_code,
          user_name: session.created_by.user_name,
          is_active: true,
          joined_at: session.started_at || session.createdAt || new Date()
        });
        await session.save();
        console.log(`✓ Creator added to session ${session_code}. Total members: ${session.members.length}`);
      }
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

    // Get all user codes from session members
    const memberUserCodes = session.members.map(m => m.user_code);

    // Fetch ALL navigation tracking documents for all members in this session
    // This includes all recording sessions (even if stopped and restarted)
    const NavigationTracking = require('../models/NavigationTracking');
    const allTrackingData = await NavigationTracking.find({
      session_code: session_code,
      user_code: { $in: memberUserCodes }
    })
      .select('user_code is_active event_count navigation_events recording_started_at recording_ended_at')
      .sort({ recording_started_at: 1 })
      .lean();

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
        // Get ALL tracking documents for this member (not just the one referenced)
        const allTrackingForUser = allTrackingData.filter(t => t.user_code === member.user_code);

        if (!allTrackingForUser || allTrackingForUser.length === 0) {
          return {
            user_id: member.user?._id || null,
            user_code: member.user_code,
            user_name: member.user_name,
            is_active: member.is_active,
            joined_at: member.joined_at,
            left_at: member.left_at,
            navigation_tracking: null
          };
        }

        // Combine all navigation_events from all tracking documents for this user
        const allEvents = [];
        allTrackingForUser.forEach(tracking => {
          if (tracking.navigation_events && tracking.navigation_events.length > 0) {
            allEvents.push(...tracking.navigation_events);
          }
        });

        // Sort all events by timestamp
        allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Get the most recent active tracking document to determine current recording status
        const activeTracking = allTrackingForUser
          .filter(t => t.is_active)
          .sort((a, b) => new Date(b.recording_started_at) - new Date(a.recording_started_at))[0];

        // Get the earliest recording start time and latest recording end time
        const earliestStart = allTrackingForUser
          .map(t => t.recording_started_at)
          .sort((a, b) => new Date(a) - new Date(b))[0];
        const latestEnd = allTrackingForUser
          .map(t => t.recording_ended_at)
          .filter(end => end !== null)
          .sort((a, b) => new Date(b) - new Date(a))[0] || null;

        return {
          user_id: member.user?._id || null,
          user_code: member.user_code,
          user_name: member.user_name,
          is_active: member.is_active,
          joined_at: member.joined_at,
          left_at: member.left_at,
          navigation_tracking: {
            tracking_id: activeTracking?._id || allTrackingForUser[allTrackingForUser.length - 1]?._id || null,
            event_count: allEvents.length,
            is_recording: activeTracking ? activeTracking.is_active : false,
            recording_started_at: earliestStart,
            recording_ended_at: latestEnd,
            navigation_events: allEvents
          }
        };
      }),
      total_events: session.members.reduce((total, member) => {
        const allTrackingForUser = allTrackingData.filter(t => t.user_code === member.user_code);
        const eventCount = allTrackingForUser.reduce((sum, tracking) => {
          return sum + (tracking.navigation_events?.length || 0);
        }, 0);
        return total + eventCount;
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

    // Get session with members
    const session = await Session.findOne({ session_code })
      .populate('created_by', 'user_name user_code user_email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Ensure creator is in members (safety check for older sessions)
    let membersUpdated = false;
    if (session.created_by) {
      const creatorInMembers = session.members.some(
        m => m.user_code === session.created_by.user_code
      );

      if (!creatorInMembers) {
        console.log(`⚠ getLiveUpdate: Creator ${session.created_by.user_code} not in members for session ${session_code}, adding now...`);
        session.members.push({
          user: session.created_by._id,
          user_code: session.created_by.user_code,
          user_name: session.created_by.user_name,
          is_active: true,
          joined_at: session.started_at || session.createdAt || new Date()
        });
        await session.save();
        membersUpdated = true;
        console.log(`✓ Creator added to session ${session_code}. Total members: ${session.members.length}`);
      }
    }

    // Get all member user_codes from the session (active members)
    const activeMembers = session.members.filter(m => m.is_active);
    const memberUserCodes = activeMembers.map(m => m.user_code);

    if (memberUserCodes.length === 0) {
      // No active members - but still return session info
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
        summary: {
          member_count: 0,
          active_recording_count: 0,
          total_events: 0,
          has_any_updates: false
        },
        members: []
      });
    }

    // Fetch ALL navigation tracking documents for all active members in this session
    // This includes all recording sessions (even if stopped and restarted)
    const trackingData = await NavigationTracking.find({
      session_code: session_code,
      user_code: { $in: memberUserCodes }
    })
      .select('user_code is_active event_count navigation_events recording_started_at recording_ended_at updatedAt')
      .sort({ recording_started_at: 1 }) // Sort by recording start time
      .lean();

    // Build response with live status for each member
    const currentTime = new Date();
    const sinceTime = since ? new Date(since) : null;

    const membersLiveData = session.members
      .filter(m => m.is_active)
      .map(member => {
        // Get ALL tracking documents for this member (not just the first one)
        const allTrackingForUser = trackingData.filter(t => t.user_code === member.user_code);

        if (!allTrackingForUser || allTrackingForUser.length === 0) {
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

        // Combine all navigation_events from all tracking documents for this user
        // Filter only PAGE_LOADED events and keep only the most recent event per unique URL
        const urlEventMap = new Map(); // Map<url, mostRecentEvent>
        
        allTrackingForUser.forEach(tracking => {
          if (tracking.navigation_events && tracking.navigation_events.length > 0) {
            tracking.navigation_events.forEach(event => {
              // Only include PAGE_LOADED events
              if (event.event_type === 'PAGE_LOADED') {
                const url = event.context?.url || event.context?.full_url || '';
                if (url) {
                  const existingEvent = urlEventMap.get(url);
                  // Keep the most recent event for each URL
                  if (!existingEvent || new Date(event.timestamp) > new Date(existingEvent.timestamp)) {
                    urlEventMap.set(url, event);
                  }
                }
              }
            });
          }
        });

        // Convert map to array and sort by timestamp
        const allEvents = Array.from(urlEventMap.values()).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Get the most recent active tracking document to determine current recording status
        const activeTracking = allTrackingForUser
          .filter(t => t.is_active)
          .sort((a, b) => new Date(b.recording_started_at) - new Date(a.recording_started_at))[0];

        // Get the most recent tracking document (active or not) for metadata
        const mostRecentTracking = allTrackingForUser
          .sort((a, b) => new Date(b.updatedAt || b.recording_started_at) - new Date(a.updatedAt || a.recording_started_at))[0];

        // Get the earliest recording start time and latest recording end time
        const earliestStart = allTrackingForUser
          .map(t => t.recording_started_at)
          .sort((a, b) => new Date(a) - new Date(b))[0];
        const latestEnd = allTrackingForUser
          .map(t => t.recording_ended_at)
          .filter(end => end !== null)
          .sort((a, b) => new Date(b) - new Date(a))[0] || null;

        const lastEvent = allEvents.length > 0 ? allEvents[allEvents.length - 1] : null;

        // Get current browser state from the most recent PAGE_LOADED event
        const currentTab = allEvents.length > 0 ? allEvents[allEvents.length - 1] : null;

        // Filter events based on 'since' parameter
        let recentEvents = [];
        let hasNewUpdates = false;

        if (sinceTime) {
          // Return only events after the 'since' timestamp
          recentEvents = allEvents.filter(e => new Date(e.timestamp) > sinceTime);
          hasNewUpdates = recentEvents.length > 0;
        } else {
          // Return last 10 events if no 'since' parameter
          recentEvents = allEvents.slice(-10);
          hasNewUpdates = allEvents.length > 0;
        }

        return {
          user_code: member.user_code,
          user_name: member.user_name,
          joined_at: member.joined_at,
          is_recording: activeTracking ? activeTracking.is_active : false,
          has_tracking: true,
          recording_started_at: earliestStart,
          recording_ended_at: latestEnd,
          last_updated: mostRecentTracking?.updatedAt || mostRecentTracking?.recording_started_at,
          event_count: allEvents.length,
          has_new_updates: hasNewUpdates,
          current_state: currentTab ? {
            url: currentTab.context?.url || currentTab.context?.full_url || null,
            title: currentTab.context?.title || null,
            favicon: currentTab.context?.favicon || currentTab.context?.favIconUrl || null,
            tab_id: currentTab.context?.tab_id || currentTab.context?.tabId || null,
            window_id: currentTab.context?.window_id || currentTab.context?.windowId || null,
            last_event_type: currentTab.event_type || null,
            last_event_time: currentTab.timestamp || null
          } : null,
          recent_events: recentEvents,
          navigation_events: allEvents // Include all PAGE_LOADED events
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

/**
 * @desc    Fix existing sessions - add creator to members if not already present
 * @route   POST /api/sessions/fix-creator-members
 * @access  Public
 */
const fixCreatorMembers = async (req, res) => {
  try {
    // Find all sessions
    const sessions = await Session.find({}).populate('created_by', 'user_name user_code user_email');
    
    let fixed = 0;
    let alreadyOk = 0;
    const results = [];

    for (const session of sessions) {
      if (!session.created_by) {
        results.push({ session_code: session.session_code, status: 'skipped', reason: 'No creator' });
        continue;
      }

      // Check if creator is already in members
      const creatorInMembers = session.members.some(
        m => m.user_code === session.created_by.user_code
      );

      if (creatorInMembers) {
        alreadyOk++;
        results.push({ session_code: session.session_code, status: 'ok', reason: 'Creator already in members' });
      } else {
        // Add creator to members
        session.members.push({
          user: session.created_by._id,
          user_code: session.created_by.user_code,
          user_name: session.created_by.user_name,
          is_active: true,
          joined_at: session.started_at || session.createdAt || new Date()
        });
        await session.save();
        fixed++;
        results.push({ session_code: session.session_code, status: 'fixed', reason: 'Added creator to members' });
      }
    }

    res.status(200).json({
      success: true,
      message: `Fixed ${fixed} sessions, ${alreadyOk} were already correct`,
      data: {
        total_sessions: sessions.length,
        fixed,
        already_ok: alreadyOk,
        details: results
      }
    });

  } catch (error) {
    console.error('Error fixing creator members:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get stored summary for a member
 * @route   GET /api/sessions/:session_code/members/:user_code/summary
 * @access  Public
 */
const getMemberSummary = async (req, res) => {
  try {
    const { session_code, user_code } = req.params;

    const MemberSummary = require('../models/MemberSummary');
    const summary = await MemberSummary.findOne({
      session_code: session_code,
      user_code: user_code.toUpperCase()
    })
      .populate('session', 'session_name session_description')
      .populate('user', 'user_name user_code')
      .lean();

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'No summary found for this user in this session'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        summary: summary.summary,
        relevance_score: summary.relevance_score,
        event_count: summary.event_count,
        user_code: summary.user_code,
        user_name: summary.user?.user_name || summary.user_code,
        session_code: summary.session_code,
        session_name: summary.session?.session_name || summary.session_code,
        generated_at: summary.generated_at
      }
    });

  } catch (error) {
    console.error('Error fetching member summary:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Summarize a member's navigation history using Gemini AI
 * @route   POST /api/sessions/:session_code/members/:user_code/summarize
 * @access  Public
 */
const summarizeMemberNavigation = async (req, res) => {
  try {
    const { session_code, user_code } = req.params;

    // Get session info for context
    const session = await Session.findOne({ session_code });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    const sessionName = session.session_name || session_code;
    const sessionDescription = session.session_description || 'No description provided';
    
    // Get user info
    const User = require('../models/User');
    const user = await User.findOne({ user_code: user_code.toUpperCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    const userName = user.user_name || user_code;

    // Get all navigation tracking data for this user in this session
    const NavigationTracking = require('../models/NavigationTracking');
    const allTrackingData = await NavigationTracking.find({
      session_code: session_code,
      user_code: user_code.toUpperCase()
    })
      .select('navigation_events recording_started_at recording_ended_at is_active')
      .sort({ recording_started_at: 1 })
      .lean();

    if (!allTrackingData || allTrackingData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No navigation tracking data found for this user in this session'
      });
    }

    // Combine all events from all tracking documents
    const allEvents = [];
    allTrackingData.forEach(tracking => {
      if (tracking.navigation_events && tracking.navigation_events.length > 0) {
        tracking.navigation_events.forEach(event => {
          allEvents.push({
            event_type: event.event_type,
            timestamp: event.timestamp,
            context: event.context
          });
        });
      }
    });

    // Sort by timestamp
    allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (allEvents.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          summary: 'No navigation events found for this user in this session.'
        }
      });
    }

    // Format events for AI context - focus on navigation patterns, not just sites
    const eventsText = allEvents.map((event, idx) => {
      const time = new Date(event.timestamp).toLocaleString();
      const eventType = event.event_type;
      const url = event.context?.url || event.context?.full_url || '';
      const title = event.context?.title || '';
      const searchQuery = event.context?.query || event.context?.search_query || '';
      
      let line = `${idx + 1}. [${time}] ${eventType}`;
      if (searchQuery) {
        line += ` - Searched: "${searchQuery}"`;
      }
      if (title && url) {
        line += ` - Visited: ${title}`;
      } else if (url) {
        line += ` - URL: ${url}`;
      }
      return line;
    }).join('\n');

    // Prepare prompt for Gemini - focus on research relevance
    const prompt = `You are analyzing the browser navigation history for user "${userName}" in a research session.

Session Topic/Description: "${sessionDescription}"

Navigation History:
${eventsText}

Analyze this navigation history and provide:
1. A summary of the user's research activities and navigation patterns (focus on what they were researching, not just listing websites)
2. How closely their research aligns with the session topic/description
3. A relevance score from 0-100 indicating how relevant their research is to the session topic (0 = completely unrelated, 100 = highly relevant)

Format your response as JSON with the following structure:
{
  "summary": "2-3 paragraph summary focusing on research activities and patterns",
  "relevance_score": <number between 0-100>,
  "relevance_explanation": "Brief explanation of why this score was given"
}

Return ONLY valid JSON, no additional text.`;

    // Initialize Gemini AI using @google/genai
    const { GoogleGenAI } = require('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey
    });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const responseText = response.text || 'Unable to generate summary.';
    
    // Parse JSON response
    let summaryData;
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summaryData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback if JSON parsing fails
      summaryData = {
        summary: responseText,
        relevance_score: null,
        relevance_explanation: 'Could not parse relevance score from AI response'
      };
    }

    // Save or update summary in database (overwrites existing summary)
    const MemberSummary = require('../models/MemberSummary');
    const summaryDoc = await MemberSummary.findOneAndUpdate(
      {
        session_code: session_code,
        user_code: user_code.toUpperCase()
      },
      {
        session: session._id,
        user: user._id,
        summary: summaryData.summary || responseText,
        relevance_score: summaryData.relevance_score || null,
        event_count: allEvents.length,
        generated_at: new Date(),
        updatedAt: new Date()
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({
      success: true,
      data: {
        summary: summaryData.summary || responseText,
        relevance_score: summaryData.relevance_score,
        relevance_explanation: summaryData.relevance_explanation,
        event_count: allEvents.length,
        user_code: user_code.toUpperCase(),
        user_name: userName,
        session_code: session_code,
        session_name: sessionName,
        generated_at: summaryDoc.generated_at
      }
    });

  } catch (error) {
    console.error('Error summarizing member navigation:', error);
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
  getLiveUpdate,
  fixCreatorMembers,
  summarizeMemberNavigation,
  getMemberSummary
};

