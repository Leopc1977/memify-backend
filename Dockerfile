# Utiliser Node.js officiel en version alpine
FROM node:20-alpine

# Installer ffmpeg, python et pip
RUN apk add --no-cache ffmpeg python3 py3-pip bash curl

# Créer un virtual environment pour Python
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Installer yt-dlp dans le venv
RUN pip install --upgrade pip
RUN pip install yt-dlp

# Créer le répertoire de l'application
WORKDIR /app

# Copier package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances Node.js
RUN npm install --production

# Copier le reste du code
COPY . .

# Créer le dossier temp pour les fichiers temporaires
RUN mkdir -p temp

# Exposer le port utilisé par ton serveur
EXPOSE 5001

# Healthcheck pour Traefik
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD curl -f http://localhost:5001/generate || exit 1

# Commande pour démarrer le serveur
CMD ["npm", "start"]
