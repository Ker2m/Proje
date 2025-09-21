const bcrypt = require('bcryptjs');
const { pool } = require('./config/database');

async function resetZeynepPassword() {
  try {
    console.log('🔐 Resetting Zeynep password...');
    
    const email = 'zeynep57sena@gmail.com';
    const newPassword = '123456'; // Yeni şifre
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );
    
    if (result.rowCount > 0) {
      console.log('✅ Zeynep password reset successful');
      console.log(`   Email: ${email}`);
      console.log(`   New Password: ${newPassword}`);
    } else {
      console.log('❌ Zeynep user not found');
    }
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
  }
}

resetZeynepPassword();
