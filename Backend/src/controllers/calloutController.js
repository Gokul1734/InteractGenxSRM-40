const Callout = require('../models/Callout');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return '';
  }
}

/**
 * @desc    Create a new callout
 * @route   POST /api/callouts
 * @access  Public (requires valid session member)
 */
const createCallout = async (req, res) => {
  try {
    const {
      session_code,
      user_code,
      page_url,
      page_title,
      page_favicon,
      scroll_position,
      selected_text,
      message,
      tab_context
    } = req.body;

    // Validate required fields
    if (!session_code || !user_code || !page_url) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: session_code, user_code, and page_url are required'
      });
    }

    // Verify session exists and is active
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
        message: 'Cannot create callout in an inactive session'
      });
    }

    // Verify user is a member of the session
    const member = session.members.find(
      m => m.user_code === user_code.toUpperCase() && m.is_active
    );

    if (!member) {
      return res.status(403).json({
        success: false,
        message: 'User is not an active member of this session'
      });
    }

    // Create the callout
    const callout = await Callout.create({
      session_code,
      user_code: user_code.toUpperCase(),
      user_name: member.user_name,
      page_url,
      page_title: page_title || '',
      page_domain: extractDomain(page_url),
      page_favicon: page_favicon || '',
      scroll_position: scroll_position || { x: 0, y: 0, y_percentage: 0 },
      selected_text: selected_text || null,
      message: message || '',
      tab_context: tab_context || {},
      status: 'active'
    });

    console.log(`✓ Callout created by ${member.user_name} in session ${session_code}`);

    res.status(201).json({
      success: true,
      message: 'Callout created successfully',
      data: callout
    });

  } catch (error) {
    console.error('Error creating callout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get active callouts for a session
 * @route   GET /api/callouts/session/:session_code
 * @access  Public
 */
const getSessionCallouts = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { status, exclude_user, limit } = req.query;

    // Build query
    const query = { session_code };

    if (status === 'active') {
      query.status = 'active';
      query.expires_at = { $gt: new Date() };
    } else if (status) {
      query.status = status;
    }

    if (exclude_user) {
      query.user_code = { $ne: exclude_user.toUpperCase() };
    }

    const callouts = await Callout.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit) || 50);

    // Add is_expired flag to each callout
    const calloutsWithExpiry = callouts.map(callout => ({
      ...callout.toObject(),
      is_expired: callout.expires_at && new Date() > callout.expires_at
    }));

    res.status(200).json({
      success: true,
      count: calloutsWithExpiry.length,
      data: calloutsWithExpiry
    });

  } catch (error) {
    console.error('Error fetching callouts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get active callouts for a session (optimized for polling)
 * @route   GET /api/callouts/session/:session_code/active
 * @access  Public
 */
const getActiveCallouts = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { exclude_user, since } = req.query;

    const query = {
      session_code,
      status: 'active',
      expires_at: { $gt: new Date() }
    };

    if (exclude_user) {
      query.user_code = { $ne: exclude_user.toUpperCase() };
    }

    // If 'since' is provided, only get callouts created after that time
    if (since) {
      query.created_at = { $gt: new Date(since) };
    }

    const callouts = await Callout.find(query).sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      count: callouts.length,
      data: callouts
    });

  } catch (error) {
    console.error('Error fetching active callouts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get a single callout by ID
 * @route   GET /api/callouts/:id
 * @access  Public
 */
const getCalloutById = async (req, res) => {
  try {
    const { id } = req.params;

    const callout = await Callout.findById(id);

    if (!callout) {
      return res.status(404).json({
        success: false,
        message: 'Callout not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...callout.toObject(),
        is_expired: callout.expires_at && new Date() > callout.expires_at
      }
    });

  } catch (error) {
    console.error('Error fetching callout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Acknowledge a callout (mark as seen by user)
 * @route   POST /api/callouts/:id/acknowledge
 * @access  Public
 */
const acknowledgeCallout = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_code, user_name } = req.body;

    if (!user_code) {
      return res.status(400).json({
        success: false,
        message: 'user_code is required'
      });
    }

    const callout = await Callout.findById(id);

    if (!callout) {
      return res.status(404).json({
        success: false,
        message: 'Callout not found'
      });
    }

    // Get user name if not provided
    let acknowledgerName = user_name;
    if (!acknowledgerName) {
      const user = await User.findOne({ user_code: user_code.toUpperCase() });
      acknowledgerName = user ? user.user_name : `User ${user_code}`;
    }

    await callout.acknowledge(user_code, acknowledgerName);

    res.status(200).json({
      success: true,
      message: 'Callout acknowledged',
      data: callout
    });

  } catch (error) {
    console.error('Error acknowledging callout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Dismiss a callout (by creator or admin)
 * @route   POST /api/callouts/:id/dismiss
 * @access  Public
 */
const dismissCallout = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_code } = req.body;

    const callout = await Callout.findById(id);

    if (!callout) {
      return res.status(404).json({
        success: false,
        message: 'Callout not found'
      });
    }

    // Only allow the creator to dismiss their own callout
    if (user_code && callout.user_code !== user_code.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: 'Only the callout creator can dismiss it'
      });
    }

    await callout.dismiss();

    res.status(200).json({
      success: true,
      message: 'Callout dismissed',
      data: callout
    });

  } catch (error) {
    console.error('Error dismissing callout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a callout
 * @route   DELETE /api/callouts/:id
 * @access  Public
 */
const deleteCallout = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_code } = req.body;

    const callout = await Callout.findById(id);

    if (!callout) {
      return res.status(404).json({
        success: false,
        message: 'Callout not found'
      });
    }

    // Only allow the creator to delete their own callout
    if (user_code && callout.user_code !== user_code.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: 'Only the callout creator can delete it'
      });
    }

    await Callout.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Callout deleted'
    });

  } catch (error) {
    console.error('Error deleting callout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get callout statistics for a session
 * @route   GET /api/callouts/session/:session_code/stats
 * @access  Public
 */
const getCalloutStats = async (req, res) => {
  try {
    const { session_code } = req.params;

    const now = new Date();

    // Get counts by status
    const stats = await Callout.aggregate([
      { $match: { session_code } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get active (non-expired) count
    const activeCount = await Callout.countDocuments({
      session_code,
      status: 'active',
      expires_at: { $gt: now }
    });

    // Get total callouts count
    const totalCount = await Callout.countDocuments({ session_code });

    // Get callouts by user
    const byUser = await Callout.aggregate([
      { $match: { session_code } },
      {
        $group: {
          _id: { user_code: '$user_code', user_name: '$user_name' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        active: activeCount,
        by_status: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        by_user: byUser.map(u => ({
          user_code: u._id.user_code,
          user_name: u._id.user_name,
          count: u.count
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching callout stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  createCallout,
  getSessionCallouts,
  getActiveCallouts,
  getCalloutById,
  acknowledgeCallout,
  dismissCallout,
  deleteCallout,
  getCalloutStats
};

