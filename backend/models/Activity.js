const { pool } = require('../config/database');

class Activity {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.type = data.type;
    this.title = data.title;
    this.description = data.description;
    this.metadata = data.metadata ? JSON.parse(data.metadata) : {};
    this.created_at = data.created_at;
  }

  // Yeni aktivite oluştur
  static async create(userId, type, title, description, metadata = {}) {
    try {
      const client = await pool.connect();
      
      const query = `
        INSERT INTO activities (user_id, type, title, description, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      
      const result = await client.query(query, [
        userId,
        type,
        title,
        description,
        JSON.stringify(metadata)
      ]);
      
      client.release();
      
      console.log('Activity created with ID:', result.rows[0].id);
      
      return new Activity(result.rows[0]);
      
    } catch (error) {
      console.error('Error creating activity:', error);
      throw error;
    }
  }

  // ID ile aktivite getir
  static async getById(id) {
    try {
      const client = await pool.connect();
      
      const query = 'SELECT * FROM activities WHERE id = $1';
      const result = await client.query(query, [id]);
      
      client.release();
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Activity(result.rows[0]);
      
    } catch (error) {
      console.error('Error getting activity by ID:', error);
      throw error;
    }
  }

  // Kullanıcının aktivitelerini getir
  static async getByUserId(userId, limit = 10, offset = 0) {
    try {
      const client = await pool.connect();
      
      const query = `
        SELECT * FROM activities 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await client.query(query, [userId, limit, offset]);
      client.release();
      
      return result.rows.map(row => new Activity(row));
      
    } catch (error) {
      console.error('Error getting activities by user ID:', error);
      throw error;
    }
  }

  // Tüm aktiviteleri getir (genel feed için)
  static async getAll(limit = 20, offset = 0) {
    try {
      const client = await pool.connect();
      
      const query = `
        SELECT a.*, u.first_name, u.last_name, u.profile_picture
        FROM activities a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      
      const result = await client.query(query, [limit, offset]);
      client.release();
      
      return result.rows.map(row => ({
        ...new Activity(row),
        user_name: `${row.first_name} ${row.last_name}`,
        profile_picture: row.profile_picture
      }));
      
    } catch (error) {
      console.error('Error getting all activities:', error);
      throw error;
    }
  }

  // Aktivite sil
  static async delete(id) {
    try {
      const client = await pool.connect();
      
      const query = 'DELETE FROM activities WHERE id = $1';
      const result = await client.query(query, [id]);
      
      client.release();
      
      return result.rowCount > 0;
      
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  }

  // Kullanıcının aktivite sayısını getir
  static async getCountByUserId(userId) {
    try {
      const client = await pool.connect();
      
      const query = 'SELECT COUNT(*) as count FROM activities WHERE user_id = $1';
      const result = await client.query(query, [userId]);
      
      client.release();
      
      return parseInt(result.rows[0].count);
      
    } catch (error) {
      console.error('Error getting activity count:', error);
      throw error;
    }
  }
}

module.exports = Activity;
