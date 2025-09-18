const { pool } = require('../config/database');

class User {
  // Kullanıcı oluşturma
  static async create(userData) {
    const { email, password, first_name, last_name, birth_date, gender, phone } = userData;
    
    const query = `
      INSERT INTO users (email, password, first_name, last_name, birth_date, gender, phone, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, email, first_name, last_name, birth_date, gender, phone, created_at
    `;
    
    const values = [email, password, first_name, last_name, birth_date, gender, phone];
    
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
    const query = 'SELECT id, email, first_name, last_name, birth_date, gender, phone, profile_picture, is_active, created_at FROM users WHERE id = $1';
    
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
      RETURNING id, email, first_name, last_name, birth_date, gender, phone, profile_picture, updated_at
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
      SELECT id, email, first_name, last_name, birth_date, gender, phone, created_at
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
}

module.exports = User;
