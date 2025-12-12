const express = require('express');
const router = express.Router();
const {
  getUserPendingInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation
} = require('../controllers/invitationController');

// @route   GET /api/invitations/pending/:user_code
// @desc    Get all pending invitations for a user
router.get('/pending/:user_code', getUserPendingInvitations);

// @route   POST /api/invitations/:invitation_id/accept
// @desc    Accept an invitation and join the session
router.post('/:invitation_id/accept', acceptInvitation);

// @route   POST /api/invitations/:invitation_id/decline
// @desc    Decline an invitation
router.post('/:invitation_id/decline', declineInvitation);

// @route   DELETE /api/invitations/:invitation_id
// @desc    Cancel an invitation (by session creator)
router.delete('/:invitation_id', cancelInvitation);

module.exports = router;

