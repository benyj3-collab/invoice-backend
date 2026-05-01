const express = require("express");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();

app.use(express.json());

// ====== CONFIG (שים ב Render ENV או מקומית) ======
const CLIENT_ID = process.env.CLIENT_IDconst express = require("express");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();
const PORT = process.env.PORT || 10000;

// Service Account auth
const auth = new google.auth.GoogleAuth({
  keyFile: "google-drive.json",
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

// תיקיית דרייב שלך
const FOLDER_ID = "1JOimVxKByqFOqfGWdHC6Qu696Wak2yql";

app.get("/", (req, res) => {
  res.send("Server running OK");
});

app.get("/upload-test", async (req, res) => {
  try {
    // יוצר קובץ זמני אם אין לך
    const filePath = "./test.txt";
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "Hello from server");
    }

    const fileMetadata = {
      name: `file-${Date.now()}.txt`,
      parents: [FOLDER_ID],
    };

    const media = {
      mimeType: "text/plain",
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log("Uploaded file ID:", response.data.id);

    res.send({
      status: "OK",
      fileId: response.data.id,
      link: `https://drive.google.com/file/d/${response.data.id}/view`,
    });
  } catch (err) {
    console.error("DRIVE ERROR:", err);
    res.status(500).send("Upload failed");
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// ====== OAuth CLIENT ======
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

// ====== TEST ROUTE ======
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// ====== UPLOAD FILE (TEST) ======
app.get("/upload-test", async (req, res) => {
  try {
    const fileMetadata = {
      name: "test-file.txt",
    };

    const media = {
      mimeType: "text/plain",
      body: fs.createReadStream("./test.txt"),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    res.json({
      success: true,
      fileId: response.data.id,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).send("Upload failed");
  }
});

// ====== START SERVER ======
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
