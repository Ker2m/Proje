const { pool } = require('./config/database');

async function checkCurrentLocations() {
  try {
    console.log('📍 Checking current user locations...');
    
    // Tüm aktif kullanıcıların konumlarını al
    const result = await pool.query(
      `SELECT id, email, first_name, last_name,
              location_latitude, location_longitude, 
              location_accuracy, location_last_updated
       FROM users 
       WHERE location_is_sharing = true 
         AND location_latitude IS NOT NULL 
         AND location_longitude IS NOT NULL
       ORDER BY location_last_updated DESC`
    );
    
    console.log(`\n📍 Found ${result.rows.length} users with active locations:`);
    
    result.rows.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Konum: ${user.location_latitude}, ${user.location_longitude}`);
      console.log(`   Doğruluk: ${user.location_accuracy}m`);
      console.log(`   Son güncelleme: ${user.location_last_updated}`);
      
      // Koordinat farklarını hesapla
      if (index > 0) {
        const prevUser = result.rows[index - 1];
        const latDiff = Math.abs(parseFloat(user.location_latitude) - parseFloat(prevUser.location_latitude));
        const lngDiff = Math.abs(parseFloat(user.location_longitude) - parseFloat(prevUser.location_longitude));
        
        console.log(`   ${prevUser.first_name} ile fark:`);
        console.log(`     Enlem farkı: ${latDiff.toFixed(8)}°`);
        console.log(`     Boylam farkı: ${lngDiff.toFixed(8)}°`);
        
        // Basit mesafe hesaplama
        const latMeters = latDiff * 111000;
        const lngMeters = lngDiff * 111000 * Math.cos(parseFloat(user.location_latitude) * Math.PI / 180);
        const distance = Math.sqrt(latMeters * latMeters + lngMeters * lngMeters);
        
        console.log(`     Yaklaşık mesafe: ${Math.round(distance)}m`);
      }
    });
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    await pool.end();
  }
}

checkCurrentLocations();
