const express = require("express");
const { google } = require("googleapis");

const app = express();

const CLIENT_ID = "901364224480-jh9argoe0lg9s94p3s1hlp1gd3aqnum0.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://invoice-backend-2akp.onrender.com/oauth2callback";

let REFRESH_TOKEN = ""; // נשמר אחרי התחברות

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// התחברות
app.get("/login", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  res.redirect(url);
});

// callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;

  const { tokens } = await oauth2Client.getToken(code);

  REFRESH_TOKEN = tokens.refresh_token;

  oauth2Client.setCredentials(tokens);

  console.log("REFRESH TOKEN SAVED:", REFRESH_TOKEN);

  res.send("OK - Google Drive connected");
});

// פונקציה שמייצרת Drive בכל בקשה
function getDrive() {
  if (!REFRESH_TOKEN) return null;

  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

// בדיקה
app.get("/upload-test", async (req, res) => {
  try {
    const drive = getDrive();
    if (!drive) return res.send("Not connected - go to /login");

    const response = await drive.files.create({
      requestBody: {
        name: "test-file.txt",
      },
      media: {
        mimeType: "text/plain",
        body: "Hello from Render fixed version",
      },
    });

    res.send("Uploaded file ID: " + response.data.id);
  } catch (err) {
    console.error(err);
    res.send("Upload failed");
  }
});

app.get("/", (req, res) => {
  res.send("Server running");
});

app.listen(10000, () => {
  console.log("Server running on 10000");
});
