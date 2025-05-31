// ========================================
// COMMAND-HANDLER - handlers/commandHandler.js
// ========================================

const { isFullAdmin } = require('../auth/permissions');
const postCommands = require('../commands/postCommands');
const adminCommands = require('../commands/adminCommands');
const teacherCommands = require('../commands/teacherCommands');
const systemCommands = require('../commands/systemCommands');

// Hauptcommand-Handler
async function handleCommand(chatId, userId, text, permission, username) {
  const isFullAdminUser = isFullAdmin(permission);
  
  // Command extrahieren (mit Parameter)
  const command = text.split(' ')[0];
  
  // Command-Routing
  const commands = {
    // System-Commands
    '/help': () => systemCommands.handleHelp(chatId, permission),
    '/setup': () => isFullAdminUser ? systemCommands.handleSetup(chatId) : noPermission(chatId),
    '/stats': () => isFullAdminUser ? systemCommands.handleStats(chatId) : noPermission(chatId),
    
    // Post-Commands
    '/post': () => postCommands.handlePost(chatId, userId, text, username),
    '/messages': () => isFullAdminUser ? postCommands.handleMessages(chatId) : noPermission(chatId),
    '/notread': () => isFullAdminUser ? postCommands.handleNotRead(chatId, text) : noPermission(chatId),
    '/search': () => isFullAdminUser ? postCommands.handleSearch(chatId, text) : noPermission(chatId),
    
    // Admin-Commands  
    '/addadmin': () => isFullAdminUser ? adminCommands.handleAddAdmin(chatId, userId, text, 'admin') : noPermission(chatId),
    '/deleteadmin': () => isFullAdminUser ? adminCommands.handleDeleteAdmin(chatId, userId, text, 'admin') : noPermission(chatId),
    '/addsuperadmin': () => isFullAdminUser ? adminCommands.handleAddAdmin(chatId, userId, text, 'super-admin') : noPermission(chatId),
    '/deletesuperadmin': () => isFullAdminUser ? adminCommands.handleDeleteAdmin(chatId, userId, text, 'super-admin') : noPermission(chatId),
    '/listadmins': () => isFullAdminUser ? adminCommands.handleListAdmins(chatId, 'admin') : noPermission(chatId),
    '/listsuperadmins': () => isFullAdminUser ? adminCommands.handleListAdmins(chatId, 'super-admin') : noPermission(chatId),
    
    // Lehrer-Commands
    '/teachers': () => isFullAdminUser ? teacherCommands.handleTeachers(chatId) : noPermission(chatId),
    '/editteacher': () => isFullAdminUser ? teacherCommands.handleEditTeacher(chatId, userId, text) : noPermission(chatId),
    '/findteacher': () => isFullAdminUser ? teacherCommands.handleFindTeacher(chatId, text) : noPermission(chatId),
    '/unregistered': () => isFullAdminUser ? teacherCommands.handleUnregistered(chatId) : noPermission(chatId),
    '/getlink': () => isFullAdminUser ? teacherCommands.handleGetLink(chatId) : noPermission(chatId)
  };
  
  if (commands[command]) {
    await commands[command]();
  } else {
    await global.botData.bot.sendMessage(chatId, 
      `❓ **Unbekannter Befehl:** \`${command}\`\n\n` +
      `📋 Nutze \`/help\` für alle verfügbaren Befehle.`,
      { parse_mode: 'Markdown' }
    );
  }
}

// Keine Berechtigung
async function noPermission(chatId) {
  await global.botData.bot.sendMessage(chatId, '🚫 Keine Berechtigung für diesen Befehl.');
}

module.exports = {
  handleCommand
};