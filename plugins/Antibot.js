const fs = require("fs");
const path = require("path");
const file = path.resolve("./activos.json");

if (!fs.existsSync(file)) {
  fs.writeFileSync(file, JSON.stringify({}, null, 2));
}

const isOwner = (jid) => {
  const ownerList = global.owner || [];
  const clean = jid.replace(/[^0-9]/g, "");
  return ownerList.some(([id]) => id === clean);
};

module.exports = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;

  if (!chatId.endsWith("@g.us")) {
    return await conn.sendMessage(chatId, {
      text: "❌ Este comando solo puede usarse en grupos."
    }, { quoted: msg });
  }

  const sender = (msg.key.participant || msg.key.remoteJid).replace(/[^0-9]/g, "");
  const metadata = await conn.groupMetadata(chatId);
  const isAdmin = metadata.participants.find(p =>
    p.id.includes(sender) &&
    (p.admin === "admin" || p.admin === "superadmin")
  );

  if (!isAdmin && !isOwner(sender)) {
    return await conn.sendMessage(chatId, {
      text: "⛔ Solo *administradores* o el *owner* del bot pueden usar este comando."
    }, { quoted: msg });
  }

  const mode = args[0]?.toLowerCase();
  if (!["on", "off"].includes(mode)) {
    return await conn.sendMessage(chatId, {
      text: "⚙️ Usa:\n.antibot on\n.antibot off"
    }, { quoted: msg });
  }

  const data = JSON.parse(fs.readFileSync(file));
  if (!data.antibot) data.antibot = {};

  if (mode === "on") {
    data.antibot[chatId] = true;
    await conn.sendMessage(chatId, {
      text: "✅ Modo *antibot* activado en este grupo."
    }, { quoted: msg });
  } else {
    delete data.antibot[chatId];
    await conn.sendMessage(chatId, {
      text: "❌ Modo *antibot* desactivado en este grupo."
    }, { quoted: msg });
  }

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

module.exports.command = ["antibot"];
