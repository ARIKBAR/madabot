const express = require('express');
const bodyParser = require('body-parser');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


// הגדרות השרת
const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_GROUP_ID = '120363419703663919@g.us'; // יש להחליף בזיהוי קבוצת וואטסאפ
const API_KEY = 'mSsTy,K6^ZU+x.jG{nhQP'; // צור מפתח API מאובטח

const recentMessages = new Map(); // מפתח: cleanSmsBody, ערך: timestamp
const MESSAGE_SUPPRESSION_WINDOW_MS = 60 * 1000; // דקה

function sanitizeControlChars(str) {
    return typeof str === 'string' ? str.replace(/[\x00-\x1F\x7F]/g, '') : '';
  }
  


// עיבוד בקשות JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// אימות API key
app.use('/mda-webhook', (req, res, next) => {
  const providedKey = req.headers['x-api-key'];
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).send('Unauthorized');
  }
  next();
});

// יצירת לקוח WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox']
  }
});

// אירועים של WhatsApp
client.on('qr', (qr) => {
  // הצגת קוד QR לסריקה
  console.log('יש לסרוק את קוד ה-QR הבא עם וואטסאפ במכשיר הנייד:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('לקוח וואטסאפ מחובר ומוכן!');
});

client.on('authenticated', () => {
  console.log('אימות בוצע בהצלחה!');
});

client.on('auth_failure', (msg) => {
  console.error('שגיאת אימות:', msg);
});


async function getAddressFromCoords(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'mda-whatsapp-bot'
      }
    });
    if (!response.ok) throw new Error('שגיאה בשליפת כתובת');
    const data = await response.json();
  
    const { road, city, neighbourhood } = data.address || {};
  
    const resolvedCity = city || 'עיר לא ידועה';
    const resolvedRoad = road || 'רחוב לא ידוע';
    const resolvedNeighbourhood = neighbourhood || '';
  
    return `${resolvedRoad}, ${resolvedNeighbourhood ? resolvedNeighbourhood + ', ' : ''}${resolvedCity}`;
  }
  



// נקודת קצה לקבלת התראות מהאפליקציה
app.post('/mda-webhook', async (req, res) => {
    try {
      if (!req.body || !req.body.body) {
        return res.status(400).send('נתונים חיוניים חסרים (שדה body)');
      }
  
      const sender = req.body.sender || 'מקור לא ידוע';
      const smsBody = sanitizeControlChars(req.body.body);
      const timestamp = req.body.timestamp || 0;
      const latitude = req.body.latitude;
      const longitude = req.body.longitude;
  
      
  
      const cleanSmsBody = smsBody.trim();
      const now = Date.now();
const lastTimeSent = recentMessages.get(cleanSmsBody);

if (lastTimeSent && (now - lastTimeSent) < MESSAGE_SUPPRESSION_WINDOW_MS) {
  console.log('הודעה זהה נשלחה לאחרונה – מדלגים על שליחה נוספת');
  return res.status(200).send({ status: 'skipped', reason: 'duplicate_message_within_timeframe' });
}

// אם לא נשלחה לאחרונה – רשום אותה
recentMessages.set(cleanSmsBody, now);

      
      const date = new Date(timestamp);
      const whatsappTitle = `🚑 *התראת מד"א* 🚑`;
  
      let whatsappText = '';
      whatsappText += `👤 *מקור:* ${sender}\n`;
      whatsappText += `💬 *הודעה:* ${cleanSmsBody}\n`;
      whatsappText += `⏰ *זמן אירוע:* ${date.toLocaleString('he-IL')}\n`;
  
      if (
        latitude !== undefined &&
        longitude !== undefined &&
        (latitude !== 0.0 || longitude !== 0.0)
      ) {
        try {
          const address = await getAddressFromCoords(latitude, longitude);
          const wazeLink = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
          const rtl = '\u200F';
  
          whatsappText += `📍 *כתובת משוערת:* ${address}\n`;
          whatsappText += `${rtl}🚗 *לניווט* ${wazeLink}\n`;
        } catch (err) {
          whatsappText += `📍 *כתובת משוערת:* לא הצלחנו לאתר את המיקום\n`;
          console.error('שגיאה בשליפת כתובת:', err);
        }
      } else {
        whatsappText += `📍 *מיקום:* לא זמין\n`;
      }
  
      const message = `${whatsappTitle}\n\n${whatsappText}`;
  
      if (client.info) {
        await client.sendMessage(WHATSAPP_GROUP_ID, message);
        console.log('הודעה נשלחה בהצלחה לקבוצת וואטסאפ');
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send({ status: 'success', sentMessage: message });
      } else {
        console.error('לקוח וואטסאפ לא מחובר');
        return res.status(500).send('לקוח וואטסאפ לא מחובר');
      }
    } catch (error) {
      console.error('שגיאה בעיבוד או שליחת ההודעה:', error);
      return res.status(500).send(`שגיאה פנימית בשרת: ${error.message}`);
    }
  });
  

// נקודת קצה לקבלת מזהי קבוצות וואטסאפ
app.get('/whatsapp-groups', async (req, res) => {
  try {
    if (!client.info) {
      return res.status(500).send('לקוח וואטסאפ לא מחובר');
    }
    
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    
    const groupsInfo = groups.map(group => ({
      id: group.id._serialized,
      name: group.name
    }));
    
    return res.status(200).json(groupsInfo);
  } catch (error) {
    return res.status(500).send(`שגיאה: ${error.message}`);
  }
});

// נקודת קצה פשוטה לבדיקת תקינות השרת
app.get('/', (req, res) => {
  res.send('שרת MDA-WhatsApp פעיל');
});

// התחלת השרת
app.listen(PORT, () => {
  console.log(`השרת פעיל ומאזין בפורט ${PORT}`);
});

// התחברות ללקוח וואטסאפ
client.initialize();