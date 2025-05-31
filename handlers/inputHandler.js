// ========================================
// INPUT-HANDLER - handlers/inputHandler.js
// ========================================

const { db } = require('../database/database');
const { notifyUrSuperAdmins, getUsernameById } = require('../auth/permissions');
const config = require('../config/config');

// Eingabe verarbeiten
async function handleAwaitedInput(chatId, userId, text, username) {
  const inputData = global.botData.awaitingInput.get(userId);
  
  if (!inputData) {
    return;
  }
  
  // Lehrer-Registrierung
  if (inputData.type === 'teacher_registration') {
    await handleTeacherRegistrationInput(chatId, userId, text, username, inputData);
  }
  // Lehrer bearbeiten
  else if (inputData.type === 'edit_teacher' && inputData.step === 1) {
    await handleEditTeacherInput(chatId, userId, text, inputData);
  }
  // Post bearbeiten
  else if (inputData.type === 'edit_post') {
    await handleEditPostInput(chatId, userId, text, inputData);
  }
}

// Lehrer-Registrierung Eingabe
async function handleTeacherRegistrationInput(chatId, userId, text, username, inputData) {
  if (inputData.step === 1) {
    // Lehrer-ID validieren
    if (!config.VALIDATION.TEACHER_ID_PATTERN.test(text)) {
      await global.botData.bot.sendMessage(chatId, 
        `❌ **Ungültiges Format!**\n\n` +
        `📝 Verwende das Format: \`ID_XX\`\n\n` +
        `💡 **Beispiele:**\n` +
        `• ID_34\n` +
        `• ID_12\n` +
        `• ID_156\n\n` +
        `🔄 **Bitte erneut eingeben:**`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Prüfe ob Lehrer-ID bereits vergeben
    const existingTeacher = await db.getTeacher('teacher_id', text);
    
    if (existingTeacher) {
      await global.botData.bot.sendMessage(chatId, 
        `⚠️ **Lehrer-ID bereits vergeben!**\n\n` +
        `🆔 **ID ${text}** ist bereits registriert für:\n` +
        `👤 ${existingTeacher.name}\n\n` +
        `❓ **Ist das deine ID?**\n` +
        `Wende dich an die Admins für Hilfe.\n\n` +
        `🔄 **Andere ID eingeben:**`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    inputData.teacher_id = text;
    inputData.step = 2;
    global.botData.awaitingInput.set(userId, inputData);
    
    await global.botData.bot.sendMessage(chatId, 
      `✅ **Lehrer-ID akzeptiert: ${text}**\n\n` +
      `📝 **Schritt 2 von 2:**\n` +
      `Bitte gib deinen Namen ein.\n\n` +
      `💡 **Format:** Wie in WhatsApp\n` +
      `🌟 **Beispiele:**\n` +
      `• U. Abdurrahman\n` +
      `• Frau Schmidt\n` +
      `• Ahmed Mustafa\n\n` +
      `📋 Dieser Name wird in der Lehrer-Liste angezeigt.`,
      { parse_mode: 'Markdown' }
    );
  }
  else if (inputData.step === 2) {
    // Name validieren
    if (text.length < config.LIMITS.TEACHER_NAME_MIN_LENGTH || 
        text.length > config.LIMITS.TEACHER_NAME_MAX_LENGTH) {
      await global.botData.bot.sendMessage(chatId, 
        `❌ **Name ungültig!**\n\n` +
        `📏 **Anforderungen:**\n` +
        `• Mindestens ${config.LIMITS.TEACHER_NAME_MIN_LENGTH} Zeichen\n` +
        `• Maximal ${config.LIMITS.TEACHER_NAME_MAX_LENGTH} Zeichen\n` +
        `• Keine Sonderzeichen\n\n` +
        `🔄 **Bitte erneut eingeben:**`
      );
      return;
    }
    
    try {
      // In Datenbank speichern
      await db.addTeacher(userId, inputData.username, inputData.teacher_id, text);
      
      await global.botData.bot.sendMessage(chatId, 
        `🎉 **REGISTRIERUNG ERFOLGREICH!**\n\n` +
        `✅ **Deine Daten:**\n` +
        `👤 **Name:** ${text}\n` +
        `🆔 **Lehrer-ID:** ${inputData.teacher_id}\n` +
        `🔗 **Username:** ${inputData.username ? '@' + inputData.username : 'Nicht gesetzt'}\n` +
        `📅 **Registriert:** ${new Date().toLocaleDateString('de-DE')}\n\n` +
        `📬 **Ab sofort erhältst du alle wichtigen Nachrichten!**\n\n` +
        `📞 **Bei Fragen:** Wende dich an die Admins.`,
        { parse_mode: 'Markdown' }
      );
      
      global.botData.awaitingInput.delete(userId);
      
      // Ur-Super-Admins benachrichtigen
      await notifyUrSuperAdmins(userId, 'Neue Lehrer-Registrierung', 
        `🎓 **Neuer Lehrer registriert:**\n` +
        `👤 ${text}\n` +
        `🆔 Lehrer-ID: ${inputData.teacher_id}\n` +
        `🔗 @${inputData.username || 'Kein Username'}\n` +
        `📱 User-ID: ${userId}`
      );
      
    } catch (error) {
      console.error('Registrierungsfehler:', error);
      await global.botData.bot.sendMessage(chatId, 
        '❌ **Registrierung fehlgeschlagen!**\n\n' +
        'Es gab einen technischen Fehler.\n' +
        'Bitte versuche es später erneut oder wende dich an die Admins.'
      );
      global.botData.awaitingInput.delete(userId);
    }
  }
}

// Lehrer bearbeiten Eingabe
async function handleEditTeacherInput(chatId, userId, text, inputData) {
  const parts = text.split('|');
  if (parts.length !== 2) {
    await global.botData.bot.sendMessage(chatId, 
      `❌ **Ungültiges Format!**\n\n` +
      `📝 **Korrekt:** \`Neuer Name | @neuerusername\`\n\n` +
      `💡 **Beispiel:**\n` +
      `\`Ahmed Mustafa | @ahmed_m\`\n\n` +
      `🔄 **Bitte erneut eingeben:**`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const newName = parts[0].trim();
  const newUsername = parts[1].trim().replace('@', '');
  
  if (newName.length < config.LIMITS.TEACHER_NAME_MIN_LENGTH || 
      newName.length > config.LIMITS.TEACHER_NAME_MAX_LENGTH) {
    await global.botData.bot.sendMessage(chatId, 
      `❌ **Name ungültig!** (${config.LIMITS.TEACHER_NAME_MIN_LENGTH}-${config.LIMITS.TEACHER_NAME_MAX_LENGTH} Zeichen)\n\n🔄 Bitte erneut eingeben:`
    );
    return;
  }
  
  try {
    await db.updateTeacher(inputData.teacher_id, newName, newUsername);
    
    await global.botData.bot.sendMessage(chatId, 
      `✅ **Lehrer erfolgreich aktualisiert!**\n\n` +
      `🆔 **Lehrer-ID:** ${inputData.teacher_id}\n` +
      `👤 **Neuer Name:** ${newName}\n` +
      `🔗 **Neuer Username:** @${newUsername}\n` +
      `📅 **Aktualisiert:** ${new Date().toLocaleString('de-DE')}\n\n` +
      `🎉 Änderungen sind sofort aktiv!`,
      { parse_mode: 'Markdown' }
    );
    
    global.botData.awaitingInput.delete(userId);
    
    // Ur-Super-Admins benachrichtigen
    await notifyUrSuperAdmins(userId, 'Lehrer-Daten aktualisiert', 
      `✏️ **Lehrer bearbeitet:**\n` +
      `🆔 ID: ${inputData.teacher_id}\n` +
      `👤 Neuer Name: ${newName}\n` +
      `🔗 Neuer Username: @${newUsername}\n` +
      `📝 Von: ${(await getUsernameById(userId)) || userId}`
    );
    
  } catch (error) {
    console.error('Fehler beim Aktualisieren:', error);
    await global.botData.bot.sendMessage(chatId, '❌ Fehler beim Aktualisieren des Lehrers.');
    global.botData.awaitingInput.delete(userId);
  }
}

// Post bearbeiten Eingabe
async function handleEditPostInput(chatId, userId, text, inputData) {
  const newMessage = text.trim();
  
  if (!newMessage) {
    await global.botData.bot.sendMessage(chatId, '❌ Leere Nachricht nicht erlaubt.\n🔄 Bitte Text eingeben:');
    return;
  }
  
  // Aktualisierte Vorschau
  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Jetzt senden', callback_data: `send_${userId}` },
      { text: '✏️ Nochmals bearbeiten', callback_data: `edit_${userId}` },
      { text: '❌ Abbrechen', callback_data: `cancel_${userId}` }
    ]]
  };
  
  global.botData.pendingPosts.set(userId, { 
    message: newMessage, 
    username: inputData.originalPost.username,
    originalText: `/post ${newMessage}`,
    timestamp: Date.now()
  });
  
  await global.botData.bot.editMessageText(
    `📋 **AKTUALISIERTE VORSCHAU:**\n\n` +
    `📤 **Wird gesendet an:** 🎓 Lehrerinfos 📍\n` +
    `👤 **Von:** ${inputData.originalPost.username || 'Unbekannt'}\n` +
    `📝 **Neuer Inhalt:**\n\n` +
    `${newMessage}\n\n` +
    `🤔 **Nachricht senden?**`,
    {
      chat_id: chatId,
      message_id: inputData.messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
  
  global.botData.awaitingInput.delete(userId);
}

module.exports = {
  handleAwaitedInput
};