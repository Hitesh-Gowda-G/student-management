const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/studentController');
const { verifyToken, isAdmin, isSelfOrAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Admin-only endpoints
router.get('/', isAdmin, getStudents);
router.post('/', isAdmin, addStudent);
router.put('/:id', isAdmin, updateStudent);
router.delete('/:id', isAdmin, deleteStudent);

// Student or Admin readable
router.get('/:id', isSelfOrAdmin, getStudentById);

module.exports = router;
