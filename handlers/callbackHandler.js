// ========================================
// CALLBACK-HANDLER - handlers/callbackHandler.js
// ========================================

const postCommands = require('../commands/postCommands');
const adminCommands = require('../commands/adminCommands');

// Callback Query Handler für Buttons
async function callbackHandler(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username || '';
  
  console.log(`🔘 Callback Query: ${data} von User ${userId}`);
  
  try {
    if (data.startsWith('send_')) {
      const targetUserId = data.split('_')[1];
      if (targetUserId == userId && global.botData.pendingPosts.has(userId)) {
        await postCommands.handleSendConfirmation(chatId, messageId, userId, username);
        await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
          text: '✅ Nachricht wird gesendet...' 
        });
      } else {
        await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
          text: '❌ Nicht autorisiert oder Post nicht mehr verfügbar' 
        });
      }
    }
    else if (data.startsWith('edit_')) {
      const targetUserId = data.split('_')[1];
      if (targetUserId == userId) {
        await postCommands.handleEditPost(chatId, messageId, userId);
        await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
          text: '✏️ Bearbeitung gestartet' 
        });
      } else {
        await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
          text: '❌ Nicht autorisiert' 
        });
      }
    }
    else if (data.startsWith('cancel_')) {
      const targetUserId = data.split('_')[1];
      if (targetUserId == userId) {
        await postCommands.handleCancelPost(chatId, messageId, userId);
        await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
          text: '❌ Abgebrochen' 
        });
      } else {
        await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
          text: '❌ Nicht autorisiert' 
        });
      }
    }
    else if (data.startsWith('confirm_delete_')) {
      await adminCommands.handleConfirmDelete(chatId, messageId, data, userId);
      await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
        text: '🗑️ Wird gelöscht...' 
      });
    }
    else if (data.startsWith('cancel_delete_')) {
      await adminCommands.handleCancelDelete(chatId, messageId, userId);
      await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
        text: '❌ Löschung abgebrochen' 
      });
    }
    else {
      console.log(`❓ Unbekannte Callback Query: ${data}`);
      await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
        text: '❓ Unbekannte Aktion' 
      });
    }
    
  } catch (error) {
    console.error('❌ Callback Query Fehler:', error);
    await global.botData.bot.answerCallbackQuery(callbackQuery.id, { 
      text: '❌ Fehler beim Verarbeiten' 
    });
  }
}

module.exports = callbackHandler;