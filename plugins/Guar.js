const fs = require("fs");
const path = require("path");

// ——— helpers ———
function unwrapMessage(m) {
  let n = m;
  while (
    n?.viewOnceMessage?.message ||
    n?.viewOnceMessageV2?.message ||
    n?.viewOnceMessageV2Extension?.message ||
    n?.ephemeralMessage?.message
  ) {
    n =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message;
  }
  return n;
}

function ensureWA(wa, conn) {
  if (wa && wa.downloadContentFromMessage) return wa;
  if (conn && conn.wa && conn.wa.downloadContentFromMessage) return conn.wa;
  if (global.wa && global.wa.downloadContentFromMessage) return global.wa;
  return null;
}

// ——— plugin ———
const handler = async (msg, { conn, args }) => {
  const chatId = msg.key.remoteJid;

  try {
    // requisito: responder a un multimedia
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quotedRaw = ctx?.quotedMessage;
    const quoted = quotedRaw ? unwrapMessage(quotedRaw) : null;

    if (!quoted) {
      return conn.sendMessage(
        chatId,
        { text: "❌ *Error:* Debes responder a un multimedia (imagen, video, audio, sticker, etc.) con una palabra clave para guardarlo. 📂" },
        { quoted: msg }
      );
    }

    // clave
    const saveKey = (args || []).join(" ").trim().toLowerCase();
    if (!saveKey || !/[a-zA-Z0-9]/.test(saveKey)) {
      return conn.sendMessage(
        chatId,
        { text: "❌ *Error:* La palabra clave debe incluir al menos una letra o número, no solo emojis o símbolos." },
        { quoted: msg }
      );
    }

    // archivo guar.json
    const guarPath = path.resolve("./guar.json");
    if (!fs.existsSync(guarPath)) fs.writeFileSync(guarPath, JSON.stringify({}, null, 2));
    const guarData = JSON.parse(fs.readFileSync(guarPath, "utf-8"));

    if (guarData[saveKey]) {
      return conn.sendMessage(
        chatId,
        { text: `⚠️ *Aviso:* La palabra clave *"${saveKey}"* ya está en uso. Usa otra diferente. ❌` },
        { quoted: msg }
      );
    }

    // tipo de media
    let mediaType, mediaMessage, fileExtension;

    if (quoted.imageMessage) {
      mediaType = "image";
      mediaMessage = quoted.imageMessage;
      fileExtension = "jpg";
    } else if (quoted.videoMessage) {
      mediaType = "video";
      mediaMessage = quoted.videoMessage;
      fileExtension = "mp4";
    } else if (quoted.audioMessage) {
      mediaType = "audio";
      mediaMessage = quoted.audioMessage;
      fileExtension = "mp3";
    } else if (quoted.stickerMessage) {
      mediaType = "sticker";
      mediaMessage = quoted.stickerMessage;
      fileExtension = "webp";
    } else if (quoted.documentMessage) {
      mediaType = "document";
      mediaMessage = quoted.documentMessage;
      fileExtension = (mediaMessage.mimetype?.split("/")?.[1]) || "bin";
    } else {
      return conn.sendMessage(
        chatId,
        { text: "❌ *Error:* Solo puedes guardar imágenes, videos, audios, stickers y documentos. 📂" },
        { quoted: msg }
      );
    }

    // descarga (usa la inyección global/conn.wa hecha en index.js)
    const WA = ensureWA(null, conn);
    if (!WA) throw new Error("No se pudo acceder a Baileys (wa no inyectado).");

    const stream = await WA.downloadContentFromMessage(mediaMessage, mediaType);
    let mediaBuffer = Buffer.alloc(0);
    for await (const chunk of stream) mediaBuffer = Buffer.concat([mediaBuffer, chunk]);

    // guardar
    guarData[saveKey] = {
      buffer: mediaBuffer.toString("base64"),
      mimetype: mediaMessage.mimetype,
      extension: fileExtension,
      savedBy: msg.key.participant || msg.key.remoteJid,
    };

    fs.writeFileSync(guarPath, JSON.stringify(guarData, null, 2));

    return conn.sendMessage(
      chatId,
      { text: `✅ *Listo:* El multimedia se ha guardado con la palabra clave: *"${saveKey}"*. 🎉` },
      { quoted: msg }
    );
  } catch (e) {
    console.error("[guar] Error:", e);
    return conn.sendMessage(
      chatId,
      { text: "❌ *Hubo un error al guardar el contenido.*" },
      { quoted: msg }
    );
  }
};

handler.command = ["guar"];
module.exports = handler;
