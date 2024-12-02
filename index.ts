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
  // const getNameDays = (): string =>{
  //   const options: Intl.DateTimeFormatOptions = {weekday: 'long' , timeZone: 'Asia/Jakarta'};
  //   const formatter = new Intl.DateTimeFormat('id-ID', options);
  //   return formatter.format(new Date()); 
  // }
  // const date = new Date();
  // const testDate = new Date("2024-09-23");
  // const dataArray = JSON.parse(fs.readFileSync('test-data.json', 'utf-8'));
  // const countNames = dataArray.tarikan.filter(item => item.nama).length;
  // const getNames = dataArray.tarikan.map(item => item.nama);
  // let resultNames = [];
  // getNames.forEach((name, index) => {
  //   resultNames.push(`${name} ${index + 1}`);
  // });

  // const diffdays = Math.floor((date.getTime() - testDate.getTime()) / (1000 * 60 * 60 * 24));
  // const indexDays = Math.floor(diffdays / 10 ) % countNames;
  // const dateTarikan = testDate.setDate(testDate.getDate() + (indexDays + 1) * 10);
  // const formatDate = new Date(dateTarikan);
  // const day = formatDate.getDate().toString().padStart(2, '0');
  // const month = (formatDate.getMonth() + 1).toString().padStart(2, '0');
  // const year = formatDate.getFullYear();
  // const dateAgain = new Date(dateTarikan).toISOString().split('T')[0];

  // console.log(dataArray);
  // console.log(resultNames.join("\n"));
  // console.log(countNames);
  // console.log(indexDays + 1);
  // console.log(dataArray.tarikan[indexDays].nama);
  // console.log(dateAgain);
  // console.log(date);
  // console.log(testDate);
  sock.ev.on("messages.upsert", async (m) => {
    const allowedNumbers = [
      "62895391518953@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "628972365549@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "6285261378437@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "6282162621163@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "6283836002673@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "6285762793274@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "62895422059961@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "6282365559541@s.whatsapp.net", // Ganti dengan nomor yang diizinkan
      "6282267749275@s.whatsapp.net"
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
    const isPingCommandTwo = msg.message?.conversation?.startsWith(".done");

    
   
    // if (isPingCommandTwo) {
    //   const groupDataTwo = await sock.groupMetadata(msg.key.remoteJid as string);
    //   if (isPingCommandTwo) {
    //     await sock.sendMessage(msg.key.remoteJid as string, {
    //       text: `UPDATE PEMBAYARAN ${getNameDays()} ${date.getDate()}/${date.getMonth()}/${date.getFullYear()}\nTarikan ke ${indexDays + 1}(${dataArray.tarikan[indexDays].nama}/${day}/${month}/${year})\n${resultNames.join("\n")}`,
    //     });
    //   }
    // }
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
