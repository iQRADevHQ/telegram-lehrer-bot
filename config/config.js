// ========================================
// KONFIGURATION - config/config.js
// ========================================

module.exports = {
  // Bot-Konfiguration
  BOT_TOKEN: '8020040792:AAFQjrtrXpxqcfn_lfHd22DGvAgauVjP57E',
  CHANNEL_ID: '-1002540350107',
  BOT_USERNAME: 'iQRALehrerpost_bot',
  
  // Ur-Super-Admins (fest im Code, nicht löschbar)
  UR_SUPER_ADMINS: ['5079710300', '600764777'],
  
  // Datenbank-Konfiguration
  DATABASE: {
    filename: './bot_database.db',
    options: {
      verbose: false
    }
  },
  
  // Berechtigungsebenen
  PERMISSIONS: {
    UR_SUPER_ADMIN: 'ur-super-admin',
    SUPER_ADMIN: 'super-admin',
    ADMIN: 'admin',
    NONE: 'none'
  },
  
  // Nachrichten-Limits
  LIMITS: {
    MESSAGE_PREVIEW_LENGTH: 200,
    SEARCH_RESULTS_LIMIT: 10,
    RECENT_MESSAGES_LIMIT: 5,
    TEACHER_NAME_MIN_LENGTH: 2,
    TEACHER_NAME_MAX_LENGTH: 50
  },
  
  // Validierungsregeln
  VALIDATION: {
    TEACHER_ID_PATTERN: /^ID_\d+$/,
    USER_ID_PATTERN: /^\d+$/
  }
};