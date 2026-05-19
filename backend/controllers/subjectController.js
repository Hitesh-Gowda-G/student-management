const db = require('../config/db');
const { logActivity } = require('../utils/historyLogger');

// 1. Get all subjects with search & pagination
const getSubjects = async (req, res) => {
  try {
    const { search, semester, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let queryText = 'SELECT * FROM subjects WHERE 1=1';
    const queryParams = [];
    let paramCounter = 1;

    // Filter by semester dynamically based on student role or search criteria
    if (req.user && req.user.role === 'student') {
      const studentId = req.user.student_id;
      if (studentId) {
        const studentResult = await db.query('SELECT semester FROM students WHERE id = $1', [studentId]);
        if (studentResult.rows.length > 0) {
          const studentSem = studentResult.rows[0].semester;
          queryText += ` AND semester = $${paramCounter}`;
          queryParams.push(studentSem);
          paramCounter++;
        }
      }
    } else if (semester) {
      queryText += ` AND semester = $${paramCounter}`;
      queryParams.push(parseInt(semester));
      paramCounter++;
    }

    // Search filter
    if (search) {
      queryText += ` AND (code ILIKE $${paramCounter} OR name ILIKE $${paramCounter})`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }

    // Count total records
    const countQueryText = queryText.replace('SELECT * FROM subjects', 'SELECT COUNT(*) FROM subjects');
    const countResult = await db.query(countQueryText, queryParams);
    const totalRecords = parseInt(countResult.rows[0].count);

    // Apply pagination
    queryText += ` ORDER BY code ASC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await db.query(queryText, queryParams);

    return res.status(200).json({
      success: true,
      data: result.rows,
      pagination: {
        total: totalRecords,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalRecords / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving subjects catalog.' });
  }
};

// 2. Get single subject by ID
const getSubjectById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM subjects WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching subject by id:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving subject details.' });
  }
};

// 3. Add subject (Admin Only)
const addSubject = async (req, res) => {
  const { code, name, credits, semester } = req.body;

  if (!code || !name || !credits || !semester) {
    return res.status(400).json({ success: false, message: 'Code, Name, Credits, and Semester are required.' });
  }

  try {
    // Check if code already exists
    const codeCheck = await db.query('SELECT code FROM subjects WHERE code = $1', [code.toUpperCase()]);
    if (codeCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Subject with code '${code.toUpperCase()}' already exists.` });
    }

    const result = await db.query(
      'INSERT INTO subjects (code, name, credits, semester) VALUES ($1, $2, $3, $4) RETURNING *',
      [code.toUpperCase(), name, parseInt(credits), parseInt(semester)]
    );

    const newSubject = result.rows[0];

    // Log Activity
    await logActivity(
      'System',
      'Subject Added',
      null,
      newSubject
    );

    return res.status(201).json({
      success: true,
      message: 'Subject added to catalog successfully.',
      data: newSubject
    });

  } catch (error) {
    console.error('Error adding subject:', error);
    return res.status(500).json({ success: false, message: 'Server error creating subject record.' });
  }
};

// 4. Update subject (Admin Only)
const updateSubject = async (req, res) => {
  const { id } = req.params;
  const { code, name, credits, semester } = req.body;

  if (!code || !name || !credits || !semester) {
    return res.status(400).json({ success: false, message: 'Code, Name, Credits, and Semester are required.' });
  }

  try {
    // Fetch current details first for log comparisons
    const currentResult = await db.query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    const previousSubject = currentResult.rows[0];

    // Check unique code constraint on OTHER subjects
    const uniqueCheck = await db.query(
      'SELECT id, code FROM subjects WHERE code = $1 AND id <> $2',
      [code.toUpperCase(), id]
    );

    if (uniqueCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: `Subject code '${code.toUpperCase()}' is already in use by another subject.` });
    }

    const updateResult = await db.query(
      'UPDATE subjects SET code = $1, name = $2, credits = $3, semester = $4 WHERE id = $5 RETURNING *',
      [code.toUpperCase(), name, parseInt(credits), parseInt(semester), id]
    );

    const updatedSubject = updateResult.rows[0];

    // Log Activity
    await logActivity(
      'System',
      'Subject Modified',
      previousSubject,
      updatedSubject
    );

    return res.status(200).json({
      success: true,
      message: 'Subject details updated successfully.',
      data: updatedSubject
    });

  } catch (error) {
    console.error('Error updating subject:', error);
    return res.status(500).json({ success: false, message: 'Server error updating subject details.' });
  }
};

// 5. Delete subject (Admin Only)
const deleteSubject = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch subject for logging
    const subjectResult = await db.query('SELECT * FROM subjects WHERE id = $1', [id]);
    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    const subjectToDelete = subjectResult.rows[0];

    // Delete subject from DB. Relational cascading deletes registrations automatically!
    await db.query('DELETE FROM subjects WHERE id = $1', [id]);

    // Log Activity
    await logActivity(
      'System',
      'Subject Deleted',
      subjectToDelete,
      null
    );

    return res.status(200).json({
      success: true,
      message: `Subject '${subjectToDelete.name}' (${subjectToDelete.code}) has been deleted successfully.`
    });

  } catch (error) {
    console.error('Error deleting subject:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting subject.' });
  }
};

module.exports = {
  getSubjects,
  getSubjectById,
  addSubject,
  updateSubject,
  deleteSubject
};
