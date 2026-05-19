const db = require('../config/db');
const { logActivity } = require('../utils/historyLogger');

// Helper: Fetch student name by ID
async function getStudentName(studentId) {
  const result = await db.query('SELECT name FROM students WHERE id = $1', [studentId]);
  return result.rows.length > 0 ? result.rows[0].name : 'Unknown Student';
}

// 1. Display selected subjects list for a student
const getRegistrationsByStudent = async (req, res) => {
  const { studentId } = req.params;

  try {
    const result = await db.query(
      `SELECT r.id AS registration_id, s.id AS subject_id, s.code, s.name, s.credits, r.registration_date 
       FROM registrations r 
       JOIN subjects s ON r.subject_id = s.id 
       WHERE r.student_id = $1 
       ORDER BY s.code ASC`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching student registrations:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving registrations list.' });
  }
};

// 2. Register subjects (Student selects subjects)
const registerSubjects = async (req, res) => {
  const { studentId, subjectIds } = req.body; // subjectIds is an array

  if (!studentId || !subjectIds || !Array.isArray(subjectIds) || subjectIds.length === 0) {
    return res.status(400).json({ success: false, message: 'Student ID and an array of Subject IDs are required.' });
  }

  const client = await db.pool.connect();
  const studentName = await getStudentName(studentId);

  try {
    await client.query('BEGIN');

    // Fetch student's current semester
    const studentResult = await client.query('SELECT semester FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const studentSemester = studentResult.rows[0].semester;

    // Check if any selected subject does not belong to the student's semester
    const subjectsResCheck = await client.query('SELECT id, semester, name, code FROM subjects WHERE id = ANY($1)', [subjectIds]);
    const invalidSubjects = subjectsResCheck.rows.filter(s => s.semester !== studentSemester);
    if (invalidSubjects.length > 0) {
      const invalidNames = invalidSubjects.map(s => `${s.name} (${s.code})`).join(', ');
      return res.status(400).json({
        success: false,
        message: `Registration rejected: The following subjects are not for Semester ${studentSemester}: ${invalidNames}`
      });
    }

    // Check if adding these subjects exceeds 23 credits
    const existingResult = await client.query(
      'SELECT subject_id FROM registrations WHERE student_id = $1',
      [studentId]
    );
    const existingSubjectIds = existingResult.rows.map(row => row.subject_id);

    // Sum existing credits
    let existingCredits = 0;
    if (existingSubjectIds.length > 0) {
      const existingSubjects = await client.query('SELECT credits FROM subjects WHERE id = ANY($1)', [existingSubjectIds]);
      existingCredits = existingSubjects.rows.reduce((sum, r) => sum + r.credits, 0);
    }

    // Sum new credits
    const newSubjectsQuery = await client.query('SELECT credits FROM subjects WHERE id = ANY($1)', [subjectIds]);
    const newCredits = newSubjectsQuery.rows.reduce((sum, r) => sum + r.credits, 0);

    if (existingCredits + newCredits > 23) {
      return res.status(400).json({
        success: false,
        message: `Registration rejected: Adding these subjects would bring total credits to ${existingCredits + newCredits}, which exceeds the 23-credit limit.`
      });
    }

    // Fetch existing registrations to prevent duplicate registration
    const existingResultCheck = await client.query(
      'SELECT subject_id FROM registrations WHERE student_id = $1',
      [studentId]
    );
    const existingSubjectIdsCheck = existingResultCheck.rows.map(row => row.subject_id);

    const duplicates = subjectIds.filter(id => existingSubjectIdsCheck.includes(id));
    if (duplicates.length > 0) {
      // Fetch duplicate details for error message
      const dupSubjects = await client.query('SELECT code, name FROM subjects WHERE id = ANY($1)', [duplicates]);
      const dupNames = dupSubjects.rows.map(s => `${s.name} (${s.code})`).join(', ');
      return res.status(400).json({
        success: false,
        message: `Duplicate Registration Prevented: You are already registered for: ${dupNames}`
      });
    }

    // Insert new registrations
    const registered = [];
    for (const subjectId of subjectIds) {
      const insertResult = await client.query(
        'INSERT INTO registrations (student_id, subject_id) VALUES ($1, $2) RETURNING *',
        [studentId, subjectId]
      );
      
      // Fetch details of subject for logs
      const subDetails = await client.query('SELECT code, name, credits FROM subjects WHERE id = $1', [subjectId]);
      registered.push(subDetails.rows[0]);
    }

    await client.query('COMMIT');

    // Log Activity
    await logActivity(
      studentName,
      'Subject Registration Added',
      null,
      { registeredCount: registered.length, subjects: registered }
    );

    return res.status(201).json({
      success: true,
      message: 'Subjects registered successfully.',
      data: registered
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registering subjects:', error);
    return res.status(500).json({ success: false, message: 'Server error during subject registration.' });
  } finally {
    client.release();
  }
};

// 3. Modify selected subjects (Replace existing list with new selected list)
const modifyRegistrations = async (req, res) => {
  const { studentId, subjectIds } = req.body; // New list of all selected subject IDs

  if (!studentId || !Array.isArray(subjectIds)) {
    return res.status(400).json({ success: false, message: 'Student ID and a list of Subject IDs are required.' });
  }

  const client = await db.pool.connect();
  const studentName = await getStudentName(studentId);

  try {
    await client.query('BEGIN');

    // Fetch student's current semester
    const studentResult = await client.query('SELECT semester FROM students WHERE id = $1', [studentId]);
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const studentSemester = studentResult.rows[0].semester;

    // Check if any selected subject does not belong to the student's semester
    if (subjectIds.length > 0) {
      const subjectsResCheck = await client.query('SELECT id, semester, name, code FROM subjects WHERE id = ANY($1)', [subjectIds]);
      const invalidSubjects = subjectsResCheck.rows.filter(s => s.semester !== studentSemester);
      if (invalidSubjects.length > 0) {
        const invalidNames = invalidSubjects.map(s => `${s.name} (${s.code})`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Registration rejected: The following subjects are not for Semester ${studentSemester}: ${invalidNames}`
        });
      }
    }

    // Fetch credits for all incoming subjectIds to verify the exactly 23 credit limit
    let totalCredits = 0;
    if (subjectIds.length > 0) {
      const subjectsRes = await client.query('SELECT id, credits, name, code FROM subjects WHERE id = ANY($1)', [subjectIds]);
      totalCredits = subjectsRes.rows.reduce((sum, row) => sum + row.credits, 0);
    }

    if (totalCredits !== 23) {
      return res.status(400).json({
        success: false,
        message: `Registration rejected: Total credits must be exactly 23. You have selected ${totalCredits} credits.`
      });
    }

    // A. Fetch current registrations for before-and-after log
    const prevResult = await client.query(
      `SELECT s.id, s.code, s.name, s.credits 
       FROM registrations r 
       JOIN subjects s ON r.subject_id = s.id 
       WHERE r.student_id = $1`,
      [studentId]
    );
    const previousSubjects = prevResult.rows;

    // B. Wipe old registrations
    await client.query('DELETE FROM registrations WHERE student_id = $1', [studentId]);

    // C. Insert new registrations
    const newSubjects = [];
    if (subjectIds.length > 0) {
      for (const subId of subjectIds) {
        await client.query(
          'INSERT INTO registrations (student_id, subject_id) VALUES ($1, $2)',
          [studentId, subId]
        );
        const subDetails = await client.query('SELECT id, code, name, credits FROM subjects WHERE id = $1', [subId]);
        if (subDetails.rows.length > 0) {
          newSubjects.push(subDetails.rows[0]);
        }
      }
    }

    await client.query('COMMIT');

    // Log Activity
    await logActivity(
      studentName,
      'Subject Registration Modified',
      { registeredCount: previousSubjects.length, subjects: previousSubjects },
      { registeredCount: newSubjects.length, subjects: newSubjects }
    );

    return res.status(200).json({
      success: true,
      message: 'Subject registrations modified successfully.',
      data: newSubjects
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error modifying registrations:', error);
    return res.status(500).json({ success: false, message: 'Server error modifying subject registrations.' });
  } finally {
    client.release();
  }
};

// 4. Delete registered subjects (Remove a single registered subject)
const deleteRegistration = async (req, res) => {
  const { studentId, subjectId } = req.params;

  const studentName = await getStudentName(studentId);

  try {
    // A. Fetch details first for log
    const subjectResult = await db.query('SELECT code, name, credits FROM subjects WHERE id = $1', [subjectId]);
    if (subjectResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    const subjectDetails = subjectResult.rows[0];

    // B. Verify if the registration exists
    const regCheck = await db.query(
      'SELECT id FROM registrations WHERE student_id = $1 AND subject_id = $2',
      [studentId, subjectId]
    );

    if (regCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No registration found for this subject and student.' });
    }

    // C. Delete registration
    await db.query(
      'DELETE FROM registrations WHERE student_id = $1 AND subject_id = $2',
      [studentId, subjectId]
    );

    // Log Activity
    await logActivity(
      studentName,
      'Subject Registration Deleted',
      subjectDetails,
      null
    );

    return res.status(200).json({
      success: true,
      message: `Successfully unregistered from subject: ${subjectDetails.name} (${subjectDetails.code})`
    });

  } catch (error) {
    console.error('Error deleting registration:', error);
    return res.status(500).json({ success: false, message: 'Server error removing subject registration.' });
  }
};

module.exports = {
  getRegistrationsByStudent,
  registerSubjects,
  modifyRegistrations,
  deleteRegistration
};
