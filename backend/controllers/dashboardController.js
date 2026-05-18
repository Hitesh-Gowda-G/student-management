const db = require('../config/db');

const getDashboardStats = async (req, res) => {
  try {
    // 1. Fetch count of total students
    const studentsResult = await db.query('SELECT COUNT(*) FROM students');
    const totalStudents = parseInt(studentsResult.rows[0].count);

    // 2. Fetch count of total subjects
    const subjectsResult = await db.query('SELECT COUNT(*) FROM subjects');
    const totalSubjects = parseInt(subjectsResult.rows[0].count);

    // 3. Fetch count of total registrations
    const registrationsResult = await db.query('SELECT COUNT(*) FROM registrations');
    const totalRegistrations = parseInt(registrationsResult.rows[0].count);

    // 4. Fetch 5 most recent activities
    const recentActivityResult = await db.query(
      `SELECT id, action_date, action_time, student_name, action_type, previous_value, new_value 
       FROM history 
       ORDER BY created_at DESC 
       LIMIT 5`
    );

    // If student, filter dashboard stats if necessary, but returning general school stats is fine.
    // For a highly professional student experience, if they are a student, we can also return their personal registered count!
    let personalRegisteredCount = 0;
    if (req.user.role === 'student' && req.user.student_id) {
      const personalRegResult = await db.query(
        'SELECT COUNT(*) FROM registrations WHERE student_id = $1',
        [req.user.student_id]
      );
      personalRegisteredCount = parseInt(personalRegResult.rows[0].count);
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalSubjects,
        totalRegistrations,
        personalRegisteredCount
      },
      recentActivity: recentActivityResult.rows
    });

  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving dashboard statistics.' });
  }
};

module.exports = {
  getDashboardStats
};
