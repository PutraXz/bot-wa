import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import { Boom } from "@hapi/boom";
const { GoogleGenerativeAI } = require("@google/generative-ai");
import axios from "axios";
import {writeFile, mkdir} from 'fs/promises';
import pino from "pino"; 
import fs from 'fs';
import { get } from "http";
import NextcloudClient from 'nextcloud-link';
import qrcode from "qrcode-terminal"; 

const path = require('path');
const logger = pino({ level: "info" });
const apiKey = new GoogleGenerativeAI("AIzaSyBSLzrtC9xcwWbGTZszY6SiQ8KOh0sU3Cg");
const simsimiKey = "kzZc23~HsBx8J7sgD130oXnTgrZjScgv_kUdoD8c";
const conversations = new Map();
const { exec } = require("child_process");

function updateConversation(remoteJid, userMessage, botResponse){
  if(!conversations.has(remoteJid)){
    conversations.set(remoteJid, []);
  }
  const chatHistory = conversations.get(remoteJid);
  chatHistory.push({ role: "user", message: userMessage});
  chatHistory.push({ role: "bot", message: botResponse});
  conversations.set(remoteJid, chatHistory);
}

async function getBotResponse(remoteJid, userMessage, service) {
  const chatHistory = conversations.get(remoteJid) || [];
  const prompt = chatHistory
  .map(entry => `${entry.role}: ${entry.message}`)
  .join("\n") + `\nuser: ${userMessage}`;

  let botResponse = "";

  try {
    if(service === "gemini"){
      const model = apiKey.getGenerativeModel({ model: "gemini-1.5-flash"});
      const result = await model.generateContent(prompt);
      botResponse = result.response.text();
    }else if(service === "simsimi"){
      botResponse = await getResponseSimSimi(userMessage);
    }

    
  } catch (error) {
    logger.error("Error pada request gemini:", error);
    return "bad request";
  }

  updateConversation(remoteJid, userMessage, botResponse);
    return botResponse.replace(/^Bot:\s*/, "");
}

async function getResponseSimSimi(prompt) {
  try {
    const response = await axios.post(
      "https://wsapi.simsimi.com/190410/talk",
      {
        utext: prompt,
        lang: "id"
      },{
        headers: {
          "Content-Type": "application/json",
          "x-api-key": simsimiKey
        }
      }
    );
    return response.data.atext
  } catch (error) {
    console.error("bad request: ", error)
  }
}
const config = {
  url: 'https://nextcloud.putrawork.web.id',
  username: 'admin',
  password: 'Whoami12#e',
};
const client = new NextcloudClient(config);

const localFolderPath = path.join(__dirname, 'videos');
const remoteBasePath = '/videos/';

async function createFolder(remoteFolderPath: string) {
  try {
    if (!remoteFolderPath.endsWith('/')) {
      remoteFolderPath += '/';
    }
    await client.createFolderHierarchy(remoteFolderPath);
    console.log(`Folder ${remoteFolderPath} berhasil dibuat!`);
  } catch (error) {
    console.error(`Gagal membuat folder ${remoteFolderPath}:`, error);
  }
}

async function uploadFileToNextcloud(localFilePath: string, remoteFilePath: string) {
  try {
    const fileBuffer = fs.readFileSync(localFilePath);
    await client.put(remoteFilePath, fileBuffer);
    console.log(`File berhasil diupload: ${remoteFilePath}`);
  } catch (error) {
    console.error(`Gagal mengupload file ${remoteFilePath}:`, error);
  }
}

async function fetchTwitterVideos(tweetUrl) {
  try {
    const response = await axios.get("https://api.ryzendesu.vip/api/downloader/twitter", {
      params: { url: tweetUrl },
    });

    if (!response.data.media || response.data.media.length === 0) {
      console.error("No videos found.");
      return null;
    }

    return response.data.media;
  } catch (error) {
    console.error("API fetch error:", error.message);
    return null;
  }
}

function extractUsernameFromUrl(url) {
  const match = url.match(/x.com\/(.*?)\/status/);
  return match ? match[1] : "unknown_user";
}

