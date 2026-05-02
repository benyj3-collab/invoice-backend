const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
const upload = multer({ dest: 'uploads/' });

// =====================
// OAuth (מה שכבר עבד לך)
// =====================
const CLIENT_ID = '901364224480-jh9argoe0lg9s94p3s1hlp1gd3aqnum0.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://invoice-backend-2akp.onrender.com/oauth2callback';

// 👇 זה הטוקן שקיבלת (refresh token)
const REFRESH_TOKEN = 'PUT_YOUR_REFRESH_TOKEN_HERE';

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});

const drive = google.drive({
  version: 'v3',
  auth: oAuth2Client,
});

// =====================
// 🔥 התיקייה שלך (זה מה שחסר לך)
// =====================
const FOLDER_ID = '1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9';

// =====================
app.get('/', (req, res) => {
  res.send('Server OK');
});

// =====================
// בדיקת העלאה
// =====================
app.get('/upload-test', async (req, res) => {
  try {
    const fileMetadata = {
      name: `test-${Date.now()}.txt`,
      parents: [FOLDER_ID], // 🔥 זה הפתרון שלך
    };

    const media = {
      mimeType: 'text/plain',
      body: 'TEST FILE',
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id',
    });

    res.json({
      success: true,
      fileId: file.data.id,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('upload failed');
  }
});

// =====================
// העלאת קובץ אמיתי
// =====================
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID], // 🔥 גם כאן
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id',
    });

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      fileId: file.data.id,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('upload failed');
  }
});

// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server running on', PORT);
});
