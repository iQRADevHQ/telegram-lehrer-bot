// ========================================
// MAIN BOT FILE - bot.js
// ========================================

const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Module importieren
const config = require('./config/config');
const { initializeDatabase } = require('./database/database');
const { checkPermissions } = require('./auth/permissions');
const messageHandler = require('./handlers/messageHandler');
const callbackHandler = require('./handlers/callbackHandler');
const errorHandler = require('./utils/errorHandler');

// Bot initialisieren
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

// Globale Bot-Daten
global.botData = {
  pendingPosts: new Map(),
  awaitingInput: new Map(),
  deleteConfirmations: new Map(),
  channelMembers: new Set(),
  lastMemberUpdate: 0,
  db: null,
  bot: bot
};

// ========================================
// BOT STARTEN
// ========================================

async function startBot() {
  try {
    console.log('🚀 Modularer Telegram Lehrer-Bot wird gestartet...');
    console.log(`🤖 Bot-Username: @${config.BOT_USERNAME}`);
    console.log(`📬 Kanal-ID: ${config.CHANNEL_ID}`);
    
    // Datenbank initialisieren
    global.botData.db = await initializeDatabase();
    
    // Event-Handler registrieren
    bot.on('message', messageHandler);
    bot.on('callback_query', callbackHandler);
    bot.on('polling_error', errorHandler.handlePollingError);
    bot.on('error', errorHandler.handleBotError);
    
    console.log('✅ Bot erfolgreich gestartet!');
    console.log('📋 Verfügbare Befehle: /help');
    console.log(`🔗 Registrierungs-Link: https://t.me/${config.BOT_USERNAME}?start=register`);
    console.log('👀 Bot wartet auf Nachrichten...');
    
  } catch (error) {
    console.error('❌ Kritischer Fehler beim Starten:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Bot wird heruntergefahren...');
  if (global.botData.db) {
    await global.botData.db.close();
    console.log('📂 Datenbank geschlossen');
  }
  console.log('👋 Bot heruntergefahren');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Bot wird durch Benutzer gestoppt...');
  if (global.botData.db) {
    await global.botData.db.close();
    console.log('📂 Datenbank geschlossen');
  }
  console.log('👋 Bot gestoppt');
  process.exit(0);
});

// Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

// Bot starten
startBot();