FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Les données (matchs, réglages, son) sont stockées dans /data :
# monte un volume / disque persistant sur ce dossier chez l'hébergeur.
ENV NODE_ENV=production
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "server.js"]
