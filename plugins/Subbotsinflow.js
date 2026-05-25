// plugins2/subbots-modo.js
const fs = require("fs");
const path = require("path");

const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;
  const senderJid = (msg.key.participant || chatId)?.replace(/[^0-9]/g, "");
  const isOwner = global.owner?.some(([num]) => String(num) === senderJid) || msg.key.fromMe;

  if (!chatId.endsWith("@g.us")) {
    return await conn.sendMessage(chatId, {
      text: "⚠️ Este comando solo se puede usar en grupos.",
    }, { quoted: msg });
  }

  if (!isOwner) {
    return await conn.sendMessage(chatId, {
      text: "⛔ Este comando solo puede ser usado por *owners del bot*.",
    }, { quoted: msg });
  }

  const mode = args[0]?.toLowerCase();
  const filePath = path.resolve("activossubbots.json");
  let data = {};

  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      data = {};
    }
  }

  if (mode === "on") {
    data[chatId] = true;
    await conn.sendMessage(chatId, {
      text: "✅ *Modo subbots activado* en este grupo.",
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });
  } else if (mode === "off") {
    data[chatId] = false;
    await conn.sendMessage(chatId, {
      text: "❌ *Modo subbots desactivado* en este grupo.",
    }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "🚫", key: msg.key } });
  } else {
    return await conn.sendMessage(chatId, {
      text: `📌 *Uso correcto del comando:*\n> ${msg.body?.split(" ")[0]} on\n> ${msg.body?.split(" ")[0]} off`,
    }, { quoted: msg });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

handler.command = ["subbotss"];
module.exports = handler;
