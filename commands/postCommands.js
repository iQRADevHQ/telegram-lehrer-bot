// ========================================
// POST-COMMANDS - commands/postCommands.js
// ========================================

const { db } = require('../database/database');
const config = require('../config/config');

// Post mit Vorschau-System
async function handlePost(chatId, userId, text, username) {
  if (text === '/post' || text.split(' ').length < 2) {
    await global.botData.bot.sendMessage(chatId, 
      `📝 **Nachricht senden:**\n\n` +
      `Verwendung: \`/post [Deine Nachricht]\`\n\n` +
      `📋 **Beispiel:**\n` +
      `\`/post Wichtige Informationen für alle Lehrer!\``,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const message = text.slice(6).trim(); // "/post " entfernen
  if (!message) {
    await global.botData.bot.sendMessage(chatId, '❌ Leere Nachricht kann nicht gesendet werden.');
    return;
  }

  // Vorschau mit Bestätigung
  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Jetzt senden', callback_data: `send_${userId}` },
      { text: '✏️ Bearbeiten', callback_data: `edit_${userId}` },
      { text: '❌ Abbrechen', callback_data: `cancel_${userId}` }
    ]]
  };
  
  global.botData.pendingPosts.set(userId, { 
    message, 
    username,
    originalText: text,
    timestamp: Date.now()
  });
  
  await global.botData.bot.sendMessage(chatId, 
    `📋 **NACHRICHT-VORSCHAU:**\n\n` +
    `📤 **Wird gesendet an:** 🎓 Lehrerinfos 📍\n` +
    `👤 **Von:** ${username || 'Unbekannt'}\n` +
    `📝 **Inhalt:**\n\n` +
    `${message}\n\n` +
    `🤔 **Nachricht senden?**`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

// Send-Confirmation Funktion
async function handleSendConfirmation(chatId, messageId, userId, username) {
  const postData = global.botData.pendingPosts.get(userId);
  if (!postData) {
    await global.botData.bot.editMessageText('❌ Nachricht nicht mehr verfügbar.', {
      chat_id: chatId,
      message_id: messageId
    });
    return;
  }

  try {
    console.log(`🔄 Sende Nachricht an Kanal ${config.CHANNEL_ID}...`);
    console.log(`📝 Inhalt: "${postData.message}"`);
    console.log(`👤 Von: ${username} (${userId})`);
    
    // An Kanal senden
    const sentMessage = await global.botData.bot.sendMessage(config.CHANNEL_ID, postData.message);
    
    console.log(`✅ Erfolgreich gesendet! Message-ID: ${sentMessage.message_id}`);
    
    // In Datenbank loggen
    await db.logMessage(
      sentMessage.message_id,
      postData.message,
      postData.username || 'Unbekannt',
      userId
    );
    
    // Bestätigung anzeigen
    await global.botData.bot.editMessageText(
      `✅ **Nachricht erfolgreich gesendet!**\n\n` +
      `📬 **Message-ID:** ${sentMessage.message_id}\n` +
      `📅 **Zeit:** ${new Date().toLocaleString('de-DE')}\n` +
      `📊 **Kanal:** 🎓 Lehrerinfos 📍\n\n` +
      `🎯 Die Nachricht ist jetzt für alle Lehrer sichtbar.`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );
    
    global.botData.pendingPosts.delete(userId);
    
  } catch (error) {
    console.error('❌ Fehler beim Senden:', error);
    
    let errorMessage = '❌ **Fehler beim Senden!**\n\n';
    
    if (error.response?.body?.error_code === 403) {
      errorMessage += '🚫 Bot hat keine Berechtigung im Kanal.\n' +
                     'Füge den Bot als Admin zum Kanal hinzu.';
    } else if (error.response?.body?.error_code === 400) {
      errorMessage += '📝 Nachricht-Format ungültig.\n' +
                     'Überprüfe den Inhalt der Nachricht.';
    } else {
      errorMessage += `📋 Details: ${error.message}`;
    }
    
    await global.botData.bot.editMessageText(errorMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
  }
}

// Post bearbeiten
async function handleEditPost(chatId, messageId, userId) {
  const postData = global.botData.pendingPosts.get(userId);
  if (!postData) {
    await global.botData.bot.editMessageText('❌ Nachricht nicht mehr verfügbar.', {
      chat_id: chatId,
      message_id: messageId
    });
    return;
  }

  await global.botData.bot.editMessageText(
    `✏️ **Nachricht bearbeiten:**\n\n` +
    `📝 Sende den neuen Text für deine Nachricht.\n` +
    `(Verwende /cancel um abzubrechen)`,
    {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    }
  );

  global.botData.awaitingInput.set(userId, {
    type: 'edit_post',
    messageId: messageId,
    originalPost: postData
  });
}

// Post abbrechen
async function handleCancelPost(chatId, messageId, userId) {
  global.botData.pendingPosts.delete(userId);
  
  await global.botData.bot.editMessageText(
    '❌ **Nachricht abgebrochen.**\n\n' +
    '📝 Du kannst jederzeit eine neue