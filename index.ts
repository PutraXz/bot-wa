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
     
    // if (isPingCommandTwo) {
    //   const groupDataTwo = await sock.groupMetadata(msg.key.remoteJid as string);
    //   if (isPingCommandTwo) {
    //     await sock.sendMessage(msg.key.remoteJid as string, {
    //       text: `UPDATE PEMBAYARAN ${getNameDays()} ${date.getDate()}/${date.getMonth()}/${date.getFullYear()}\nTarikan ke ${indexDays + 1}(${dataArray.tarikan[indexDays].nama}/${day}/${month}/${year})\n${resultNames.join("\n")}`,
    //     });
    //   }
    // }
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
  // if (isPingCommandTwo) {
  //   const groupData = await sock.groupMetadata(msg.key.remoteJid as string);
  //   const mentionedJidList = groupData.participants.map((participant) => participant.id);
  //   const senderId = msg.key.participant;
  //   const textMessage = msg.message?.conversation;
  //   const dateNow = new Date();
  //   const splitMessage = textMessage.split(".tambah")[1]?.trim();
  
  //   if (!splitMessage) {
  //     console.log("Nomor tidak ditemukan dalam pesan.");
  //     return;
  //   }
  
  //   // Membaca file data.json dan memeriksa apakah nomor sudah ada
  //   fs.readFile('data.json', 'utf8', (err, data) => {
  //     let dataMessage;
  //     if (err) {
  //       console.log('File not found, creating new file.');
  //       dataMessage = { message: [] };
  //     } else {
  //       dataMessage = JSON.parse(data);
  //     }
  
  //     // Mengecek apakah nomor sudah ada dalam dataMessage
  //     const isNumberExist = dataMessage.message.some((item) => item.number === splitMessage);
  
  //     if (isNumberExist) {
  //       // Nomor sudah ada dalam data
  //       sock.sendMessage(msg.key.remoteJid as string, {
  //         text: `Nomor ${splitMessage} sudah ada dalam daftar.`,
  //       });
  //     } else {
  //       // Menambahkan nomor baru ke dalam data
  //       dataMessage.message.push({
  //         number: splitMessage,
  //         sender: senderId,
  //         tanggal: `${dateNow.getDate()}-${dateNow.getMonth() + 1}-${dateNow.getFullYear()}`,
  //       });
  
  //       fs.writeFile('data.json', JSON.stringify(dataMessage, null, 2), (err) => {
  //         if (err) {
  //           console.log('Error writing file:', err);
  //         } else {
  //           console.log('Successfully wrote file');
  //           sock.sendMessage(msg.key.remoteJid as string, {
  //             text: `Nomor ${splitMessage} berhasil ditambahkan.`,
  //           });
  //         }
  //       });
  //     }
  //   });
  
  //   console.log(`Pesan dari ${senderId}: ${splitMessage}`);
  //   }  
    // if(isPingCommandThree){
    //   const UripGetContact = require('urip-getcontact');
    //   const getContact = new UripGetContact("9c2feac41b8d591ff058a3cc45374e844c0059e52e4e07e02adac24f1f574b0e", "ctJZxE6833cd8e526ce1df60a03b0f8da4784249988ea4ebe6a75abf82");
    //   getContact.checkNumber("0895391518953")
    //     .then((data) => {
    //       console.log(data);
    //     })
    //     .catch((err) =>{
    //       console.log(err);
    //     });
      // const groupData = await sock.groupMetadata(msg.key.remoteJid as string);
      // const mentionedJidList = groupData.participants.map((participant) => participant.id);

      // const quotedSender = msg.key.participant;
      // const quotedMessageId = msg.key.id
      // const quotedText =msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      // const dataMessage = JSON.parse(fs.readFileSync('data.json', 'utf-8'));
      // const getNumber = dataMessage.message.map(item => item.number);
      // const textMessage = msg.message?.conversation;
      // const splitMessage = textMessage.split(".cari")[1]?.trim();
      // const matchedNumber = dataMessage.message.find(n => n.number == splitMessage);
      //   if(matchedNumber){
      //     const finalNumber = matchedNumber.sender.split('@')[0];
      //       await sock.sendMessage(msg.key.remoteJid as string, {
      //         text: `Nomor ${splitMessage} ada dalam daftar\npengirim: ${finalNumber}\npada tanggal: ${matchedNumber.tanggal}`,
      //         mentions: [quotedSender],
      //         contextInfo: {
      //           stanzaId: quotedMessageId,
      //           participant: quotedSender,
      //           quotedMessage: quotedText
      //         }
      //       });
      //   }else{
      //     await sock.sendMessage(msg.key.remoteJid as string, {
      //       text: `Nomor ${splitMessage} tidak ada dalam daftar bermasalah`,
      //       mentions: [quotedSender],
      //       contextInfo: {
      //         stanzaId: quotedMessageId,
      //         participant: quotedSender,
      //         quotedMessage: quotedText
      //       }
      //     });
      //   }
    //}
  });
}

connectToWhatsApp();
