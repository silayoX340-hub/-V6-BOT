const config = require('../config');

module.exports = {
  name: 'owner',
  description: 'Show owner info',
  async execute(sock, msg, args, from) {
    const text = `👑 *Owner:* ${config.ownerName}\n📞 *Number:* wa.me/${config.ownerNumber}`;
    await sock.sendMessage(from, { text });
  }
};
