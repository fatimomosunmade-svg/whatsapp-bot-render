// ====== Part 1: The Dummy Web Server ======
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('Bot is alive and running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectToWhatsApp();
});


// ====== Part 2: The WhatsApp Bot Logic ======
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
// We have removed the qrcode-terminal library

const OWNER_NUMBER = '2348086850026@s.whatsapp.net';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS('Desktop'),
        shouldIgnoreJid: jid => jid.includes('@g.us'),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // THIS IS THE FINAL FIX: We will now print ONLY the raw qr data string
        if (qr) {
            console.log('------------------------------------------------');
            console.log('           NEW QR CODE DATA RECEIVED          ');
            console.log('   Copy the long line of text below and use   ');
            console.log('      a QR Code Generator website to view it. ');
            console.log('------------------------------------------------');
            console.log(qr); // This prints the raw data string, e.g., "2@..."
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connection opened!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const sender = msg.key.participant || msg.key.remoteJid;
        const incomingText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        if (!incomingText.startsWith('.')) {
            return;
        }

        const prefix = '.';
        const args = incomingText.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        console.log(`> Command received: "${command}" from ${sender}`);

        switch (command) {
            case 'ping':
                await sock.sendMessage(msg.key.remoteJid, { text: 'Pong!' }, { quoted: msg });
                break;
            case 'owner':
                if (sender.startsWith('2348086850026')) {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'Yes, Master! You are the owner.' }, { quoted: msg });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'You are not authorized to use this command.' }, { quoted: msg });
                }
                break;
            default:
                await sock.sendMessage(msg.key.remoteJid, { text: `Sorry, the command ".${command}" does not exist.` }, { quoted: msg });
        }
    });
}
