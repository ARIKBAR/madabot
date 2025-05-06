const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.text());

let chatId = null;

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "main" }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('Scan this QR code to log in:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp client is ready!');
});

client.on('message', async msg => {
    if (msg.body === '!set') {
        chatId = msg.from;
        await msg.reply("✅ Chat ID saved. All alerts will be sent here.");
    }
});

app.post('/api/notify', async (req, res) => {
    const message = req.body;

    if (!chatId) {
        return res.status(400).send("❌ Chat ID not set. Send '!set' to the bot first.");
    }

    try {
        await client.sendMessage(chatId, message);
        res.send("✅ Message sent.");
    } catch (error) {
        console.error(error);
        res.status(500).send("❌ Failed to send message.");
    }
});

client.initialize();

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
