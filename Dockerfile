FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    xvfb \
    xauth \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV CHROME_PATH=/usr/bin/chromium
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000

CMD ["sh", "-c", "rm -f /tmp/.X99-lock /tmp/.X11-unix/X99; Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp >/tmp/xvfb.log 2>&1 & export DISPLAY=:99; sleep 1; exec node server.js"]
