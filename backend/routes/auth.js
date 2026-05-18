const express = require('express');
const router = express.Router();
const { login, forgotPassword, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

// Protected routes
router.get('/me', verifyToken, getMe);

module.exports = router;
