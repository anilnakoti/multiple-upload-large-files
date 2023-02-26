const express = require("express");
const multer = require("multer");
const admin = require("firebase-admin");
const uuid = require("uuid-v4");

// Initialize Firebase AdminSDK
const serviceAccount = require("./firebase-admin.json");
const firebaseConfig = {
  storageBucket: "metashoptests.appspot.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...firebaseConfig,
});

// Set up Firebase Cloud Storage bucket reference
const bucket = admin.storage().bucket();

// Set up Multer storage engine
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB upload limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"), false);
    }
  },
});

const app = express();

app.use(express.urlencoded({ extended: true }));
// app.use(cors());

app.get("/health", (req, res) => {
  res.send("hello world");
});

app.post("/upload", upload.array("videos"), async (req, res) => {
  try {
    const files = req.files;
    const uploadPromises = [];

    // Iterate over uploaded files and upload each one to Firebase Cloud Storage
    for (const file of files) {
      const fileName = `${uuid()}_${file.originalname}`;
      const fileUpload = bucket.file(fileName);
      const fileStream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      const uploadPromise = new Promise((resolve, reject) => {
        fileStream.on("error", (error) => {
          reject(error);
        });
        fileStream.on("finish", () => {
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
          resolve(publicUrl);
        });
      });

      fileStream.end(file.buffer);
      uploadPromises.push(uploadPromise);
    }

    // Wait for all file uploads to complete
    const urls = await Promise.all(uploadPromises);

    // Send response with public URLs of uploaded videos
    res.status(200).json({ urls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error uploading files" });
  }
});

const PORT = 3000;

app.listen(PORT, console.log("Server run at: ", PORT));
