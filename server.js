import express from "express";
import cors from "cors";
import multer from "multer";
import { execSync } from "child_process";
import fs from "fs";
import sharp from "sharp";
import { fileTypeFromFile } from 'file-type';

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "https://memifyy.netlify.app"
];

app.use(cors({
  origin: (origin, callback) => {
    console.log("Origin:", origin);
    // autorise les requêtes sans origin (ex: backend -> backend)
    // ou ton frontend
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


const upload = multer({
    dest: "temp/",
    limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
        cb(null, true);
      } else {
        cb(new Error("Seules les images JPEG/PNG sont autorisées"));
      }
    },
  });
  
app.use(express.json());

app.post("/generate", upload.single("file"), async (req, res) => {
  try {
    const { youtubeUrl, start = 0, end, useFullAudio } = req.body;
    const timestamp = Date.now();

    console.log(req.file);

    // 1) check file exists
    if (!req.file) return res.status(400).send("Aucune image uploadée");
    console.log("file exists");
    const rawPath = req.file.path;
    const safeImage = `temp/safe-${timestamp}-${Date.now()}.jpg`;
    
    try {
      // 2) detect real mime using magic bytes
      const ft = await fileTypeFromFile(rawPath);
      if (!ft || !ft.mime.startsWith("image/")) {
        // not an image by magic bytes
        fs.unlinkSync(rawPath);
        return res.status(400).send("Fichier non‑image détecté");
      }
      console.log("file is an image");
    
      // 3) try to decode and get metadata with sharp
      const meta = await sharp(rawPath).metadata();
      if (!meta || !meta.width || !meta.height) {
        fs.unlinkSync(rawPath);
        return res.status(400).send("Image invalide ou corrompue");
      }
      console.log("image has metadata");
      // 4) reject extreme sizes (dos protection)
      const MAX_PIXELS = 10000 * 10000; // ex: 100M pixels (ajuste)
      if (meta.width * meta.height > MAX_PIXELS) {
        fs.unlinkSync(rawPath);
        return res.status(400).send("Image trop grande");
      }
      console.log("image is not too big");
      // 5) re-encode into a safe jpeg (this strips metadata, alpha, etc.)
      await sharp(rawPath)
        .rotate()          // correct orientation if needed
        .resize({ width: Math.min(meta.width, 3840) }) // optional cap
        .jpeg({ quality: 85 })
        .toFile(safeImage);
    
      console.log("image is re-encoded");
      // remove raw upload to reduce attack surface
      fs.unlinkSync(rawPath);
    
      console.log("Image validated and re-encoded:", safeImage);
    
    } catch (err) {
      console.error("Validation image failed:", err);
      // cleanup
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      if (fs.existsSync(safeImage)) fs.unlinkSync(safeImage);
      return res.status(400).send("Image corrompue ou non‑valide");
    }

    // 2️⃣ Préparer fichiers audio/vidéo
    const audioPath = `temp/audio-${timestamp}.mp3`;
    const outputFile = `temp/output-${timestamp}.mp4`;

    // 3️⃣ Télécharger audio YouTube
    const downloadSection = !useFullAudio && end ? `*${start}-${end}` : `*${start}-`;
    execSync(
      `yt-dlp --cookies cookies.txt -x --audio-format mp3 --download-sections "${downloadSection}" -o "${audioPath}" "${youtubeUrl}"`,
      { stdio: "inherit" }
    );    

    // 4️⃣ Créer vidéo (image + audio)
    execSync(
      `ffmpeg -y -loop 1 -i "${safeImage}" -i "${audioPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest "${outputFile}"`,
      { stdio: "inherit" }
    );

    console.log("Vidéo générée avec succès");

    // 5️⃣ Envoyer au client et cleanup
    res.download(outputFile, "final.mp4", () => {
      [req.file.path, safeImage, audioPath, outputFile].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur lors de la génération vidéo");
  }
});

app.get("/generate", (req, res) => {
  res.status(200).send("OK");
});


app.listen(5001, () => console.log("Backend running on port 5001"));
