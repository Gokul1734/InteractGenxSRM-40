const express = require('express');
const router = express.Router();

const {
  listTeamPages,
  createTeamPage,
  updateTeamPage,
  deleteTeamPage,
  appendTeamPage,
  listPrivatePages,
  createPrivatePage,
  updatePrivatePage,
  deletePrivatePage,
  appendPrivatePage,
} = require('../controllers/pagesController');

// Team pages
router.get('/team', listTeamPages);
router.post('/team', createTeamPage);
router.put('/team/:id', updateTeamPage);
router.delete('/team/:id', deleteTeamPage);
router.post('/team/:id/append', appendTeamPage);

// Private pages (scoped to user_code; connects to Users collection)
router.get('/private/:user_code', listPrivatePages);
router.post('/private/:user_code', createPrivatePage);
router.put('/private/:user_code/:id', updatePrivatePage);
router.delete('/private/:user_code/:id', deletePrivatePage);
router.post('/private/:user_code/:id/append', appendPrivatePage);

module.exports = router;


