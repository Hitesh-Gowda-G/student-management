const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../utils/historyLogger');

// 1. Get all students with search, filters, pagination
const getStudents = async (req, res) => {
  try {
    const { search, department, semester, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let queryText = 'SELECT * FROM students WHERE 1=1';
    const queryParams = [];
    let paramCounter = 1;

    // Search filter
    if (search) {
      queryText += ` AND (name ILIKE $${paramCounter} OR usn ILIKE $${paramCounter} OR email ILIKE $${paramCounter})`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }

    // Department filter
    if (department && department !== 'All') {
      queryText += ` AND department = $${paramCounter}`;
      queryParams.push(department);
      paramCounter++;
    }

    // Semester filter
    if (semester && semester !== 'All') {
      queryText += ` AND semester = $${paramCounter}`;
      queryParams.push(parseInt(semester));
      paramCounter++;
    }

    // Clone query to count total records before pagination limits
    const countQueryText = queryText.replace('SELECT * FROM students', 'SELECT COUNT(*) FROM students');
    const countResult = await db.query(countQueryText, queryParams);
    const totalRecords = parseInt(countResult.rows[0].count);

    // Apply pagination
    queryText += ` ORDER BY id DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
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
    console.error('Error fetching students:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving students list.' });
  }
};

// 2. Get single student by ID
const getStudentById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT * FROM students WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching student by id:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving student details.' });
  }
};

// 3. Add student (creates student + login user)
const addStudent = async (req, res) => {
  const { name, usn, department, semester, email, phone } = req.body;

  if (!name || !usn || !department || !semester || !email || !phone) {
    return res.status(400).json({ success: false, message: 'All student fields are required.' });
  }

  // Use a database transaction
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Check unique constraints (USN, Email)
    const existingCheck = await client.query(
      'SELECT usn, email FROM students WHERE usn = $1 OR email = $2',
      [usn.toUpperCase(), email.toLowerCase()]
    );

    if (existingCheck.rows.length > 0) {
      const match = existingCheck.rows[0];
      if (match.usn === usn.toUpperCase()) {
        return res.status(400).json({ success: false, message: `USN '${usn}' is already registered.` });
      }
      return res.status(400).json({ success: false, message: `Email '${email}' is already registered.` });
    }

    // Insert student
    const studentResult = await client.query(
      `INSERT INTO students (name, usn, department, semester, email, phone) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, usn.toUpperCase(), department, parseInt(semester), email.toLowerCase(), phone]
    );

    const newStudent = studentResult.rows[0];

    // Create login account automatically. Default password is USN in uppercase
    const defaultPassword = usn.toUpperCase();
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await client.query(
      'INSERT INTO users (email, password, role, student_id) VALUES ($1, $2, $3, $4)',
      [email.toLowerCase(), hashedPassword, 'student', newStudent.id]
    );

    await client.query('COMMIT');

    // Log Activity (outside transaction to avoid failure propagation)
    await logActivity(
      newStudent.name,
      'Student Added',
      null,
      newStudent
    );

    return res.status(201).json({
      success: true,
      message: 'Student added and login account created successfully.',
      data: newStudent
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding student:', error);
    return res.status(500).json({ success: false, message: 'Server error creating student record.' });
  } finally {
    client.release();
  }
};

// 4. Update student
const updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, usn, department, semester, email, phone } = req.body;

  if (!name || !usn || !department || !semester || !email || !phone) {
    return res.status(400).json({ success: false, message: 'All student fields are required.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch existing student details first for log comparisons
    const currentResult = await client.query('SELECT * FROM students WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const previousStudent = currentResult.rows[0];

    // Check unique constraints (USN, Email) for OTHER records
    const uniqueCheck = await client.query(
      'SELECT id, usn, email FROM students WHERE (usn = $1 OR email = $2) AND id <> $3',
      [usn.toUpperCase(), email.toLowerCase(), id]
    );

    if (uniqueCheck.rows.length > 0) {
      const match = uniqueCheck.rows[0];
      if (match.usn === usn.toUpperCase()) {
        return res.status(400).json({ success: false, message: `USN '${usn}' is already in use by another student.` });
      }
      return res.status(400).json({ success: false, message: `Email '${email}' is already in use by another student.` });
    }

    // Update student details
    const updateResult = await client.query(
      `UPDATE students 
       SET name = $1, usn = $2, department = $3, semester = $4, email = $5, phone = $6 
       WHERE id = $7 RETURNING *`,
      [name, usn.toUpperCase(), department, parseInt(semester), email.toLowerCase(), phone, id]
    );

    const updatedStudent = updateResult.rows[0];

    // Synchronize User table email address
    await client.query(
      'UPDATE users SET email = $1 WHERE student_id = $2',
      [email.toLowerCase(), id]
    );

    await client.query('COMMIT');

    // Log Activity
    await logActivity(
      updatedStudent.name,
      'Student Modified',
      previousStudent,
      updatedStudent
    );

    return res.status(200).json({
      success: true,
      message: 'Student record updated successfully.',
      data: updatedStudent
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating student:', error);
    return res.status(500).json({ success: false, message: 'Server error updating student details.' });
  } finally {
    client.release();
  }
};

// 5. Delete student
const deleteStudent = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch details for logging
    const studentResult = await db.query('SELECT * FROM students WHERE id = $1', [id]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const studentToDelete = studentResult.rows[0];

    // Delete student. The DB will Cascade-delete the corresponding 'users' login and 'registrations'!
    await db.query('DELETE FROM students WHERE id = $1', [id]);

    // Log Activity
    await logActivity(
      studentToDelete.name,
      'Student Deleted',
      studentToDelete,
      null
    );

    return res.status(200).json({
      success: true,
      message: `Student '${studentToDelete.name}' and all linked registrations & login accounts have been deleted.`
    });

  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting student record.' });
  }
};

module.exports = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  deleteStudent
};