async function downloadAndUploadVideo(url, folderName, filename) {
  const folderPath = path.join(localFolderPath, folderName);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const filePath = path.join(folderPath, filename);
  const writer = fs.createWriteStream(filePath);

  try {
    const response = await axios({ url, method: "GET", responseType: "stream" });
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", () => resolve());
      writer.on("error", reject);
    });

    console.log(`✅ Download selesai: ${filePath}`);

    // Buat folder di Nextcloud jika belum ada
    const remoteFolderPath = path.join(remoteBasePath, folderName).replace(/\\/g, '/');
    await createFolder(remoteFolderPath);

    // Upload ke Nextcloud
    const remoteFilePath = path.join(remoteFolderPath, filename).replace(/\\/g, '/');
    await uploadFileToNextcloud(filePath, remoteFilePath);
    console.log(`✅ Upload selesai: ${remoteFilePath}`);

    // Hapus file setelah berhasil upload
    fs.unlinkSync(filePath);
    console.log(`🗑️ File lokal dihapus: ${filePath}`);

    return remoteFilePath;
  } catch (error) {
    console.error("Download atau upload error:", error.message);
  }
}

const SSH_USER = "root"; // Ganti dengan user SSH di VM Nextcloud
const SSH_HOST = "192.168.0.119"; // Ganti dengan IP VM Nextcloud
const SSH_KEY_PATH = "C:/Users/Administrator/.ssh/id_rsa"; // Ganti dengan path kunci SSH jika pakai key-based authentication
const SCRIPT_PATH = "convert-to-hls.sh";

