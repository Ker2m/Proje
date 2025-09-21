const { pool } = require('../config/database');

class User {
  // Kullanıcı oluşturma
  static async create(userData) {
    const { email, password, first_name, last_name, birth_date, gender } = userData;
    
    const query = `
      INSERT INTO users (email, password, first_name, last_name, birth_date, gender, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, email, first_name, last_name, birth_date, gender, created_at
    `;
    
    const values = [email, password, first_name, last_name, birth_date, gender];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Email ile kullanıcı bulma
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    
    try {
      const result = await pool.query(query, [email]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // ID ile kullanıcı bulma
  static async findById(id) {
    const query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.birth_date, u.gender, 
        u.profile_picture, u.is_active, u.email_verified, u.last_password_change, 
        u.created_at, u.updated_at, u.settings, u.privacy,
        u.location_latitude, u.location_longitude, u.location_accuracy, 
        u.location_is_sharing, u.location_last_updated,
        up.bio, up.location_name, up.age_range_min, up.age_range_max, up.interests
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Kullanıcı güncelleme
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Güncellenecek alanları hazırla
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('Güncellenecek alan bulunamadı');
    }

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, birth_date, gender, profile_picture, updated_at
    `;
    
    values.push(id);

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Kullanıcı silme (soft delete)
  static async delete(id) {
    const query = `
      UPDATE users 
      SET deleted_at = NOW(), is_active = false
      WHERE id = $1
      RETURNING id, email, first_name, last_name
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Tüm aktif kullanıcıları listele
  static async findAll(limit = 50, offset = 0) {
    const query = `
      SELECT id, email, first_name, last_name, birth_date, gender, created_at
      FROM users 
      WHERE is_active = true AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    try {
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Kullanıcı ayarlarını güncelle
  static async updateSettings(id, settingsData) {
    const query = `
      UPDATE users 
      SET settings = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, first_name, last_name, settings, updated_at
    `;
    
    try {
      const result = await pool.query(query, [JSON.stringify(settingsData), id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Konum güncelle
  static async updateLocation(id, locationData) {
    const { latitude, longitude, accuracy, isSharing } = locationData;
    
    const query = `
      UPDATE users 
      SET 
        location_latitude = $1,
        location_longitude = $2,
        location_accuracy = $3,
        location_is_sharing = $4,
        location_last_updated = NOW(),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [latitude, longitude, accuracy, isSharing, id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Gizlilik ayarlarını güncelle
  static async updatePrivacy(id, privacyData) {
    const query = `
      UPDATE users 
      SET privacy = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [JSON.stringify(privacyData), id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Konum paylaşımını durdur
  static async stopLocationSharing(id) {
    const query = `
      UPDATE users 
      SET 
        location_is_sharing = false,
        location_last_updated = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Konum paylaşımı açık olan kullanıcıları getir
  static async findUsersWithLocationSharing(sinceDate = null) {
    let query = `
      SELECT 
        id, first_name, last_name, profile_picture,
        location_latitude, location_longitude, location_accuracy, location_last_updated
      FROM users 
      WHERE location_is_sharing = true 
        AND location_latitude IS NOT NULL 
        AND location_longitude IS NOT NULL
        AND is_active = true
    `;
    
    const params = [];
    
    if (sinceDate) {
      query += ` AND location_last_updated > $1`;
      params.push(sinceDate);
    }
    
    query += ` ORDER BY location_last_updated DESC LIMIT 100`;
    
    console.log('📍 User.findUsersWithLocationSharing query:', query);
    console.log('📍 User.findUsersWithLocationSharing params:', params);
    
    try {
      const result = await pool.query(query, params);
      console.log(`📍 User.findUsersWithLocationSharing found ${result.rows.length} users`);
      return result.rows;
    } catch (error) {
      console.error('📍 User.findUsersWithLocationSharing error:', error);
      throw error;
    }
  }
}

module.exports = User;
