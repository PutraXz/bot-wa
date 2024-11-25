import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";

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
    console.log(m.messages[0]);
    if (m.messages[0].message?.conversation === "!ping" + " ") {
      const groupData = await sock.groupMetadata(
        m.messages[0].key.remoteJid as string
      );
      const mentionedJidList = groupData.participants.map(
        (participant) => participant.id
      );
      await sock.sendMessage(m.messages[0].key.remoteJid as string, {
        text: "@everyone",
        mentions: mentionedJidList,
      });
    }
  });
}

connectToWhatsApp();