async function runFfmpegOnNextcloud() {
  return new Promise((resolve, reject) => {
    const command = `cmd.exe /c "\"C:/Program Files/Git/bin/bash.exe\" -i ${SSH_KEY_PATH} -o StrictHostKeyChecking=no -o BatchMode=yes ${SSH_USER}@${SSH_HOST} './${SCRIPT_PATH}'`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error menjalankan script: ${stderr}`);
        reject(stderr);
      } else {
        console.log(`Output script: ${stdout}`);
        resolve(stdout);
      }
    });
  });
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
 
const sock = makeWASocket({
  version,
  auth: state,
  printQRInTerminal: false, // ⬅️ matikan pesan deprecated
  logger,
  browser: ["Ubuntu", "Chrome", "124.0"],
  connectTimeoutMs: 60_000,
  keepAliveIntervalMs: 20_000,
  defaultQueryTimeoutMs: 60_000,
  syncFullHistory: false,
});

sock.ev.on("connection.update", (u) => {
  const { connection, lastDisconnect, qr } = u;

  // ⬅️ cetak QR ke terminal saat diterima
  if (qr) {
    console.log("Scan QR berikut (kedaluwarsa ~20 detik):");
    qrcode.generate(qr, { small: true });
  }

  if (connection === "open") {
    logger.info("✅ Connected to WhatsApp");
  } else if (connection === "close") {
    const statusCode =
      (lastDisconnect?.error as any)?.output?.statusCode ||
      (lastDisconnect?.error as any)?.status ||
      (lastDisconnect?.error as any)?.code;

    const shouldReconnect =
      statusCode !== DisconnectReason.loggedOut &&
      statusCode !== DisconnectReason.badSession &&
      statusCode !== 401;

    if (shouldReconnect) {
      logger.info("Reconnecting...");
      connect().catch((e) => logger.error(e, "reconnect failed"));
    } else {
      logger.error("Not reconnecting (logged out / bad session). Hapus folder 's
ession' lalu start lagi.");
    }
  }
});

  
  sock.ev.on("messages.upsert", async (m) => {
    
    const msg = m.messages[0];
    if (msg.key.fromMe) return;
    if (!msg.message) return;

    const isPingTest = msg.message?.conversation?.startsWith(".test");
    const isPingCommand = msg.message?.conversation?.startsWith("!ping");
    const isReply = !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isPrompt = msg.message?.conversation?.startsWith(".ai") ||  msg.message?.imageMessage?.caption?.startsWith(".ai");
    const remoteJid = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const isImageMessage = messageType === 'imageMessage';
    const MAX_RETRIES = 10;
    const promptSimSimi = msg.message?.conversation?.startsWith(".simsimi");
    const isTextMessage = messageType === 'conversation';
    const textMessage = msg.message.conversation;
    const ds2 = msg.message?.conversation?.startsWith(".ds2");

    if (ds2) {
      const fullMessage = msg.message.conversation;
      const commandMessage = fullMessage.replace(".ds2", "").trim();
    
      try {
        const ekspresiList = commandMessage.split("+").map(e => e.trim());
        const nilaiList: number[] = [];
        const ekspresiAsli: string[] = [];
    
        ekspresiList.forEach(exp => {
          const ekspresiKuadrat = `(${exp})**2`; // otomatis kuadrat
          const hasil = eval(ekspresiKuadrat); // evaluasi hasil kuadrat
          nilaiList.push(hasil);
          ekspresiAsli.push(`(${exp})²`); // tampilkan dalam format matematika
        });
    
        const total = nilaiList.reduce((a, b) => a + b, 0);
        const formattedExpression = ekspresiAsli.join(" + ");
    
        await sock.sendMessage(msg.key.remoteJid as string, {
          text: `${formattedExpression}\n= ${nilaiList.map(n => n.toFixed(4)).join(" + ")}\n= ${total.toFixed(4)}\n√${total.toFixed(4)} = ${Math.sqrt(total).toFixed(4)}`
        });
      } catch (error) {
        await sock.sendMessage(msg.key.remoteJid as string, {
          text: `❌ Error: ${error}`
        });
      }
    }
    
    // function fileToGenerativePart(path, mimeType) {
    //   return {
    //     inlineData: {
    //       data: Buffer.from(fs.readFileSync(path)).toString("base64"),
    //       mimeType,
    //     },
    //   };
    // }
  
    // async function downloadImageWithRetry(msg) {
    //   for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    //     try {
    //       const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
    //         reuploadRequest: sock.updateMediaMessage,
    //         logger,
    //       });

    //       const fileName = `./image/${msg.key.id}-${Math.random() * 100}.jpg`;
    //       await writeFile(fileName, buffer);
    //       const imagePart = fileToGenerativePart(`${fileName}`, "image/jpeg");
    //       const fullMessage = msg.message.conversation;
    //       const promptText = fullMessage.replace(".ai", "").trim();
    //       const model = apiKey.getGenerativeModel({ model: "gemini-1.5-flash" });
    //       const result = await model.generateContent([promptText, imagePart]);
    //       const botResponse = result.response.text();
    //       const remoteJid = msg.key.remoteJid;
    //       updateConversation(remoteJid, promptText, botResponse);
          

    //       const quotedSender = msg.key.participant;

    //       await sock.sendMessage(msg.key.remoteJid as string, {
    //         text: botResponse,
    //         mentions: [quotedSender],
    //         contextInfo: {
    //           participant: quotedSender,
    //           stanzaId: msg.key.id,
    //           quotedMessage: msg.message,
    //         }
    //       });
    //       return;
    //     } catch (error) {
    //       logger.error("Error downloading media message:", error);
    //       if (attempt === MAX_RETRIES) {
    //         console.error("Max retries reached. Failed to download image.");
    //         await sock.sendMessage(msg.key.remoteJid as string, {
    //           text: `Failed to download image after ${MAX_RETRIES} attempts.`,
    //         });
    //       } else {
    //         console.log("Retrying...");
    //       }
    //     }
    //   }
    // }

    if (isPrompt) {
      if (isImageMessage) {
        console.log('Received .ai command with an image attached.');
        // await downloadImageWithRetry(msg);
      } else {
        console.log('Received .ai command with text.');
        const fullMessage = msg.message.conversation;
        const promptMessage = fullMessage.replace(".ai", "").trim();
        const botResponse = await getBotResponse(remoteJid, promptMessage, "gemini");

        const quotedSender = msg.key.participant;
        const quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        await sock.sendMessage(msg.key.remoteJid as string, {
          text: botResponse,
          mentions: [quotedSender], 
          contextInfo: {
            stanzaId: msg.key.id, 
            participant: quotedSender,
            quotedMessage: msg.message, 
          },
        });
        console.log(quotedSender, quotedMessageId, quotedMessage)
      }
    } else {
      console.log("Perintah tidak cocok atau tidak ada gambar.");
    }
    if(isTextMessage && msg.message.conversation?.startsWith('.twtdwn')){
      const url = msg.message.conversation.replace('.twtdwn', '').trim();
     
    }

    if (textMessage.startsWith(".twt ")) {
      const url = textMessage.replace(".twt", "").trim();
      if (!url.includes("x.com") && !url.includes("twitter.com")) {
        await sock.sendMessage(remoteJid, { text: "❌ Invalid Twitter URL." });
        return;
      }
      await sock.sendMessage(remoteJid, { react: { text: "⏳", key: msg.key } });
    
      try {
        const username = extractUsernameFromUrl(url);
        const mediaList = await fetchTwitterVideos(`https://${url}`);
    
        if (!mediaList) {
          throw new Error("No media found in the tweet.");
        }
    
        let downloadMessages = [];
    
        if (mediaList.length === 1) {
          const videoUrl = mediaList[0].url;
          const quality = mediaList[0].quality;
          const timestamp = Math.floor(Date.now() / 1000);
          const randomMath = Math.floor(Math.random() * 1000);
          const filename = `video_${timestamp}-${randomMath}_${quality}p.mp4`;
    
          console.log(`Downloading and uploading single video...`);
          await downloadAndUploadVideo(videoUrl, username, filename);
          downloadMessages.push(`✅ Video uploaded: ${filename}`);
        } else {
          console.log(`Downloading and uploading multiple videos (${mediaList.length})...`);
          for (let i = 0; i < mediaList.length; i++) {
            const videoUrl = mediaList[i].url;
            const quality = mediaList[i].quality;
            
          const timestamp = Math.floor(Date.now() / 1000);
          const randomMath = Math.floor(Math.random() * 1000);
          const filename = `video_${i + 1}_${timestamp}-${randomMath}_${quality}p.mp4`;
    
            await downloadAndUploadVideo(videoUrl, username, filename);
            downloadMessages.push(`✅ Video ${i + 1} uploaded: ${filename}`);
          }
        }
    
        await sock.sendMessage(remoteJid, { react: { text: "✅", key: msg.key } });
        await sock.sendMessage(remoteJid, { text: downloadMessages.join("\n") });
      } catch (error) {
        console.error("Error processing video:", error.message);
        await sock.sendMessage(remoteJid, { text: "❌ Failed to process video." });
      }
    };
    if(msg.message?.conversation?.startsWith(".toFfmpeg")){
      try {
        await sock.sendMessage(msg.key.remoteJid, { text: "⏳ Memproses video ke HLS..." });
        const result = await runFfmpegOnNextcloud();
        await sock.sendMessage(msg.key.remoteJid, { text: `✅ Konversi selesai!\n${result}` });
      } catch (error) {
        await sock.sendMessage(msg.key.remoteJid, { text: `❌ Gagal menjalankan konversi:\n${error}` });
      }
    };
      if (isPingCommand || (isReply && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage)) {
          const groupData = await sock.groupMetadata(msg.key.remoteJid as string);
          const mentionedJidList = groupData.participants.map((participant) => participant.id);
          
          const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
          const quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

          if (isReply) {
              const replyMessage = msg.message.extendedTextMessage.text; 
              if (replyMessage === "!ping") {
                  await sock.sendMessage(msg.key.remoteJid as string, {
                      text: `@everyone`,
                      contextInfo: {
                          stanzaId: quotedMessageId,
                          participant: quotedSender,
                          quotedMessage: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
                          mentionedJid: mentionedJidList 
                      },
                  });
                  console.log("Pesan yang di-reply adalah !ping");
              }
          } else if (isPingCommand) {
              await sock.sendMessage(msg.key.remoteJid as string, {
                  text: "@everyone",
                  mentions: mentionedJidList,
              });
          }
      }
  });

}

connectToWhatsApp();
