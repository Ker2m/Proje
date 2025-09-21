const { pool } = require('./config/database');

async function checkUserLocation() {
  try {
    console.log('🔍 Checking user location data...');
    
    // Zeynep kullanıcısını bul
    const zeynepResult = await pool.query(
      'SELECT id, email, first_name, last_name, location_latitude, location_longitude, location_is_sharing, location_last_updated FROM users WHERE email = $1',
      ['zeynep57sena@gmail.com']
    );
    
    if (zeynepResult.rows.length === 0) {
      console.log('❌ Zeynep kullanıcısı bulunamadı');
      return;
    }
    
    const zeynep = zeynepResult.rows[0];
    console.log('👤 Zeynep kullanıcısı:');
    console.log(`   ID: ${zeynep.id}`);
    console.log(`   Email: ${zeynep.email}`);
    console.log(`   Name: ${zeynep.first_name} ${zeynep.last_name}`);
    console.log(`   Location: ${zeynep.location_latitude}, ${zeynep.location_longitude}`);
    console.log(`   Sharing: ${zeynep.location_is_sharing}`);
    console.log(`   Last Updated: ${zeynep.location_last_updated}`);
    
    // Tüm konum paylaşımı açık kullanıcıları listele
    const allUsersResult = await pool.query(
      `SELECT id, email, first_name, last_name, 
              location_latitude, location_longitude, 
              location_is_sharing, location_last_updated
       FROM users 
       WHERE location_is_sharing = true 
         AND location_latitude IS NOT NULL 
         AND location_longitude IS NOT NULL
       ORDER BY location_last_updated DESC`
    );
    
    console.log(`\n👥 Toplam ${allUsersResult.rows.length} kullanıcı konum paylaşımı açık:`);
    allUsersResult.rows.forEach(user => {
      console.log(`   ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`   Konum: ${user.location_latitude}, ${user.location_longitude}`);
      console.log(`   Son güncelleme: ${user.location_last_updated}`);
      console.log('   ---');
    });
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
  }
}

checkUserLocation();
