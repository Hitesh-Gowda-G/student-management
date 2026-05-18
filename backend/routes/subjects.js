const express = require('express');
const router = express.Router();
const {
  getSubjects,
  getSubjectById,
  addSubject,
  updateSubject,
  deleteSubject
} = require('../controllers/subjectController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Read endpoints (Admins & Students)
router.get('/', getSubjects);
router.get('/:id', getSubjectById);

// Mutation endpoints (Admin Only)
router.post('/', isAdmin, addSubject);
router.put('/:id', isAdmin, updateSubject);
router.delete('/:id', isAdmin, deleteSubject);

module.exports = router;
