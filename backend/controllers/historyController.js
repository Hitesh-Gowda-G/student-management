const db = require('../config/db');

const getHistoryLogs = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, action_date, action_time, student_name, action_type, previous_value, new_value 
       FROM history 
       ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching history logs:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving history logs.' });
  }
};

module.exports = {
  getHistoryLogs
};
