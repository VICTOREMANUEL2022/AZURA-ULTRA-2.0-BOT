
// comandos/ytmp4.js — YouTube -> VIDEO (Sky API NUEVA /youtube/resolve)
// ✅ Elige calidad (144/240/360/720/1080/1440/4k)
// ✅ Interactivo: 👍 normal / ❤️ documento  (o 1 / 2)
// ✅ Reacciones: ⏳ -> ✅ y al descargar 🎬/📁 -> ✅
// ✅ SOLO VIDEO (nada de audio)
// ✅ Sin timeout + descarga segura (si el link es de tu API requiere apikey, por eso bajamos y mandamos el archivo)

"use strict";

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { pipeline } = require("stream");
const streamPipe = promisify(pipeline);

// ==== CONFIG API ====
const API_BASE = (process.env.API_BASE || "https://api-sky.ultraplus.click").replace(/\/+$/, "");
const API_KEY  = process.env.API_KEY  || "Russellxz";

// sin timeout + permitir grande
axios.defaults.timeout = 0;
axios.defaults.maxBodyLength = Infinity;
axios.defaults.maxContentLength = Infinity;

// calidades válidas
const VALID_QUALITIES = new Set(["144", "240", "360", "720", "1080", "1440", "4k"]);
const DEFAULT_QUALITY = "360";

// jobs pendientes por ID del preview
const pendingYTV = Object.create(null);

function isYouTube(u = "") {
  return /^https?:\/\//i.test(u) && /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(u);
}

