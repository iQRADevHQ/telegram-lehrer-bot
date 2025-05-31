// ========================================
// NACHRICHTEN-HANDLER - handlers/messageHandler.js
// ========================================

const { checkPermissions, notifyUrSuperAdmins } = require('../auth/permissions');
const commandHandler = require('./commandHandler');
const inputHandler = require('./inputHandler');
const registrationHandler = require('./registrationHandler');
const config = require('../config/config');

// Hauptnachrichten-Handler
async function messageHandler(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const username = msg.from.username || '';
  
  console.log(`📨 Nachricht von ${username} (${userId}): ${text}`);
  
  try {
    // Deep Link Registrierung
    if (text.startsWith('/start register')) {
      await registrationHandler.handleRegistrationStart(chatId, userId, username);
      return;
    }

    // Normale /start Nachricht
    if (text === '/start') {
      const permission = await checkPermissions(userId);
      if (permission !== config.PERMISSIONS.NONE) {
        await sendWelcomeMessage(chatId, permission);
      } else {
        await handleUnauthorizedUser(chatId, userId, username, text);
      }
      return;
    }
    
    // Eingabe-Status prüfen (User wartet auf Eingabe)
    if (global.botData.awaitingInput.has(userId)) {
      await inputHandler.handleAwaitedInput(chatId, userId, text, username);
      return;
    }
    
    // Berechtigungen prüfen
    const permission = await checkPermissions(userId);
    
    if (permission === config.PERMISSIONS.NONE) {
      await handleUnauthorizedUser(chatId, userId, username, text);
      return;
    }
    
    // Commands verarbeiten
    await commandHandler.handleCommand(chatId, userId, text, permission, username);
    
  } catch (error) {
    console.error('Fehler in message handler:', error);
    await global.botData.bot.sendMessage(chatId, '❌ Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
  }
}

// Unberechtigte User behandeln
async function handleUnauthorizedUser(chatId, userId, username, text) {
  await global.botData.bot.sendMessage(chatId, 
    `🚫 **Keine Berechtigung!**\n\n` +
    `📝 Deine User-ID: \`${userId}\`\n` +
    `👤 Username: ${username ? '@' + username : 'Nicht gesetzt'}\n\n` +
    `📞 Leite diese Informationen an einen Admin weiter.`,
    { parse_mode: 'Markdown' }
  );
  
  // Ur-Super-Admins benachrichtigen
  await notifyUrSuperAdmins(userId, 'Unbekannter User kontaktiert Bot',
    `👤 ${username ? '@' + username : 'Kein Username'}\n` +
    `🆔 User-ID: ${userId}\n` +
    `💬 Nachricht: "${text}"\n\n` +
    `Hinzufügen mit: \`/addadmin ${userId}\` oder \`/addsuperadmin ${userId}\``
  );
}

// Willkommensnachricht
async function sendWelcomeMessage(chatId, permission) {
  const permissions = {
    [config.PERMISSIONS.UR_SUPER_ADMIN]: 'Ur-Super-Administrator',
    [config.PERMISSIONS.SUPER_ADMIN]: 'Super-Administrator', 
    [config.PERMISSIONS.ADMIN]: 'Administrator'
  };

  await global.botData.bot.sendMessage(chatId,
    `🎉 **Willkommen zurück!**\n\n` +
    `🔐 Berechtigung: ${permissions[permission]}\n\n` +
    `📋 Nutze \`/help\` für alle verfügbaren Befehle.\n\n` +
    `🚀 **Schnellzugriff:**\n` +
    `• \`/post [Text]\` - Nachricht senden\n` +
    `• \`/stats\` - Statistiken anzeigen\n` +
    `• \`/teachers\` - Lehrer verwalten`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = messageHandler;