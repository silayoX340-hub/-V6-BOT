const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');
const express = require('express');

// Keep alive for Heroku/Railway
const app = express();
app.get('/', (req, res) => res.send('SILAYOX V6 BOT is alive!'));
app.listen(process.env.PORT || 3000, () => console.log('HTTP server running'));

// Command handler
const commands = new Map();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.set(command.name, command);
}

// AFK store
global.afk = new Map();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: Pino({ level: 'silent' }),
    browser: ['SILAYOX V6', 'Chrome', '120.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot connected as', sock.user.id);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!body.startsWith(config.prefix)) return;

    const args = body.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = commands.get(commandName);
    if (!command) return;

    // Owner check (for owner-only commands)
    const sender = msg.key.participant || from;
    const isOwner = sender.split('@')[0] === config.ownerNumber;

    if (command.ownerOnly && !isOwner) {
      await sock.sendMessage(from, { text: '❌ This command is only for bot owner.' });
      return;
    }

    try {
      await command.execute(sock, msg, args, from, isOwner);
    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '⚠️ Error executing command.' });
    }
  });
}

startBot();
