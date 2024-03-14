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
      console.log(
        "connection closed due to ",
        lastDisconnect!.error,
        ", reconnecting ",
        shouldReconnect
      );
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("opened connection");
    }
  });
  sock.ev.on("messages.upsert", async (m) => {
    console.log(m.messages[0]);
    if (m.messages[0].message?.conversation === "info") {
      const groupData = await sock.groupMetadata(
        m.messages[0].key.remoteJid as string
      );
      const mentionedJidList = groupData.participants.map(
        (participant) => participant.id
      );
      await sock.sendMessage(m.messages[0].key.remoteJid as string, {
        text: "@ambatukam",
        mentions: mentionedJidList,
      });
    }
  });
}
connectToWhatsApp();
