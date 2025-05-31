// ========================================
// REGISTRIERUNGS-HANDLER - handlers/registrationHandler.js
// ========================================

const { db } = require('../database/database');

// Registrierung starten
async function handleRegistrationStart(chatId, userId, username) {
  // Prüfe ob bereits registriert
  const existingTeacher = await db.getTeacher('user_id', userId.toString());
  
  if (existingTeacher) {
    await global.botData.bot.sendMessage(chatId, 
      `✅ **Bereits registriert!**\n\n` +
      `👤 **Name:** ${existingTeacher.name}\n` +
      `🆔 **Lehrer-ID:** ${existingTeacher.teacher_id}\n` +
      `📅 **Seit:** ${new Date(existingTeacher.registered_at).toLocaleDateString('de-DE')}\n\n` +
      `🎉 Du erhältst bereits alle wichtigen Nachrichten!\n\n` +
      `💬 Bei Änderungen wende dich an die Admins.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  await global.botData.bot.sendMessage(chatId, 
    `🎓 **WILLKOMMEN ZUR LEHRER-REGISTRIERUNG!**\n\n` +
    `📝 **Schritt 1 von 2:**\n` +
    `Bitte gib deine Lehrer-ID ein.\n\n` +
    `💡 **Format:** \`ID_XX\` (z.B. ID_34, ID_12)\n\n` +
    `❓ **Lehrer-ID nicht bekannt?**\n` +
    `Wende dich an die Schulleitung oder Admins.\n\n` +
    `❌ **Abbrechen:** Einfach eine andere Nachricht senden.`,
    { parse_mode: 'Markdown' }
  );
  
  global.botData.awaitingInput.set(userId, { 
    type: 'teacher_registration', 
    step: 1, 
    username: username 
  });
}

module.exports = {
  handleRegistrationStart
};