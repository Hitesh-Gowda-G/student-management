const db = require('../config/db');

/**
 * Standardizes activity logging for the History module.
 * @param {string} studentName - The name of the student involved, or 'System'/'Admin' if it's a global action.
 * @param {string} actionType - The specific action type (e.g. 'Student Added', 'Subject Modified').
 * @param {object|null} previousValue - Object representation of data before modification/deletion.
 * @param {object|null} newValue - Object representation of data after insertion/modification.
 */
async function logActivity(studentName, actionType, previousValue, newValue) {
  try {
    const prevStr = previousValue ? JSON.stringify(previousValue) : null;
    const newStr = newValue ? JSON.stringify(newValue) : null;
    
    await db.query(
      `INSERT INTO history (student_name, action_type, previous_value, new_value) 
       VALUES ($1, $2, $3, $4)`,
      [studentName || 'System', actionType, prevStr, newStr]
    );
  } catch (error) {
    console.error('Error logging activity to history table:', error);
  }
}

module.exports = { logActivity };
