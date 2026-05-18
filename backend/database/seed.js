const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  console.log('Starting database seeding...');

  try {
    // 1. Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating database tables...');
    await db.query(schemaSql);
    console.log('Tables created successfully.');

    // 2. Check if admin already exists
    const adminCheck = await db.query('SELECT * FROM users WHERE email = $1', ['admin@ssit.edu']);
    
    if (adminCheck.rows.length === 0) {
      console.log('Creating default admin...');
      const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
      await db.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
        ['admin@ssit.edu', adminPasswordHash, 'admin']
      );
      console.log('Admin user created: admin@ssit.edu / Admin@123');
    } else {
      console.log('Admin user already exists.');
    }

    // 3. Create default student record if it doesn't exist
    const studentCheck = await db.query('SELECT * FROM students WHERE usn = $1', ['1SI22CS001']);
    let studentId;

    if (studentCheck.rows.length === 0) {
      console.log('Creating default student record...');
      const studentResult = await db.query(
        `INSERT INTO students (name, usn, department, semester, email, phone) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        ['Jane Doe', '1SI22CS001', 'Computer Science', 6, 'student@ssit.edu', '9876543210']
      );
      studentId = studentResult.rows[0].id;
      console.log('Student record created (Jane Doe).');
    } else {
      studentId = studentCheck.rows[0].id;
      console.log('Student record already exists.');
    }

    // 4. Create student user account if it doesn't exist
    const studentUserCheck = await db.query('SELECT * FROM users WHERE email = $1', ['student@ssit.edu']);
    if (studentUserCheck.rows.length === 0) {
      console.log('Creating default student login account...');
      const studentPasswordHash = await bcrypt.hash('Student@123', 10);
      await db.query(
        'INSERT INTO users (email, password, role, student_id) VALUES ($1, $2, $3, $4)',
        ['student@ssit.edu', studentPasswordHash, 'student', studentId]
      );
      console.log('Student user login created: student@ssit.edu / Student@123');
    } else {
      console.log('Student user login already exists.');
    }

    // 5. Create default subjects if none exist
    const subjectsCount = await db.query('SELECT COUNT(*) FROM subjects');
    if (parseInt(subjectsCount.rows[0].count) === 0) {
      console.log('Seeding default subjects...');
      const defaultSubjects = [
        ['CS601', 'Software Engineering', 4],
        ['CS602', 'Database Management Systems', 4],
        ['CS603', 'Computer Networks', 3],
        ['CS604', 'Web Technologies', 3],
        ['CS605', 'Artificial Intelligence', 3],
        ['CS606', 'Cryptography & Network Security', 4],
        ['CS607', 'Mobile Application Development', 3]
      ];

      for (const sub of defaultSubjects) {
        await db.query(
          'INSERT INTO subjects (code, name, credits) VALUES ($1, $2, $3)',
          sub
        );
      }
      console.log('Subjects seeded successfully.');
    } else {
      console.log('Subjects catalog is already populated.');
    }

    // 6. Log activity in history
    const historyCheck = await db.query('SELECT COUNT(*) FROM history');
    if (parseInt(historyCheck.rows[0].count) === 0) {
      await db.query(
        `INSERT INTO history (student_name, action_type, previous_value, new_value) 
         VALUES ($1, $2, $3, $4)`,
        ['Jane Doe', 'Student Added', null, JSON.stringify({ name: 'Jane Doe', usn: '1SI22CS001', department: 'Computer Science', semester: 6 })]
      );
      await db.query(
        `INSERT INTO history (student_name, action_type, previous_value, new_value) 
         VALUES ($1, $2, $3, $4)`,
        ['System', 'Subject Added', null, JSON.stringify({ code: 'CS602', name: 'Database Management Systems', credits: 4 })]
      );
      console.log('Initial history seeded.');
    }

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
