const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');

// Konfiguration
const BOT_TOKEN = '8020040792:AAGKLU9yjuN8WngHIMnrwEdJqJB5sBn3ABI';
const SHEET_ID = '1_AJ4Pg-KsnRUggZYPPd1uMfYvENFmpAQX6uSm4Rc140';
const CHANNEL_ID = '-1002540350107';
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || `http://localhost:${PORT}`;

// Ur-Super-Admins (fest im Code)
const UR_SUPER_ADMINS = ['5079710300', '600764777'];

// Express App
const app = express();
app.use(express.json());

// Bot initialisieren
const bot = new TelegramBot(BOT_TOKEN);

// Google Sheets Setup
let doc;
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/spreadsheets']
});

// Bot-Status
let botData = {
  pendingPosts: new Map(),
  awaitingInput: new Map(),
  searchCache: new Map()
};

// Google Sheets initialisieren
async function initializeGoogleSheets() {
  try {
    doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    // Tabs erstellen falls sie nicht existieren
    await createRequiredSheets();
    console.log('✅ Google Sheets erfolgreich initialisiert');
  } catch (error) {
    console.error('❌ Fehler bei Google Sheets:', error);
  }
}

// Erforderliche Sheets erstellen
async function createRequiredSheets() {
  const requiredSheets = [
    { title: 'TG Admin', headers: ['User-ID', 'Username', 'Name', 'Hinzugefügt-am', 'Hinzugefügt-von'] },
    { title: 'TG Superadmin', headers: ['User-ID', 'Username', 'Name', 'Hinzugefügt-am', 'Hinzugefügt-von'] },
    { title: 'TG Lehrerbestätigungen', headers: ['Datum', 'Message-ID', 'User-ID', 'Name', 'Lehrer-ID', 'Gelesen-Zeit'] },
    { title: 'TG Sendelog', headers: ['Datum', 'Message-ID', 'Nachricht', 'Gesendet-von', 'User-ID'] },
    { title: 'TG Lehrer-Liste', headers: ['User-ID', 'Username', 'Lehrer-ID', 'Name', 'Registriert-am'] }
  ];

  for (const sheetConfig of requiredSheets) {
    try {
      let sheet = doc.sheetsByTitle[sheetConfig.title];
      if (!sheet) {
        sheet = await doc.addSheet({ title: sheetConfig.title });
        await sheet.setHeaderRow(sheetConfig.headers);
        console.log(`✅ Sheet "${sheetConfig.title}" erstellt`);
      }
    } catch (error) {
      console.log(`⚠️ Sheet "${sheetConfig.title}" bereits vorhanden oder Fehler:`, error.message);
    }
  }
}

// Berechtigungen prüfen
async function checkPermissions(userId) {
  const userIdStr = userId.toString();
  
  if (UR_SUPER_ADMINS.includes(userIdStr)) {
    return 'ur-super-admin';
  }
  
  try {
    // Super-Admin prüfen
    const superAdminSheet = doc.sheetsByTitle['TG Superadmin'];
    if (superAdminSheet) {
      const rows = await superAdminSheet.getRows();
      if (rows.some(row => row.get('User-ID') === userIdStr)) {
        return 'super-admin';
      }
    }
    
    // Admin prüfen
    const adminSheet = doc.sheetsByTitle['TG Admin'];
    if (adminSheet) {
      const rows = await adminSheet.getRows();
      if (rows.some(row => row.get('User-ID') === userIdStr)) {
        return 'admin';
      }
    }
  } catch (error) {
    console.error('Fehler bei Berechtigungsprüfung:', error);
  }
  
  return 'none';
}

// Webhook Endpoint
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook Fehler:', error);
    res.sendStatus(500);
  }
});

// Nachricht verarbeiten
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const username = msg.from.username || '';
  
  console.log(`📨 Nachricht von ${username} (${userId}): ${text}`);
  
  // Registrierung über Deep Link
  if (text.startsWith('/start register')) {
    await handleRegistrationStart(chatId, userId, username);
    return;
  }
  
  // Eingabe-Status prüfen
  if (botData.awaitingInput.has(userId)) {
    await handleAwaitedInput(chatId, userId, text);
    return;
  }
  
  // Berechtigungen prüfen
  const permission = await checkPermissions(userId);
  
  if (permission === 'none') {
    await bot.sendMessage(chatId, 
      `🚫 Keine Berechtigung!\n\n` +
      `📝 Deine User-ID: \`${userId}\`\n` +
      `Leite diese ID an einen Admin weiter.`, 
      { parse_mode: 'Markdown' }
    );
    
    // Ur-Super-Admins benachrichtigen
    for (const adminId of UR_SUPER_ADMINS) {
      try {
        await bot.sendMessage(adminId, 
          `🔔 Unbekannter User:\n` +
          `👤 ${username ? '@' + username : 'Kein Username'}\n` +
          `🆔 User-ID: ${userId}\n` +
          `💬 Nachricht: ${text}`
        );
      } catch (e) {
        console.log(`Konnte Admin ${adminId} nicht benachrichtigen`);
      }
    }
    return;
  }
  
  // Commands verarbeiten
  await handleCommand(chatId, userId, text, permission, username);
}

