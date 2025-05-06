// whatsapp-server/server.js

const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const qrcodeImagePath = path.join(__dirname, 'qr.png');

const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_GROUP_ID = '120363419703663919@g.us'; // שנה לפי הקבוצה שלך
const API_KEY = 'mSsTy,K6^ZU+x.jG{nhQP'; // שנה לפי הצורך שלך

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// אבטחת בקשות ל-webhook
app.use('/mda-webhook', (req, res, next) => {
  const providedKey = req.headers['x-api-key'];
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).send('Unauthorized');
  }
  next();
});

// ייצור אינסטנס של WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', async (qr) => {
  try {
    await QRCode.toFile(qrcodeImagePath, qr, { width: 300 });
    console.log('✅ קובץ qr.png נוצר. כנס ל /qr כדי לסרוק');
  } catch (err) {
    console.error('שגיאה ביצירת QR:', err);
  }
});

client.on('ready', () => {
  console.log('✅ WhatsApp client מוכן!');
});

client.on('authenticated', () => {
  console.log('🔐 התחברות בוצעה בהצלחה');
});

client.on('auth_failure', (msg) => {
  console.error('❌ שגיאת התחברות:', msg);
});

// נתיב webhook לקליטת ההתראות
app.post('/mda-webhook', (req, res) => {
  if (!req.body || !req.body.text) {
    return res.status(400).json({ error: 'נתונים חסרים' });
  }

  res.status(200).json({ status: 'processing' }); // תגובה מיידית

  const title = req.body.title || 'התראת מד"א';
  const text = req.body.text || 'אין פרטים נוספים';
  const cleanText = text.replace(/[^֐-׿\w\s,.():-]/g, '');

  const message = `🚑 *התראת מד"א* 🚑\n\n*כותרת:* ${title}\n\n*פרטים:* ${cleanText}\n\n⏰ ${new Date().toLocaleString('he-IL')}`;

  if (client.info) {
    client.sendMessage(WHATSAPP_GROUP_ID, message)
      .then(() => console.log('📤 הודעה נשלחה לקבוצה'))
      .catch(err => console.error('שגיאה בשליחה:', err));
  } else {
    console.warn('WhatsApp client לא מחובר');
  }
});

// נתיב לצפייה בקוד QR
app.get('/qr', (req, res) => {
  if (fs.existsSync(qrcodeImagePath)) {
    res.sendFile(qrcodeImagePath);
  } else {
    res.status(404).send('קוד QR לא מוכן עדיין. המתן לחיבור מחדש.');
  }
});

// בדיקת תקינות
app.get('/', (req, res) => {
  res.send('💡 WhatsApp Server פעיל');
});

// הרצת השרת והתחברות ל־WhatsApp
app.listen(PORT, () => {
  console.log(`🚀 השרת פעיל על פורט ${PORT}`);
});

client.initialize();
