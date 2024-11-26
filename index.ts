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
    const msg = m.messages[0];
    if (msg.key.fromMe) return;
    const isPingCommand = msg.message?.conversation?.startsWith("!ping");
    const isReplyWithPing = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.startsWith("!ping");
    const isPingCommandTwo = msg.message?.conversation?.startsWith(".done");


    const getNameDays = (): string =>{
      const options: Intl.DateTimeFormatOptions = {weekday: 'long' , timeZone: 'Asia/Jakarta'};
      const formatter = new Intl.DateTimeFormat('id-ID', options);
      return formatter.format(new Date()); 
    }
    const date = new Date();
    const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
    const getNames = data.names.join("\n");
    console.log(getNames);

    if (isPingCommandTwo) {
      const groupDataTwo = await sock.groupMetadata(msg.key.remoteJid as string);
      if (isPingCommandTwo) {
        await sock.sendMessage(msg.key.remoteJid as string, {
          text: `UPDATE PEMBAYARAN ${getNameDays()} ${date.getDate()}/${date.getMonth()}/${date.getFullYear()} \n${getNames}`,
        });
      }
    }
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
