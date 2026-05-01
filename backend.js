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
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// =====================
// התיקיה שלך בגוגל דרייב
// =====================
const FOLDER_ID = '1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9';

// =====================
// בדיקת שרת
// =====================
app.get('/', (req, res) => {
  res.send('שרת פועל ✅');
});

// =====================
// בדיקת העלאה (TEST)
// =====================
app.get('/upload-test', async (req, res) => {
  try {
    const fileMetadata = {
      name: `test-${Date.now()}.txt`,
      parents: [FOLDER_ID],
    };

    const media = {
      mimeType: 'text/plain',
      body: 'TEST UPLOAD WORKING',
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

  } catch (err) {
    console.error('UPLOAD ERROR:', err.message);
    res.status(500).send('בדיקת ההעלאה נכשלה');
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
      media: media,
      fields: 'id',
    });

    fs.unlinkSync(req.file.path);

    console.log('Uploaded file ID:', file.data.id);

    res.json({
      success: true,
      fileId: file.data.id,
    });

  } catch (err) {
    console.error('UPLOAD ERROR:', err.message);
    res.status(500).send('העלאה נכשלה');
  }
});

// =====================
// הפעלת שרת
// =====================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log('Server running on', PORT);
});
