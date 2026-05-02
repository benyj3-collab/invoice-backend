const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// =====================
// קבצי שמירה
// =====================
const SUPPLIERS_FILE = "./suppliers.json";
const INVOICES_FILE = "./invoices.json";

// =====================
// OAuth Google Drive
// =====================
const CLIENT_ID = "901364224480-jh9argoe0lg9s94p3s1hlp1gd3aqnum0.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://invoice-backend-2akp.onrender.com/oauth2callback";

const REFRESH_TOKEN = "1//06XJY22PAx9hLCgYIARAAGAYSNgF-L9IrFc7mcuAO_a_lBDdTPnjGRfUujPnFZ0P6pXsI24VR07bxn-xkixDez4EjjJ_jlbOg8g";

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({
  refresh_token: REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

// 📁 תיקייה בדרייב
const FOLDER_ID = "1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9";

// =====================
// פונקציות קבצים
// =====================
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// =====================
// ספקים
// =====================
app.get("/suppliers", (req, res) => {
  res.json(load(SUPPLIERS_FILE));
});

app.post("/supplier", (req, res) => {
  const { name } = req.body;

  if (!name) return res.status(400).json({ message: "missing name" });

  let suppliers = load(SUPPLIERS_FILE);

  if (!suppliers.includes(name)) {
    suppliers.push(name);
    save(SUPPLIERS_FILE, suppliers);
  }

  res.json({ ok: true });
});

// =====================
// העלאה + Drive
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { supplier, digits, date } = req.body;

    if (!supplier || !digits) {
      return res.status(400).json({ message: "missing data" });
    }

    let invoices = load(INVOICES_FILE);

    const exists = invoices.find(i =>
      i.supplier === supplier && i.digits === digits
    );

    if (exists) {
      return res.status(400).json({ message: "חשבונית כבר קיימת" });
    }

    // =====================
    // העלאה ל-Google Drive
    // =====================
    let fileId = null;

    if (req.file) {
      const fileMetadata = {
        name: `${supplier}-${digits}-${Date.now()}`,
        parents: [FOLDER_ID],
      };

      const media = {
        mimeType: req.file.mimetype,
        body: Buffer.from(req.file.buffer),
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id",
      });

      fileId = file.data.id;
    }

    // =====================
    // שמירה ל-JSON
    // =====================
    invoices.push({
      supplier,
      digits,
      date,
      fileId,
      time: new Date().toISOString()
    });

    save(INVOICES_FILE, invoices);

    res.json({
      ok: true,
      fileId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "upload failed" });
  }
});

// =====================
app.listen(3000, () => {
  console.log("server running");
});
