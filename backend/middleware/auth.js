const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'subject_reg_secret_998877');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
  }
  next();
};

const isStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Access denied. Students only.' });
  }
  next();
};

// Check if user is either admin OR the student himself accessing his own resource
const isSelfOrAdmin = (req, res, next) => {
  const studentIdParam = parseInt(req.params.studentId || req.params.id);
  if (req.user.role === 'admin') {
    return next();
  }
  if (req.user.role === 'student' && req.user.student_id === studentIdParam) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Unauthorized resource access.' });
};

module.exports = {
  verifyToken,
  isAdmin,
  isStudent,
  isSelfOrAdmin
};
