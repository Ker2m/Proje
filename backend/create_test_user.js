const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function createTestUser() {
  try {
    const email = 'test@example.com';
    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const result = await pool.query(
      'INSERT INTO users (email, password, first_name, last_name, email_verified) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO UPDATE SET password = $2, email_verified = $5',
      [email, hashedPassword, 'Test', 'User', true]
    );
    
    console.log('Test user created/updated');
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

createTestUser();
