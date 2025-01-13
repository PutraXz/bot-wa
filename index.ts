import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import {writeFile, mkdir} from 'fs/promises';
import pino from "pino"; 
import fs from 'fs';


const logger = pino({ level: "info" });
const apiKey = new GoogleGenerativeAI("AIzaSyBSLzrtC9xcwWbGTZszY6SiQ8KOh0sU3Cg");
const simsimiKey = "kzZc23~HsBx8J7sgD130oXnTgrZjScgv_kUdoD8c";
const conversations = new Map();

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

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect!.error as Boom)?.output?.statusCode !==
        DisconnectReason.loggedOut;
      console.log("Connection closed due to: ", lastDisconnect!.error);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("Opened connection");
    }
  });
  sock.ev.on("messages.upsert", async (m) => {
    console.log("Event diterima:", m);

    const msg = m.messages[0];
    if (msg.key.fromMe) return;
    if (!msg.message) return;
  
    console.log("Pesan diproses:", msg.message.conversation);

    const isPingTest = msg.message?.conversation?.startsWith(".test");
    const isPingCommand = msg.message?.conversation?.startsWith("!ping");
    const isReply = !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isPrompt = msg.message?.conversation?.startsWith(".ai") ||  msg.message?.imageMessage?.caption?.startsWith(".ai");
    const remoteJid = msg.key.remoteJid;
    const messageType = Object.keys(msg.message)[0];
    const isImageMessage = messageType === 'imageMessage';
    const MAX_RETRIES = 10;
    const promptSimSimi = msg.message?.conversation?.startsWith(".simsimi");


    if(promptSimSimi){
      const fullMessage = msg.message.conversation;
      const quoteMessage = fullMessage.replace(".ai2", "").trim();
      const responseSimsimi = await getBotResponse(remoteJid, quoteMessage, "simsimi");
      const quotedSender = msg.key.participant;
      try {
        await sock.sendMessage(msg.key.remoteJid as string, {
          text: responseSimsimi,
          mentions: [quotedSender],
          contextInfo: {
            participant: quotedSender,
            stanzaId: msg.key.id,
            quotedMessage: msg.message
          }
        });
      } catch (error) {
        
      }
    }

    function fileToGenerativePart(path, mimeType) {
      return {
        inlineData: {
          data: Buffer.from(fs.readFileSync(path)).toString("base64"),
          mimeType,
        },
      };
    }
  
    async function downloadImageWithRetry(msg) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
            reuploadRequest: sock.updateMediaMessage,
            logger,
          });

          const fileName = `./image/${msg.key.id}-${Math.random() * 100}.jpg`;
          await writeFile(fileName, buffer);
          const imagePart = fileToGenerativePart(`${fileName}`, "image/jpeg");
          const fullMessage = msg.message.conversation;
          const promptText = fullMessage.replace(".ai", "").trim();
          const model = apiKey.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent([promptText, imagePart]);
          const botResponse = result.response.text();
          const remoteJid = msg.key.remoteJid;
          updateConversation(remoteJid, promptText, botResponse);


          const quotedSender = msg.key.participant;

          await sock.sendMessage(msg.key.remoteJid as string, {
            text: botResponse,
            mentions: [quotedSender],
            contextInfo: {
              participant: quotedSender,
              stanzaId: msg.key.id,
              quotedMessage: msg.message,
            }
          });
          return;
        } catch (error) {
          logger.error("Error downloading media message:", error);
          if (attempt === MAX_RETRIES) {
            console.error("Max retries reached. Failed to download image.");
            await sock.sendMessage(msg.key.remoteJid as string, {
              text: `Failed to download image after ${MAX_RETRIES} attempts.`,
            });
          } else {
            console.log("Retrying...");
          }
        }
      }
    }

    if (isPrompt) {
      if (isImageMessage) {
        console.log('Received .ai command with an image attached.');
        await downloadImageWithRetry(msg);
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