// Command-Handler
async function handleCommand(chatId, userId, text, permission, username) {
  const isFullAdmin = ['ur-super-admin', 'super-admin'].includes(permission);
  
  if (text === '/help') {
    await sendHelpMessage(chatId, permission);
  }
  else if (text === '/setup' && isFullAdmin) {
    await handleSetup(chatId);
  }
  else if (text.startsWith('/post ') || text === '/post') {
    await handlePost(chatId, userId, text, username);
  }
  else if (text === '/messages' && isFullAdmin) {
    await handleMessages(chatId);
  }
  else if (text.startsWith('/notread ') && isFullAdmin) {
    await handleNotRead(chatId, text);
  }
  else if (text.startsWith('/search ') && isFullAdmin) {
    await handleSearch(chatId, text);
  }
  else if (text === '/stats' && isFullAdmin) {
    await handleStats(chatId);
  }
  else if (text.startsWith('/addadmin ') && isFullAdmin) {
    await handleAddAdmin(chatId, userId, text, 'admin');
  }
  else if (text.startsWith('/deleteadmin ') && isFullAdmin) {
    await handleDeleteAdmin(chatId, userId, text, 'admin');
  }
  else if (text.startsWith('/addsuperadmin ') && isFullAdmin) {
    await handleAddAdmin(chatId, userId, text, 'super-admin');
  }
  else if (text.startsWith('/deletesuperadmin ') && isFullAdmin) {
    await handleDeleteAdmin(chatId, userId, text, 'super-admin');
  }
  else if (text === '/listadmins' && isFullAdmin) {
    await handleListAdmins(chatId, 'admin');
  }
  else if (text === '/listsuperadmins' && isFullAdmin) {
    await handleListAdmins(chatId, 'super-admin');
  }
  else if (text === '/teachers' && isFullAdmin) {
    await handleTeachers(chatId);
  }
  else if (text.startsWith('/editteacher ') && isFullAdmin) {
    await handleEditTeacher(chatId, userId, text);
  }
  else if (text.startsWith('/findteacher ') && isFullAdmin) {
    await handleFindTeacher(chatId, text);
  }
  else if (text === '/unregistered' && isFullAdmin) {
    await handleUnregistered(chatId);
  }
  else if (text === '/getlink' && isFullAdmin) {
    await bot.sendMessage(chatId, 
      `🔗 **Registrierungs-Link:**\n\n` +
      `https://t.me/iQRALehrerpost_bot?start=register\n\n` +
      `📋 Lehrer können sich damit selbst registrieren.`,
      { parse_mode: 'Markdown' }
    );
  }
  else {
    await bot.sendMessage(chatId, '❓ Unbekannter Befehl. Nutze /help für alle verfügbaren Befehle.');
  }
}

