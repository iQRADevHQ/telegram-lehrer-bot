// ========================================
// BERECHTIGUNGS-MODUL - auth/permissions.js
// ========================================

const config = require('../config/config');

// Berechtigungen prüfen
async function checkPermissions(userId) {
  const userIdStr = userId.toString();
  
  // Ur-Super-Admin (fest im Code)
  if (config.UR_SUPER_ADMINS.includes(userIdStr)) {
    return config.PERMISSIONS.UR_SUPER_ADMIN;
  }
  
  try {
    // Super-Admin prüfen
    const superAdmin = await global.botData.db.get(
      'SELECT * FROM super_admins WHERE user_id = ?', 
      [userIdStr]
    );
    if (superAdmin) return config.PERMISSIONS.SUPER_ADMIN;
    
    // Admin prüfen
    const admin = await global.botData.db.get(
      'SELECT * FROM admins WHERE user_id = ?', 
      [userIdStr]
    );
    if (admin) return config.PERMISSIONS.ADMIN;
    
  } catch (error) {
    console.error('Fehler bei Berechtigungsprüfung:', error);
  }
  
  return config.PERMISSIONS.NONE;
}

// Prüfen ob User Full-Admin ist
function isFullAdmin(permission) {
  return [
    config.PERMISSIONS.UR_SUPER_ADMIN, 
    config.PERMISSIONS.SUPER_ADMIN
  ].includes(permission);
}

// Prüfen ob User mindestens Admin ist
function isAdmin(permission) {
  return [
    config.PERMISSIONS.UR_SUPER_ADMIN,
    config.PERMISSIONS.SUPER_ADMIN,
    config.PERMISSIONS.ADMIN
  ].includes(permission);
}

// User-Informationen abrufen und validieren
async function getUserInfo(userInput) {
  let userInfo = {
    userId: null,
    username: null,
    isValid: false,
    error: null
  };

  try {
    if (userInput.startsWith('@')) {
      // Username eingegeben
      userInfo.username = userInput.slice(1);
      
      // Versuche User-ID über Chat-Member zu finden (falls in Channel)
      try {
        const chatMember = await global.botData.bot.getChatMember(
          config.CHANNEL_ID, 
          '@' + userInfo.username
        );
        userInfo.userId = chatMember.user.id.toString();
        userInfo.isValid = true;
      } catch (e) {
        userInfo.error = 'Username nicht im Kanal gefunden. Bitte User-ID verwenden.';
      }
    } else if (config.VALIDATION.USER_ID_PATTERN.test(userInput)) {
      // User-ID eingegeben
      userInfo.userId = userInput;
      
      // Versuche Username zu finden
      try {
        const chatMember = await global.botData.bot.getChatMember(
          config.CHANNEL_ID, 
          userInput
        );
        userInfo.username = chatMember.user.username || null;
        userInfo.isValid = true;
      } catch (e) {
        userInfo.error = 'User-ID nicht im Kanal gefunden. Trotzdem hinzufügen?';
        userInfo.isValid = true; // Trotzdem erlauben
      }
    } else {
      userInfo.error = 'Ungültiges Format. Verwende @username oder 123456789';
    }
  } catch (error) {
    userInfo.error = 'Fehler beim Validieren des Users.';
  }

  return userInfo;
}

// Username per User-ID abrufen
async function getUsernameById(userId) {
  try {
    const user = await global.botData.bot.getChat(userId);
    return user.username;
  } catch (e) {
    return null;
  }
}

// Ur-Super-Admins benachrichtigen
async function notifyUrSuperAdmins(fromUserId, subject, message) {
  for (const adminId of config.UR_SUPER_ADMINS) {
    if (adminId !== fromUserId.toString()) {
      try {
        await global.botData.bot.sendMessage(adminId, 
          `🔔 **${subject}**\n\n` +
          `${message}\n\n` +
          `🕐 ${new Date().toLocaleString('de-DE')}`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.log(`Konnte Admin ${adminId} nicht benachrichtigen:`, e.message);
      }
    }
  }
}

module.exports = {
  checkPermissions,
  isFullAdmin,
  isAdmin,
  getUserInfo,
  getUsernameById,
  notifyUrSuperAdmins
};