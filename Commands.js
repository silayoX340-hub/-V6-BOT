// SILAYOX V6 BOT - Single File Version
// Owner: SILENT DJ | +255768192847

require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys');
const Pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { Sticker } = require('wa-sticker-formatter');
const sharp = require('sharp');
const express = require('express');

// -------------------- CONFIG --------------------
const config = {
  botName: process.env.BOT_NAME || 'SILAYOX V6 BOT',
  ownerName: process.env.OWNER_NAME || 'SILENT DJ',
  ownerNumber: process.env.OWNER_NUMBER || '255768192847',
  prefix: process.env.PREFIX || '.',
  sessionDir: process.env.SESSION_DIR || './session',
};

// Keep-alive server for platforms like Heroku/Railway
const app = express();
app.get('/', (req, res) => res.send('SILAYOX V6 BOT is running'));
app.listen(process.env.PORT || 3000, () => console.log('HTTP server on port', process.env.PORT || 3000));

// AFK store
global.afk = new Map();

// -------------------- UTILITY FUNCTIONS --------------------
async function getMessageBuffer(msg, type) {
  const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quoted || !quoted[type]) return null;
  const stream = await downloadContentFromMessage(quoted[type], type === 'imageMessage' ? 'image' : 'sticker');
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

// -------------------- COMMAND HANDLER --------------------
async function handleCommand(sock, msg, from, sender, body, isOwner) {
  const args = body.slice(config.prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ----- PING -----
  if (cmd === 'ping') {
    const start = Date.now();
    await sock.sendMessage(from, { text: '🏓 Pinging...' });
    const end = Date.now();
    await sock.sendMessage(from, { text: `*Pong!* ${end - start}ms` });
  }

  // ----- OWNER INFO -----
  else if (cmd === 'owner') {
    const text = `👑 *Owner:* ${config.ownerName}\n📞 *Number:* wa.me/${config.ownerNumber}`;
    await sock.sendMessage(from, { text });
  }

  // ----- MENU -----
  else if (cmd === 'menu') {
    const menu = `🤖 *${config.botName}* 🤖
Owner: ${config.ownerName}
Prefix: ${config.prefix}

*📜 Commands:*
${config.prefix}ping - Bot latency
${config.prefix}owner - Owner info
${config.prefix}sticker - Image to sticker
${config.prefix}toimg - Sticker to image
${config.prefix}ai <text> - AI chat
${config.prefix}tagall - Mention all (group)
${config.prefix}kick @user - Kick member (admin)
${config.prefix}promote @user - Make admin
${config.prefix}demote @user - Remove admin
${config.prefix}delete - Delete bot's message
${config.prefix}afk <reason> - Set away
${config.prefix}join <invite> - Bot join (owner)
${config.prefix}leave - Bot leave group
${config.prefix}groupinfo - Group details

🔧 Made by SILENT DJ`;
    await sock.sendMessage(from, { text: menu });
  }

  // ----- STICKER -----
  else if (cmd === 'sticker') {
    const buffer = await getMessageBuffer(msg, 'imageMessage');
    if (!buffer) return sock.sendMessage(from, { text: '❌ Reply to an image with .sticker' });
    const sticker = new Sticker(buffer, { pack: config.botName, author: config.ownerName });
    const stickerBuffer = await sticker.build();
    await sock.sendMessage(from, { sticker: stickerBuffer });
  }

  // ----- TOIMG -----
  else if (cmd === 'toimg') {
    const buffer = await getMessageBuffer(msg, 'stickerMessage');
    if (!buffer) return sock.sendMessage(from, { text: '❌ Reply to a sticker with .toimg' });
    const pngBuffer = await sharp(buffer).png().toBuffer();
    await sock.sendMessage(from, { image: pngBuffer, caption: 'Converted sticker' });
  }

  // ----- AI (Popcat) -----
  else if (cmd === 'ai') {
    if (!args.length) return sock.sendMessage(from, { text: '❌ Example: .ai Hello' });
    const query = args.join(' ');
    try {
      const { data } = await axios.get(`https://api.popcat.xyz/chat?msg=${encodeURIComponent(query)}`);
      await sock.sendMessage(from, { text: `🤖 *AI:* ${data.response}` });
    } catch {
      await sock.sendMessage(from, { text: '⚠️ AI error. Try later.' });
    }
  }

  // ----- TAGALL -----
  else if (cmd === 'tagall') {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Group only.' });
    const meta = await sock.groupMetadata(from);
    const participants = meta.participants;
    let mentions = participants.map(p => p.id);
    let text = '📢 *TAGALL*\n';
    for (let p of participants) text += ` @${p.id.split('@')[0]}\n`;
    await sock.sendMessage(from, { text, mentions });
  }

  // ----- KICK -----
  else if (cmd === 'kick') {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Group only.' });
    const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
    const toKick = quoted || (args[0]?.replace('@', '') + '@s.whatsapp.net');
    if (!toKick) return sock.sendMessage(from, { text: '❌ Reply/tag a user.' });
    await sock.groupParticipantsUpdate(from, [toKick], 'remove');
    await sock.sendMessage(from, { text: `✅ Kicked ${toKick.split('@')[0]}` });
  }

  // ----- PROMOTE -----
  else if (cmd === 'promote') {
    if (!from.endsWith('@g.us')) return;
    const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
    const toPromote = quoted || (args[0]?.replace('@', '') + '@s.whatsapp.net');
    if (!toPromote) return sock.sendMessage(from, { text: '❌ Reply/tag a user.' });
    await sock.groupParticipantsUpdate(from, [toPromote], 'promote');
    await sock.sendMessage(from, { text: `✅ Promoted @${toPromote.split('@')[0]}`, mentions: [toPromote] });
  }

  // ----- DEMOTE -----
  else if (cmd === 'demote') {
    if (!from.endsWith('@g.us')) return;
    const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;
    const toDemote = quoted || (args[0]?.replace('@', '') + '@s.whatsapp.net');
    if (!toDemote) return sock.sendMessage(from, { text: '❌ Reply/tag a user.' });
    await sock.groupParticipantsUpdate(from, [toDemote], 'demote');
    await sock.sendMessage(from, { text: `✅ Demoted @${toDemote.split('@')[0]}`, mentions: [toDemote] });
  }

  // ----- DELETE -----
  else if (cmd === 'delete') {
    const quotedMsg = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) return sock.sendMessage(from, { text: '❌ Reply to a bot message.' });
    const key = {
      remoteJid: from,
      fromMe: true,
      id: msg.message.extendedTextMessage.contextInfo.stanzaId
    };
    await sock.sendMessage(from, { delete: key });
  }

  // ----- AFK -----
  else if (cmd === 'afk') {
    const reason = args.join(' ') || 'No reason';
    global.afk.set(sender, { reason, time: Date.now() });
    await sock.sendMessage(from, { text: `👋 You are now AFK: ${reason}` });
  }

  // ----- JOIN (owner only) -----
  else if (cmd === 'join') {
    if (!isOwner) return sock.sendMessage(from, { text: '❌ Owner only.' });
    const invite = args[0];
    if (!invite) return sock.sendMessage(from, { text: '❌ Provide invite code/link.' });
    let code = invite.split('https://chat.whatsapp.com/')[1] || invite;
    try {
      await sock.groupAcceptInvite(code);
      await sock.sendMessage(from, { text: '✅ Joined group!' });
    } catch {
      await sock.sendMessage(from, { text: '⚠️ Invalid invite.' });
    }
  }

  // ----- LEAVE -----
  else if (cmd === 'leave') {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Group only.' });
    await sock.groupLeave(from);
    await sock.sendMessage(from, { text: '👋 Bot left the group.' });
  }

  // ----- GROUP INFO -----
  else if (cmd === 'groupinfo') {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Group only.' });
    const meta = await sock.groupMetadata(from);
    let text = `📊 *Group Info*\n📛 Name: ${meta.subject}\n👥 Members: ${meta.participants.length}\n🆔 ID: ${meta.id}\n👑 Owner: @${meta.owner?.split('@')[0] || 'unknown'}`;
    await sock.sendMessage(from, { text, mentions: [meta.owner] });
  }
}

// -------------------- MAIN BOT --------------------
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: Pino({ level: 'silent' }),
    browser: [config.botName, 'Chrome', '120.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
      else console.log('❌ Logged out, delete session folder to restart');
    } else if (connection === 'open') {
      console.log(`✅ ${config.botName} connected as`, sock.user.id);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const isOwner = sender.split('@')[0] === config.ownerNumber;

    // Check AFK reply
    if (global.afk.has(sender)) {
      const afkData = global.afk.get(sender);
      global.afk.delete(sender);
      await sock.sendMessage(from, { text: `👋 Welcome back! You were AFK: ${afkData.reason}` });
    }

    if (body.startsWith(config.prefix)) {
      await handleCommand(sock, msg, from, sender, body, isOwner);
    }
  });
}

startBot();
