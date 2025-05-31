// ========================================
// DATENBANK-MODUL - database/database.js
// ========================================

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const config = require('../config/config');

// Datenbank initialisieren
async function initializeDatabase() {
  try {
    const db = await open({
      filename: config.DATABASE.filename,
      driver: sqlite3.Database
    });
    
    console.log('📂 SQLite Datenbank verbunden');
    await createAllTables(db);
    console.log('✅ Datenbank erfolgreich initialisiert');
    return db;
  } catch (error) {
    console.error('❌ Datenbank Fehler:', error);
    throw error;
  }
}

// Alle Tabellen erstellen
async function createAllTables(db) {
  // TG Admin Tabelle
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT,
      name TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      added_by TEXT
    )
  `);

  // TG Superadmin Tabelle  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT,
      name TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      added_by TEXT
    )
  `);

  // TG Lehrer-Liste
  await db.exec(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      username TEXT,
      teacher_id TEXT UNIQUE,
      name TEXT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TG Sendelog
  await db.exec(`
    CREATE TABLE IF NOT EXISTS message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      message_id TEXT,
      message_text TEXT,
      sent_by TEXT,
      sent_by_user_id TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TG Lehrerbestätigungen  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      message_id TEXT,
      user_id TEXT,
      name TEXT,
      teacher_id TEXT,
      read_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Channel Members Cache
  await db.exec(`
    CREATE TABLE IF NOT EXISTS channel_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      status TEXT,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_registered BOOLEAN DEFAULT 0
    )
  `);

  console.log('✅ Alle Tabellen erstellt/geprüft');
}

// Datenbankoperationen
const db = {
  // Admin-Operationen
  async addAdmin(userInfo, addedBy, type = 'admin') {
    const table = type === 'admin' ? 'admins' : 'super_admins';
    return await global.botData.db.run(
      `INSERT INTO ${table} (user_id, username, added_by) VALUES (?, ?, ?)`,
      [userInfo.userId || 'unknown', userInfo.username || null, addedBy]
    );
  },

  async getAdmin(userId, type = 'admin') {
    const table = type === 'admin' ? 'admins' : 'super_admins';
    return await global.botData.db.get(
      `SELECT * FROM ${table} WHERE user_id = ?`,
      [userId]
    );
  },

  async deleteAdmin(recordId, type = 'admin') {
    const table = type === 'admin' ? 'admins' : 'super_admins';
    return await global.botData.db.run(
      `DELETE FROM ${table} WHERE id = ?`,
      [recordId]
    );
  },

  async listAdmins(type = 'admin') {
    const table = type === 'admin' ? 'admins' : 'super_admins';
    return await global.botData.db.all(
      `SELECT * FROM ${table} ORDER BY added_at DESC`
    );
  },

  // Lehrer-Operationen
  async addTeacher(userId, username, teacherId, name) {
    return await global.botData.db.run(
      'INSERT INTO teachers (user_id, username, teacher_id, name) VALUES (?, ?, ?, ?)',
      [userId.toString(), username, teacherId, name]
    );
  },

  async getTeacher(field, value) {
    return await global.botData.db.get(
      `SELECT * FROM teachers WHERE ${field} = ?`,
      [value]
    );
  },

  async updateTeacher(teacherId, name, username) {
    return await global.botData.db.run(
      'UPDATE teachers SET name = ?, username = ? WHERE teacher_id = ?',
      [name, username, teacherId]
    );
  },

  async listTeachers() {
    return await global.botData.db.all(
      'SELECT * FROM teachers ORDER BY registered_at DESC'
    );
  },

  async searchTeachers(searchTerm) {
    return await global.botData.db.all(
      `SELECT * FROM teachers WHERE 
       name LIKE ? OR 
       teacher_id LIKE ? OR 
       username LIKE ? 
       ORDER BY registered_at DESC`,
      [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm.replace('@', '')}%`]
    );
  },

  // Nachrichten-Operationen
  async logMessage(messageId, messageText, sentBy, sentByUserId) {
    return await global.botData.db.run(
      `INSERT INTO message_log (date, message_id, message_text, sent_by, sent_by_user_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        new Date().toLocaleDateString('de-DE'),
        messageId,
        messageText.substring(0, config.LIMITS.MESSAGE_PREVIEW_LENGTH),
        sentBy,
        sentByUserId.toString()
      ]
    );
  },

  async getRecentMessages(limit = 5) {
    return await global.botData.db.all(
      'SELECT * FROM message_log ORDER BY sent_at DESC LIMIT ?',
      [limit]
    );
  },

  async searchMessages(searchTerm, limit = 10) {
    return await global.botData.db.all(
      'SELECT * FROM message_log WHERE message_text LIKE ? ORDER BY sent_at DESC LIMIT ?',
      [`%${searchTerm}%`, limit]
    );
  },

  // Statistiken
  async getStats() {
    const adminCount = await global.botData.db.get('SELECT COUNT(*) as count FROM admins');
    const superAdminCount = await global.botData.db.get('SELECT COUNT(*) as count FROM super_admins');
    const teacherCount = await global.botData.db.get('SELECT COUNT(*) as count FROM teachers');
    const messageCount = await global.botData.db.get('SELECT COUNT(*) as count FROM message_log');
    
    return {
      admins: adminCount.count,
      superAdmins: superAdminCount.count,
      teachers: teacherCount.count,
      messages: messageCount.count
    };
  }
};

module.exports = {
  initializeDatabase,
  createAllTables,
  db
};