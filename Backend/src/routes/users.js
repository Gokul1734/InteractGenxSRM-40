const express = require('express');
const router = express.Router();
const {
  createUser,
  getAllUsers,
  getUserByCode,
  getUserById,
  updateUser,
  deleteUser,
  getUserSessions,
  validateUserCode
} = require('../controllers/userController');

// @route   POST /api/users
// @desc    Create a new user
router.post('/', createUser);

// @route   GET /api/users
// @desc    Get all users
router.get('/', getAllUsers);

// @route   GET /api/users/validate/:user_code
// @desc    Validate if user code exists
router.get('/validate/:user_code', validateUserCode);

// @route   GET /api/users/id/:id
// @desc    Get user by MongoDB ID
router.get('/id/:id', getUserById);

// @route   GET /api/users/:user_code
// @desc    Get user by user_code
router.get('/:user_code', getUserByCode);

// @route   PUT /api/users/:user_code
// @desc    Update user
router.put('/:user_code', updateUser);

// @route   DELETE /api/users/:user_code
// @desc    Delete user
router.delete('/:user_code', deleteUser);

// @route   GET /api/users/:user_code/sessions
// @desc    Get all sessions for a user
router.get('/:user_code/sessions', getUserSessions);

module.exports = router;

