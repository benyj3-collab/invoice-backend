const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// 🔐 חיבור ל-Google Drive (Service Account)
const auth = new google.auth.GoogleAuth({
  keyFile: 'google-drive.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// 📌 ID של התיקיה שלך בדרייב
const FOLDER_ID = '1JOimVxKByqFOqfGWdHC6Qu696Wak2yql';

// 🧪 בדיקת שרת
app.get('/', (req, res) => {
  res.send('Server running ✅');
});

// 🧪 בדיקת העלאה (TEST)
app.get('/upload-test', async (req, res) => {
  try {
    const fileMetadata = {
      name: `test-${Date.now()}.txt`,
      parents: [FOLDER_ID],
    };

    const media = {
      mimeType: 'text/plain',
      body: 'Hello from backend test upload',
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    console.log('Uploaded file ID:', file.data.id);

    res.json({
      success: true,
      fileId: file.data.id,
    });
  } catch (error) {
    console.error('🔥 TEST ERROR:', error);
    res.status(500).send('Upload test failed');
  }
});

// 📤 העלאת קובץ אמיתי
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID],
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    fs.unlinkSync(req.file.path);

    console.log('Uploaded file ID:', file.data.id);

    res.json({
      success: true,
      fileId: file.data.id,
    });

  } catch (error) {
    console.error('🔥 UPLOAD ERROR:', error);
    res.status(500).send('Upload failed');
  }
});

// 🚀 הפעלת שרת
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server running on', PORT);
});
