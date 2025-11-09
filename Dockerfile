# Utiliser Node.js officiel en version alpine
FROM node:20-alpine

# Installer ffmpeg et yt-dlp
RUN apk add --no-cache ffmpeg python3 py3-pip bash curl
RUN pip3 install yt-dlp

# Créer le répertoire de l'application
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le reste du code
COPY . .

# Créer le dossier temp pour les fichiers temporaires
RUN mkdir -p temp

# Exposer le port utilisé par ton serveur
EXPOSE 5001

# Commande pour démarrer le serveur
CMD ["npm", "start"]
