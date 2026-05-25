const fs = require("fs");

const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const filePath = "./ventas365.json";

  const data = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : {};
  const tramites = data[chatId]?.settramites;

  if (!tramites) {
    return conn.sendMessage(chatId, {
      text: "📄 No hay trámites configurados para este grupo.",
    }, { quoted: msg });
  }

  if (tramites.imagen) {
    const buffer = Buffer.from(tramites.imagen, "base64");
    await conn.sendMessage(chatId, {
      image: buffer,
      caption: tramites.texto
    }, { quoted: msg });
  } else {
    await conn.sendMessage(chatId, {
      text: tramites.texto
    }, { quoted: msg });
  }
};

handler.command = ["tramites"];
module.exports = handler;
