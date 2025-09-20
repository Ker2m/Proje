const { pool } = require('./config/database');

async function verifyUser() {
  try {
    await pool.query('UPDATE users SET email_verified = true WHERE email = $1', ['test@example.com']);
    console.log('User verified successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyUser();
