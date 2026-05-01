const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { google } = require('googleapis');

const app = express();
const upload = multer({ dest: 'uploads/' });

// =====================
// Google Drive Auth
// =====================
const auth = new google.auth.GoogleAuth({
  keyFile: 'google-drive.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// =====================
// תיקייה ב-Drive
// =====================
const FOLDER_ID = '1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9';

// =====================
// בדיקת שרת
// =====================
app.get('/', (req, res) => {
  res.send('Server OK');
});

// =====================
// בדיקת חיבור ל-Drive
// =====================
app.get('/debug-drive', async (req, res) => {
  try {
    const result = await drive.files.list({
      pageSize: 1,
      fields: 'files(id, name)',
    });

    res.json({ ok: true, files: result.data.files });

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// =====================
// בדיקת העלאה
// =====================
app.get('/upload-test', async (req, res) => {
  try {
    const fileMetadata = {
      name: `test-${Date.now()}.txt`,
      parents: [FOLDER_ID],
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

    res.json({ success: true, fileId: file.data.id });

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
      parents: [FOLDER_ID],
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

    res.json({ success: true, fileId: file.data.id });

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
