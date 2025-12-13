const SessionInvitation = require('../models/SessionInvitation');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * @desc    Send invitation to join a session
 * @route   POST /api/sessions/:session_code/invitations
 * @access  Public (only session creator can send)
 */
const sendInvitation = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { inviter_user_code, invitee_user_code, message } = req.body;

    // Validation
    if (!inviter_user_code || inviter_user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide inviter_user_code (session creator)'
      });
    }

    if (!invitee_user_code || invitee_user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide invitee_user_code (user to invite)'
      });
    }

    // Find the session
    const session = await Session.findOne({ session_code })
      .populate('created_by', 'user_code');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check if session is active
    if (!session.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send invitations to an inactive session'
      });
    }

    // Find inviter user
    const inviter = await User.findOne({ user_code: inviter_user_code.toUpperCase() });
    if (!inviter) {
      return res.status(404).json({
        success: false,
        message: 'Inviter user not found'
      });
    }

    // Verify inviter is the session creator
    if (session.created_by.user_code !== inviter.user_code) {
      return res.status(403).json({
        success: false,
        message: 'Only the session creator can send invitations'
      });
    }

    // Find invitee user
    const invitee = await User.findOne({ user_code: invitee_user_code.toUpperCase() });
    if (!invitee) {
      return res.status(404).json({
        success: false,
        message: 'Invitee user not found. The user must be registered first.'
      });
    }

    // Check if inviter is trying to invite themselves
    if (inviter.user_code === invitee.user_code) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself to the session'
      });
    }

    // Check if invitee is already a member
    const existingMember = session.members.find(
      m => m.user_code === invitee.user_code && m.is_active
    );
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this session'
      });
    }

    // Check if there's already a pending invitation
    const hasPending = await SessionInvitation.hasPendingInvitation(session._id, invitee._id);
    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: 'User already has a pending invitation for this session'
      });
    }

    // Create the invitation
    const invitation = await SessionInvitation.create({
      session: session._id,
      session_code: session.session_code,
      invited_by: inviter._id,
      invited_user: invitee._id,
      invited_user_code: invitee.user_code,
      message: message || '',
      status: 'pending'
    });

    // Populate for response
    await invitation.populate('session', 'session_code session_name session_description');
    await invitation.populate('invited_by', 'user_name user_code');
    await invitation.populate('invited_user', 'user_name user_code user_email');

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        invitation_id: invitation._id,
        session_code: invitation.session_code,
        session_name: invitation.session.session_name,
        invited_user: {
          user_code: invitation.invited_user.user_code,
          user_name: invitation.invited_user.user_name,
          user_email: invitation.invited_user.user_email
        },
        invited_by: {
          user_code: invitation.invited_by.user_code,
          user_name: invitation.invited_by.user_name
        },
        status: invitation.status,
        message: invitation.message,
        created_at: invitation.createdAt
      }
    });

  } catch (error) {
    console.error('Error sending invitation:', error);
    
    // Handle duplicate key error for unique index
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User already has a pending invitation for this session'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all pending invitations for a user
 * @route   GET /api/invitations/pending/:user_code
 * @access  Public
 */
const getUserPendingInvitations = async (req, res) => {
  try {
    const { user_code } = req.params;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_code'
      });
    }

    // Check if MongoDB is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      // MongoDB not connected, return empty result
      return res.status(200).json({
        success: true,
        user_code: user_code.toUpperCase(),
        count: 0,
        data: []
      });
    }

    // Verify user exists
    const user = await User.findOne({ user_code: user_code.toUpperCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get pending invitations
    const invitations = await SessionInvitation.getPendingInvitations(user_code);

    const invitationsData = invitations.map(inv => ({
      invitation_id: inv._id,
      session: {
        session_code: inv.session?.session_code || null,
        session_name: inv.session?.session_name || null,
        session_description: inv.session?.session_description || null,
        is_active: inv.session?.is_active || false
      },
      invited_by: {
        user_code: inv.invited_by?.user_code || null,
        user_name: inv.invited_by?.user_name || null,
        user_email: inv.invited_by?.user_email || null
      },
      message: inv.message,
      status: inv.status,
      created_at: inv.createdAt
    }));

    res.status(200).json({
      success: true,
      user_code: user.user_code,
      count: invitationsData.length,
      data: invitationsData
    });

  } catch (error) {
    console.error('Error fetching user invitations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Accept an invitation and join the session
 * @route   POST /api/invitations/:invitation_id/accept
 * @access  Public (only invited user can accept)
 */
const acceptInvitation = async (req, res) => {
  try {
    const { invitation_id } = req.params;
    const { user_code } = req.body;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_code to verify identity'
      });
    }

    // Find invitation
    const invitation = await SessionInvitation.getInvitationById(invitation_id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Verify the user is the invited user
    if (invitation.invited_user_code !== user_code.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to accept this invitation'
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Invitation has already been ${invitation.status}`
      });
    }

    // Find the session
    const session = await Session.findById(invitation.session._id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session no longer exists'
      });
    }

    // Check if session is still active
    if (!session.is_active) {
      // Mark invitation as cancelled since session is inactive
      invitation.status = 'cancelled';
      invitation.responded_at = new Date();
      await invitation.save();

      return res.status(400).json({
        success: false,
        message: 'Session is no longer active. Invitation has been cancelled.'
      });
    }

    // Find the invited user
    const invitedUser = await User.findById(invitation.invited_user._id);
    if (!invitedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update invitation status
    invitation.status = 'accepted';
    invitation.responded_at = new Date();
    await invitation.save();

    // Add user to session members (returns updated session)
    const updatedSession = await session.addMember(invitedUser);

    res.status(200).json({
      success: true,
      message: 'Invitation accepted successfully. You have been added to the session.',
      data: {
        invitation_id: invitation._id,
        session_code: updatedSession.session_code,
        session_name: updatedSession.session_name,
        user_code: invitedUser.user_code,
        user_name: invitedUser.user_name,
        joined_at: new Date(),
        member_count: updatedSession.members.filter(m => m.is_active).length
      }
    });

  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Decline an invitation
 * @route   POST /api/invitations/:invitation_id/decline
 * @access  Public (only invited user can decline)
 */
const declineInvitation = async (req, res) => {
  try {
    const { invitation_id } = req.params;
    const { user_code } = req.body;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_code to verify identity'
      });
    }

    // Find invitation
    const invitation = await SessionInvitation.getInvitationById(invitation_id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Verify the user is the invited user
    if (invitation.invited_user_code !== user_code.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to decline this invitation'
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Invitation has already been ${invitation.status}`
      });
    }

    // Update invitation status
    invitation.status = 'declined';
    invitation.responded_at = new Date();
    await invitation.save();

    res.status(200).json({
      success: true,
      message: 'Invitation declined successfully',
      data: {
        invitation_id: invitation._id,
        session_code: invitation.session_code,
        status: invitation.status,
        responded_at: invitation.responded_at
      }
    });

  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Cancel an invitation (by session creator)
 * @route   DELETE /api/invitations/:invitation_id
 * @access  Public (only session creator can cancel)
 */
const cancelInvitation = async (req, res) => {
  try {
    const { invitation_id } = req.params;
    const { user_code } = req.body;

    if (!user_code || user_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_code to verify identity'
      });
    }

    // Find invitation with populated fields
    const invitation = await SessionInvitation.getInvitationById(invitation_id);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }

    // Get the session to verify creator
    const session = await Session.findById(invitation.session._id)
      .populate('created_by', 'user_code');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Verify the user is the session creator
    if (session.created_by.user_code !== user_code.toUpperCase()) {
      return res.status(403).json({
        success: false,
        message: 'Only the session creator can cancel invitations'
      });
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel invitation that has already been ${invitation.status}`
      });
    }

    // Update invitation status
    invitation.status = 'cancelled';
    invitation.responded_at = new Date();
    await invitation.save();

    res.status(200).json({
      success: true,
      message: 'Invitation cancelled successfully',
      data: {
        invitation_id: invitation._id,
        session_code: invitation.session_code,
        invited_user_code: invitation.invited_user_code,
        status: invitation.status
      }
    });

  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * @desc    Get all invitations for a session
 * @route   GET /api/sessions/:session_code/invitations
 * @access  Public
 */
const getSessionInvitations = async (req, res) => {
  try {
    const { session_code } = req.params;
    const { status } = req.query;

    // Find session
    const session = await Session.findOne({ session_code });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Build query
    let query = { session_code };
    if (status && ['pending', 'accepted', 'declined', 'cancelled'].includes(status)) {
      query.status = status;
    }

    const invitations = await SessionInvitation.find(query)
      .populate('invited_by', 'user_name user_code')
      .populate('invited_user', 'user_name user_code user_email')
      .sort({ createdAt: -1 });

    const invitationsData = invitations.map(inv => ({
      invitation_id: inv._id,
      invited_user: {
        user_code: inv.invited_user.user_code,
        user_name: inv.invited_user.user_name,
        user_email: inv.invited_user.user_email
      },
      invited_by: {
        user_code: inv.invited_by.user_code,
        user_name: inv.invited_by.user_name
      },
      message: inv.message,
      status: inv.status,
      created_at: inv.createdAt,
      responded_at: inv.responded_at
    }));

    res.status(200).json({
      success: true,
      session_code,
      session_name: session.session_name,
      count: invitationsData.length,
      data: invitationsData
    });

  } catch (error) {
    console.error('Error fetching session invitations:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  sendInvitation,
  getUserPendingInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  getSessionInvitations
};

