const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// group chat ID to send messages to:
const chatId = '120363419703663919@g.us';

app.use(bodyParser.text());

// initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'main' }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// QR code generation
client.on('qr', async (qr) => {
  console.log('Generating QR code...');
  try {
    await QRCode.toFile('./qr.png', qr);
    console.log('✅ QR code saved to qr.png');
  } catch (err) {
    console.error('❌ Failed to generate QR code:', err);
  }
});

client.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
});

app.post('/api/notify', async (req, res) => {
  const message = req.body;

  if (!message) {
    return res.status(400).send("❌ No message content.");
  }

  try {
    await client.sendMessage(chatId, message);
    console.log(`📤 Message sent: ${message}`);
    res.send("✅ Message sent to WhatsApp group.");
  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).send("❌ Failed to send message.");
  }
});

client.initialize();

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
