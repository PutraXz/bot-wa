import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import dataJson from './data.json';
import * as fs from 'fs';

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
    const allowedNumbers = [
      "62895391518953@s.whatsapp.net", 
      "628972365549@s.whatsapp.net", 
      "6285261378437@s.whatsapp.net", 
      "6282162621163@s.whatsapp.net", 
      "6283836002673@s.whatsapp.net", 
      "6285762793274@s.whatsapp.net", 
      "62895422059961@s.whatsapp.net",
      "6282365559541@s.whatsapp.net",
      "62882016656265@s.whatsapp.net",
      "6282267749275@s.whatsapp.net",
      "6282217405017@s.whatsapp.net",
      "62882017181906@s.whatsapp.net",
    ];
    
    const msg = m.messages[0];
    
    if (msg.key.fromMe) return;
    const sendNumber = msg.key.participant || msg.key.remoteJid;
    if (!allowedNumbers.includes(sendNumber)){
      console.log(`Nomor ${sendNumber} tidak diizinkan mengirim pesan`);
      return;
    }
    const isPingCommand = msg.message?.conversation?.startsWith("!ping");
    const isReplyWithPing = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.startsWith("!ping");
    const isPingCommandTwo = msg.message?.conversation?.startsWith(".tambah");
    const isPingCommandThree = msg.message?.conversation?.startsWith(".cari");
    if (isPingCommand || isReplyWithPing) {
      const groupData = await sock.groupMetadata(msg.key.remoteJid as string);
      const mentionedJidList = groupData.participants.map((participant) => participant.id);

      const quotedSender = msg.message?.extendedTextMessage?.contextInfo?.participant;
      const quotedMessageId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const quotedText = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;

      if (quotedSender && quotedMessageId) {
          await sock.sendMessage(msg.key.remoteJid as string, {
              text: `@everyone`,
              mentions: [quotedSender],
              contextInfo: {
                  stanzaId: quotedMessageId,
                  participant: quotedSender,
                  quotedMessage: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage, 
              },
          });
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
