FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY app/ ./app/

EXPOSE 3000
CMD ["node", "app/index.js"]
