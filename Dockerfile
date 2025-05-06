# תמונת בסיס עם Chrome מותקן מראש
FROM ghcr.io/puppeteer/puppeteer:latest

# יצירת תיקיית העבודה
WORKDIR /app

# העתקת קבצי הפרויקט
COPY package*.json ./
RUN npm install

COPY . .

# פתיחת פורט
EXPOSE 3000

# פקודת הרצה
CMD ["npm", "start"]