function ensureTmp() {
  const tmp = path.resolve("./tmp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function safeName(name = "video") {
  return (
    String(name)
      .slice(0, 90)
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "video"
  );
}

function fmtDur(sec) {
  const n = Number(sec || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function isApiUrl(url = "") {
  try {
    const u = new URL(url);
    const b = new URL(API_BASE);
    return u.host === b.host;
  } catch {
    return false;
  }
}

function extractQualityFromText(input = "") {
  const t = String(input || "").toLowerCase();
  if (t.includes("4k")) return "4k";
  const m = t.match(/\b(144|240|360|720|1080|1440)\s*p?\b/);
  if (m && VALID_QUALITIES.has(m[1])) return m[1];
  return "";
}

// Permite: ".ytmp4 <url> 720" o ".ytmp4 <url> 4k"
function splitUrlAndQuality(raw = "") {
  const t = String(raw || "").trim();
  if (!t) return { url: "", quality: "" };
  const parts = t.split(/\s+/);
  const last = (parts[parts.length - 1] || "").toLowerCase();

  let q = "";
  if (last === "4k") q = "4k";
  else {
    const m = last.match(/^(144|240|360|720|1080|1440)p?$/i);
    if (m) q = m[1];
  }

  if (q) {
    parts.pop();
    return { url: parts.join(" ").trim(), quality: q };
  }
  return { url: t, quality: "" };
}

async function downloadToFile(url, filePath) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "*/*",
  };

  // si viene de TU API (/youtube/dl) necesita apikey
  if (isApiUrl(url)) headers["apikey"] = API_KEY;

  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 0,
    headers,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  if (res.status >= 400) throw new Error(`HTTP_${res.status}`);

  await streamPipe(res.data, fs.createWriteStream(filePath));
  return filePath;
}

// ==== API NUEVA: POST /youtube/resolve (video) ====
async function callYoutubeResolveVideo(videoUrl, quality) {
  const endpoint = `${API_BASE}/youtube/resolve`;

  const r = await axios.post(
    endpoint,
    { url: videoUrl, type: "video", quality: quality || DEFAULT_QUALITY },
    {
      timeout: 0,
      headers: {
        "Content-Type": "application/json",
        apikey: API_KEY,
        Accept: "application/json, */*",
      },
      validateStatus: () => true,
    }
  );

  const data = typeof r.data === "object" ? r.data : null;
  if (!data) throw new Error("Respuesta no JSON del servidor");

  const ok =
    data.status === true ||
    data.status === "true" ||
    data.ok === true ||
    data.success === true;

  if (!ok) throw new Error(data.message || data.error || "Error en la API");

  const result = data.result || data.data || data;
  if (!result?.media) throw new Error("API sin media");

  let dl = result.media.dl_download || "";
  if (dl && typeof dl === "string" && dl.startsWith("/")) dl = API_BASE + dl;

  const direct = result.media.direct || "";

  return {
    title: result.title || "YouTube",
    duration: result.duration || 0,
    thumbnail: result.thumbnail || "",
    // preferimos direct, pero si no hay usamos dl_download
    mediaUrl: direct || dl,
  };
}

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = (global.prefixes && global.prefixes[0]) || usedPrefix || ".";

  const { url, quality } = splitUrlAndQuality(text);
  const chosenQ = VALID_QUALITIES.has(quality) ? quality : DEFAULT_QUALITY;

  if (!url) {
    return conn.sendMessage(
      chatId,
      {
        text:
`✳️ Usa:
${pref}${command} <url> [calidad]
Ej:
${pref}${command} https://youtu.be/xxxx 720
${pref}${command} https://youtu.be/xxxx 4k

Calidades: 144 240 360 720 1080 1440 4k`,
      },
      { quoted: msg }
    );
  }

  if (!isYouTube(url)) {
    return conn.sendMessage(chatId, { text: "❌ URL de YouTube inválida." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

    // Preview: solo info rápida (no descarga aún)
    // (no resolvemos todavía para no gastar; resolvemos cuando elijan 1/2 o 👍/❤️)
    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 — 𝗩𝗶𝗱𝗲𝗼

Elige cómo enviarlo:
👍 𝗩𝗶𝗱𝗲𝗼 (normal)
❤️ 𝗩𝗶𝗱𝗲𝗼 𝗰𝗼𝗺𝗼 𝗱𝗼𝗰𝘂𝗺𝗲𝗻𝘁𝗼
— o responde: 1 = video · 2 = documento

⚙️ Calidad: ${chosenQ === "4k" ? "4K" : `${chosenQ}p`}
✦ Source: api-sky.ultraplus.click
────────────
🤖 azura ultra 𝘽𝙤𝙩`;

    const selectorMsg = await conn.sendMessage(chatId, { text: caption }, { quoted: msg });

    pendingYTV[selectorMsg.key.id] = {
      chatId,
      url,
      quality: chosenQ,
      baseMsg: msg,
      lock: false, // anti-duplicados
    };

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    if (!conn._ytvListener) {
      conn._ytvListener = true;

      conn.ev.on("messages.upsert", async (ev) => {
        for (const m of ev.messages) {
          try {
            // === REACCIONES ===
            if (m.message?.reactionMessage) {
              const { key: reactedKey, text: emoji } = m.message.reactionMessage;
              const job = pendingYTV[reactedKey.id];
              if (!job) continue;

              if (emoji !== "👍" && emoji !== "❤️") continue;

              const asDoc = emoji === "❤️";
              await processSend(conn, job, asDoc, m, /*replyText*/ "");
              continue;
            }

            // === RESPUESTAS 1/2 (y opcional calidad) ===
            const ctx = m.message?.extendedTextMessage?.contextInfo;
            const replyTo = ctx?.stanzaId;
            if (!replyTo) continue;

            const job = pendingYTV[replyTo];
            if (!job) continue;

            const txtRaw =
              m.message?.conversation ||
              m.message?.extendedTextMessage?.text ||
              "";
            const txt = String(txtRaw || "").trim().toLowerCase();
            if (!txt) continue;

            const first = txt.split(/\s+/)[0];
            if (first !== "1" && first !== "2") {
              await conn.sendMessage(job.chatId, {
                text: "⚠️ Responde con *1* (video) o *2* (documento), o reacciona con 👍 / ❤️.\nTip: también puedes poner calidad: `1 720` o `2 1080`",
              }, { quoted: job.baseMsg });
              continue;
            }

            const qFromReply = extractQualityFromText(txt);
            if (qFromReply && VALID_QUALITIES.has(qFromReply)) job.quality = qFromReply;

            const asDoc = first === "2";
            await processSend(conn, job, asDoc, m, txt);
          } catch (e) {
            console.error("ytmp4 listener error:", e);
          }
        }
      });
    }
  } catch (err) {
    console.error("ytmp4 error:", err?.message || err);
    await conn.sendMessage(chatId, { text: `❌ ${err?.message || "Error procesando el enlace."}` }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

async function processSend(conn, job, asDocument, triggerMsg) {
  // anti spam / duplicados
  if (job.lock) return;
  job.lock = true;

  // borramos de una para evitar doble envío si llegan 2 eventos juntos
  const toDeleteKey = Object.keys(pendingYTV).find((k) => pendingYTV[k] === job);
  if (toDeleteKey) delete pendingYTV[toDeleteKey];

  const q = VALID_QUALITIES.has(job.quality) ? job.quality : DEFAULT_QUALITY;
  const qLabel = q === "4k" ? "4K" : `${q}p`;

  try {
    await conn.sendMessage(job.chatId, { react: { text: asDocument ? "📁" : "🎬", key: triggerMsg.key } });
    await conn.sendMessage(job.chatId, { text: `⏳ Descargando video (${qLabel})…` }, { quoted: job.baseMsg });

    // 1) resolver por API nueva
    const resolved = await callYoutubeResolveVideo(job.url, q);
    const title = resolved.title || "YouTube";
    const durTxt = resolved.duration ? fmtDur(resolved.duration) : "—";
    const mediaUrl = resolved.mediaUrl;

    if (!mediaUrl) throw new Error("No se pudo obtener video (sin URL).");

    // 2) descargar a archivo (para soportar /youtube/dl con apikey)
    const tmp = ensureTmp();
    const base = safeName(title);
    const tag = q === "4k" ? "4k" : `${q}p`;
    const filePath = path.join(tmp, `yt-${Date.now()}-${base}-${tag}.mp4`);

    await downloadToFile(mediaUrl, filePath);

    // 3) enviar
    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 — 𝗟𝗶𝘀𝘁𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${base}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́𝗻: ${durTxt}
✦ 𝗖𝗮𝗹𝗶𝗱𝗮𝗱: ${qLabel}
✦ 𝗦𝗼𝘂𝗿𝗰𝗲: api-sky.ultraplus.click

🤖 𝙎𝙪𝙠𝙞 𝘽𝙤𝙩`;

    const buf = fs.readFileSync(filePath);

    if (asDocument) {
      await conn.sendMessage(job.chatId, {
        document: buf,
        mimetype: "video/mp4",
        fileName: `${base}_${tag}.mp4`,
        caption,
      }, { quoted: job.baseMsg });
    } else {
      await conn.sendMessage(job.chatId, {
        video: buf,
        mimetype: "video/mp4",
        caption,
      }, { quoted: job.baseMsg });
    }

    try { fs.unlinkSync(filePath); } catch {}
    await conn.sendMessage(job.chatId, { react: { text: "✅", key: triggerMsg.key } });
  } catch (e) {
    console.error("ytmp4 send error:", e?.message || e);
    await conn.sendMessage(job.chatId, { text: `❌ Error enviando video: ${e?.message || e}` }, { quoted: job.baseMsg });
    await conn.sendMessage(job.chatId, { react: { text: "❌", key: triggerMsg.key } });
  }
}

handler.command  = ["ytmp4", "ytv"];
handler.help     = ["ytmp4 <url> [calidad]", "ytv <url> [calidad]"];
handler.tags     = ["descargas"];
handler.register = true;

module.exports = handler;
