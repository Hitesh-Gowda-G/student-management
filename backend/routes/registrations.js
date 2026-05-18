const express = require('express');
const router = express.Router();
const {
  getRegistrationsByStudent,
  registerSubjects,
  modifyRegistrations,
  deleteRegistration
} = require('../controllers/registrationController');
const { verifyToken, isSelfOrAdmin } = require('../middleware/auth');

// All routes require token verification
router.use(verifyToken);

// Custom authorization check for body payload
const validateStudentAccess = (req, res, next) => {
  const studentId = parseInt(req.body.studentId);
  if (!studentId) {
    return res.status(400).json({ success: false, message: 'Student ID is required in the body.' });
  }

  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role === 'student' && req.user.student_id === studentId) {
    return next();
  }

  return res.status(403).json({ success: false, message: 'Access denied. Unauthorized resource access.' });
};

// Endpoints
router.get('/student/:studentId', isSelfOrAdmin, getRegistrationsByStudent);
router.post('/', validateStudentAccess, registerSubjects);
router.put('/', validateStudentAccess, modifyRegistrations);
router.delete('/student/:studentId/subject/:subjectId', isSelfOrAdmin, deleteRegistration);

module.exports = router;