// Post-Handler
async function handlePost(chatId, userId, text, username) {
  if (text === '/post') {
    await bot.sendMessage(chatId, '📝 Bitte gib deine Nachricht ein:\n\n/post [Deine Nachricht]');
    return;
  }
  
  const message = text.slice(6); // "/post " entfernen
  if (!message.trim()) {
    await bot.sendMessage(chatId, '❌ Leere Nachricht kann nicht gesendet werden.');
    return;
  }
  
  // Vorschau mit Bestätigung
  const keyboard = {
    inline_keyboard: [[
      { text: '✅ Senden', callback_data: `send_${userId}` },
      { text: '❌ Abbrechen', callback_data: `cancel_${userId}` }
    ]]
  };
  
  botData.pendingPosts.set(userId, { message, username });
  
  await bot.sendMessage(chatId, 
    `📋 **VORSCHAU:**\n\n${message}\n\n🤔 Nachricht senden?`,
    { 
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
}

// Callback Query Handler
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  
  if (data.startsWith('send_')) {
    const targetUserId = data.split('_')[1];
    if (targetUserId == userId && botData.pendingPosts.has(userId)) {
      await sendPostToChannel(chatId, userId);
    }
  }
  else if (data.startsWith('cancel_')) {
    const targetUserId = data.split('_')[1];
    if (targetUserId == userId) {
      botData.pendingPosts.delete(userId);
      await bot.editMessageText('❌ Nachricht abgebrochen.', {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id
      });
    }
  }
  
  await bot.answerCallbackQuery(callbackQuery.id);
}

// Nachricht an Kanal senden
async function sendPostToChannel(chatId, userId) {
  try {
    const postData = botData.pendingPosts.get(userId);
    if (!postData) return;
    
    // An Kanal senden
    const sentMessage = await bot.sendMessage(CHANNEL_ID, postData.message);
    
    // In Google Sheets loggen
    await logToSheet('TG Sendelog', {
      'Datum': new Date().toLocaleString('de-DE'),
      'Message-ID': sentMessage.message_id,
      'Nachricht': postData.message.substring(0, 100) + (postData.message.length > 100 ? '...' : ''),
      'Gesendet-von': postData.username || 'Unbekannt',
      'User-ID': userId
    });
    
    await bot.sendMessage(chatId, '✅ Nachricht erfolgreich gesendet!');
    botData.pendingPosts.delete(userId);
    
  } catch (error) {
    console.error('Fehler beim Senden:', error);
    await bot.sendMessage(chatId, '❌ Fehler beim Senden der Nachricht.');
  }
}

// Daten in Sheet schreiben
async function logToSheet(sheetName, data) {
  try {
    const sheet = doc.sheetsByTitle[sheetName];
    if (sheet) {
      await sheet.addRow(data);
    }
  } catch (error) {
    console.error(`Fehler beim Schreiben in ${sheetName}:`, error);
  }
}

// Hilfe-Nachricht
async function sendHelpMessage(chatId, permission) {
  let helpText = '🤖 **VERFÜGBARE BEFEHLE:**\n\n';
  
  if (['ur-super-admin', 'super-admin'].includes(permission)) {
    helpText += `**📤 POSTING:**\n` +
      `/post [Text] - Nachricht senden\n` +
      `/messages - Letzte Nachrichten\n` +
      `/notread [Nr] - Wer hat nicht gelesen\n` +
      `/search [Wort] - Nachrichten suchen\n` +
      `/stats - Statistiken\n\n` +
      `**👥 USER-MANAGEMENT:**\n` +
      `/addadmin @user - Admin hinzufügen\n` +
      `/deleteadmin @user - Admin entfernen\n` +
      `/addsuperadmin @user - Super-Admin hinzufügen\n` +
      `/deletesuperadmin @user - Super-Admin entfernen\n` +
      `/listadmins - Alle Admins\n` +
      `/listsuperadmins - Alle Super-Admins\n\n` +
      `**🎓 LEHRER:**\n` +
      `/teachers - Alle Lehrer\n` +
      `/editteacher ID_XX - Lehrer bearbeiten\n` +
      `/findteacher [Name] - Lehrer suchen\n` +
      `/unregistered - Unregistrierte Mitglieder\n` +
      `/getlink - Registrierungs-Link\n\n` +
      `**⚙️ SYSTEM:**\n` +
      `/setup - Alle Tabs erstellen\n` +
      `/help - Diese Hilfe`;
  } else if (permission === 'admin') {
    helpText += `**📤 POSTING:**\n` +
      `/post [Text] - Nachricht senden\n\n` +
      `**ℹ️ INFO:**\n` +
      `/help - Diese Hilfe`;
  }
  
  await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

// Setup-Handler
async function handleSetup(chatId) {
  try {
    await createRequiredSheets();
    await bot.sendMessage(chatId, '✅ Setup abgeschlossen! Alle erforderlichen Sheets wurden erstellt.');
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Fehler beim Setup: ' + error.message);
  }
}

// Server starten
async function startServer() {
  try {
    // Google Sheets initialisieren
    await initializeGoogleSheets();
    
    // Webhook setzen
    await bot.setWebHook(`${WEBHOOK_URL}/webhook`);
    console.log(`✅ Webhook gesetzt: ${WEBHOOK_URL}/webhook`);
    
    // Server starten
    app.listen(PORT, () => {
      console.log(`🚀 Server läuft auf Port ${PORT}`);
      console.log(`🤖 Bot ist bereit!`);
    });
    
  } catch (error) {
    console.error('❌ Fehler beim Starten:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Server wird heruntergefahren...');
  await bot.deleteWebHook();
  process.exit(0);
});

// Server starten
startServer();
