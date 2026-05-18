const express = require('express');
const router = express.Router();
const { getHistoryLogs } = require('../controllers/historyController');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, getHistoryLogs);

module.exports = router;
