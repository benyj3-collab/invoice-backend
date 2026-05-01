const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// התחברות ל-Google Drive דרך הקובץ שלך
const auth = new google.auth.GoogleAuth({
  keyFile: 'google-drive.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

// העלאת קובץ ל-Drive
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: ['1JOimVxKByqFOqfGWdHC6Qu696Wak2yql'], // ID של התיקיה שלך
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
    res.send('File uploaded: ' + file.data.id);

  } catch (error) {
    console.error('🔥 DRIVE ERROR:', error);
    res.status(500).send('Upload failed');
  }
});

// בדיקה פשוטה
app.get('/', (req, res) => {
  res.send('Server running ✅');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Server running on', PORT);
});
