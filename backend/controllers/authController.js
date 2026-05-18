const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password.' });
  }

  try {
    // 1. Fetch user by email
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // 3. If student, fetch student name and details
    let name = 'Administrator';
    let usn = null;
    if (user.role === 'student' && user.student_id) {
      const studentResult = await db.query('SELECT name, usn FROM students WHERE id = $1', [user.student_id]);
      if (studentResult.rows.length > 0) {
        name = studentResult.rows[0].name;
        usn = studentResult.rows[0].usn;
      }
    }

    // 4. Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        name: name
      },
      process.env.JWT_SECRET || 'subject_reg_secret_998877',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        name,
        usn
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email.' });
  }

  try {
    // Check if user exists
    const userCheck = await db.query('SELECT email FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No user registered with this email.' });
    }

    // In a real system, you'd send a reset email. Here we mock success.
    return res.status(200).json({
      success: true,
      message: `Password reset link successfully sent to ${email}. Please check your inbox.`
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Server error during forgot password.' });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await db.query('SELECT id, email, role, student_id FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = userResult.rows[0];
    
    if (user.role === 'student' && user.student_id) {
      const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [user.student_id]);
      if (studentResult.rows.length > 0) {
        return res.status(200).json({
          success: true,
          user: {
            ...user,
            studentDetails: studentResult.rows[0]
          }
        });
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        studentDetails: null
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching user profile.' });
  }
};

module.exports = {
  login,
  forgotPassword,
  getMe
};
