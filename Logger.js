// Simple in-memory AFK store
const afkMap = new Map();

module.exports = {
  set: (jid, data) => afkMap.set(jid, data),
  get: (jid) => afkMap.get(jid),
  delete: (jid) => afkMap.delete(jid),
  has: (jid) => afkMap.has(jid)
};
