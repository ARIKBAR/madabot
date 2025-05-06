FROM node:18-slim

# התקנת כל הספריות ש-Puppeteer צריך
RUN apt-get update && apt-get install -y \
  wget gnupg ca-certificates \
  fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
  libatk1.0-0 libcups2 libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 \
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 libdrm2 libgbm1 \
  libxshmfence1 libpangocairo-1.0-0 libpango-1.0-0 libxss1 \
  xdg-utils --no-install-recommends \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# התקנת Chrome דרוש ל-Puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "start"]
