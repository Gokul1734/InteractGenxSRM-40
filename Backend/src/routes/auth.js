const express = require('express');
const router = express.Router();

// Placeholder auth routes
// TODO: Implement authentication routes

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Auth service running' });
});

module.exports = router;

