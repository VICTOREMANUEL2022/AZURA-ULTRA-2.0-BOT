// plugins2/delpri.js
const handler = async (msg, { conn }) => {
  const senderId = msg.key.participant || msg.key.remoteJid;
  const senderNum = senderId.replace(/[^0-9]/g, "");
  const isOwner = global.owner.some(([id]) => id === senderNum);
  const isFromMe = msg.key.fromMe;

  if (!isOwner && !isFromMe) {
    return conn.sendMessage(msg.key.remoteJid, {
      text: "🚫 *Este comando solo puede usarlo el owner del bot o el subbot mismo.*"
    }, { quoted: msg });
  }

  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "🧹", key: msg.key }
  });

  let eliminados = 0;

  // Obtener todos los chats desde la store del socket
  const chats = Object.keys(conn.chats || conn.store.chats);

  for (const jid of chats) {
    if (!jid.endsWith("@g.us")) { // Solo privados
      try {
        await conn.chatModify({ delete: true }, jid);
        eliminados++;
      } catch (err) {
        console.log("❌ Error al eliminar chat:", jid, err);
      }
    }
  }

  await conn.sendMessage(msg.key.remoteJid, {
    text: `✅ *Se eliminaron ${eliminados} chats privados.*`
  }, { quoted: msg });
};

handler.command = ["delpri"];
handler.tags = ["owner"];
handler.help = ["delpri"];
module.exports = handler;
