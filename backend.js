const express = require("express");
const { google } = require("googleapis");

const app = express();

// =====================
// 🔐 פרטי OAuth
// =====================
const CLIENT_ID = "901364224480-jh9argoe0lg9s94p3s1hlp1gd3aqnum0.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

// חשוב: זה חייב להיות תואם למה שהגדרת ב־Google Cloud
const REDIRECT_URI = "https://invoice-backend-2akp.onrender.com/oauth2callback";

// 👇 כאן אתה שם את ה־refresh token שלך
const REFRESH_TOKEN = "1//06XJY22PAx9hLCgYIARAAGAYSNgF-L9IrFc7mcuAO_a_lBDdTPnjGRfUujPnFZ0P6pXsI24VR07bxn-xkixDez4EjjJ_jlbOg8g";

// =====================
// 🔧 יצירת חיבור OAuth
// =====================
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// פונקציה שמחזירה חיבור Drive תמיד
function getDrive() {
  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN,
  });

  return google.drive({
    version: "v3",
    auth: oauth2Client,
  });
}

// =====================
// 🔗 התחברות (רק אם צריך שוב בעתיד)
// =====================
app.get("/login", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  res.redirect(url);
});

// =====================
// 🔁 callback (לא חובה עכשיו כי כבר יש לך token)
// =====================
app.get("/oauth2callback", async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) return res.send("Missing code");

    const { tokens } = await oauth2Client.getToken(code);

    console.log("NEW REFRESH TOKEN:", tokens.refresh_token);

    res.send("OK - token printed in logs");
  } catch (err) {
    console.error(err);
    res.send("Error in callback");
  }
});

// =====================
// 📤 העלאת קובץ לבדיקה
// =====================
app.get("/upload-test", async (req, res) => {
  try {
    const drive = getDrive();

    const response = await drive.files.create({
      requestBody: {
        name: "test-file.txt",
      },
      media: {
        mimeType: "text/plain",
        body: "Hello from working system 🚀",
      },
    });

    res.send("Uploaded file ID: " + response.data.id);
  } catch (err) {
    console.error(err);
    res.send("Upload failed");
  }
});

// =====================
app.get("/", (req, res) => {
  res.send("Server running ✅");
});

// =====================
app.listen(10000, () => {
  console.log("Server running on port 10000");
});
