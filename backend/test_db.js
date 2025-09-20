const { pool } = require('./config/database');

async function updateUser() {
  try {
    const result = await pool.query('UPDATE users SET email_verified = true WHERE email = $1', ['zeynep57sena@gmail.com']);
    console.log('Updated rows:', result.rowCount);
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

updateUser();
