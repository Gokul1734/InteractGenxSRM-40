const User = require('../models/User');
const Session = require('../models/Session');

/**
 * @desc    Create a new user
 * @route   POST /api/users
 * @access  Public
 */
const createUser = async (req, res) => {
  try {
    const { user_name, user_email } = req.body;

    // Validation
    if (!user_name || !user_email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_name and user_email'
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ user_email: user_email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Auto-generate unique user_code with 'U' suffix (format: XXXXXXU)
    const user_code = await User.generateUserCode();

    // Create user
    const user = await User.create({
      user_name,
      user_email,
      user_code
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Public
 */
const getAllUsers = async (req, res) => {
  try {
    const { active_only } = req.query;
    
    let query = {};
    if (active_only === 'true') {
      query.is_active = true;
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get user by user_code
 * @route   GET /api/users/:user_code
 * @access  Public
 */
const getUserByCode = async (req, res) => {
  try {
    const { user_code } = req.params;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user code format'
      });
    }

    const user = await User.findOne({ user_code: user_code.toUpperCase() }).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/id/:id
 * @access  Public
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:user_code
 * @access  Public
 */
const updateUser = async (req, res) => {
  try {
    const { user_code } = req.params;
    const { user_name, user_email, is_active } = req.body;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user code format'
      });
    }

    const user = await User.findOne({ user_code: user_code.toUpperCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if new email is already taken by another user
    if (user_email && user_email.toLowerCase() !== user.user_email) {
      const existingEmail = await User.findOne({ 
        user_email: user_email.toLowerCase(),
        _id: { $ne: user._id }
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another user'
        });
      }
    }

    // Update fields
    if (user_name) user.user_name = user_name;
    if (user_email) user.user_email = user_email;
    if (typeof is_active === 'boolean') user.is_active = is_active;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:user_code
 * @access  Public
 */
const deleteUser = async (req, res) => {
  try {
    const { user_code } = req.params;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user code format'
      });
    }

    const user = await User.findOneAndDelete({ user_code: user_code.toUpperCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: { user_code: user_code.toUpperCase() }
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get sessions for a user
 * @route   GET /api/users/:user_code/sessions
 * @access  Public
 */
const getUserSessions = async (req, res) => {
  try {
    const { user_code } = req.params;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user code format'
      });
    }

    // Find all sessions where user is a member
    const sessions = await Session.find({
      'members.user_code': user_code.toUpperCase()
    }).select('-__v');

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
};

/**
 * @desc    Validate if user code exists
 * @route   GET /api/users/validate/:user_code
 * @access  Public
 */
const validateUserCode = async (req, res) => {
  try {
    const { user_code } = req.params;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid user code format.'
      });
    }

    const user = await User.findOne({ user_code: user_code.toUpperCase() });

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
};

module.exports = {
  createUser,
  getAllUsers,
  getUserByCode,
  getUserById,
  updateUser,
  deleteUser,
  getUserSessions,
  validateUserCode
};

