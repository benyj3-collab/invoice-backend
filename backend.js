const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { google } = require("googleapis");
const stream = require("stream");

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// Multer
// =====================
const upload = multer({ storage: multer.memoryStorage() });

// =====================
// קבצים מקומיים
// =====================
const SUPPLIERS_FILE = "./suppliers.json";
const INVOICES_FILE = "./invoices.json";

// =====================
// Google Drive
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
  refresh_token: REFRESH_TOKEN
});

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client
});

const FOLDER_ID = "1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9";

// =====================
// Helpers
// =====================
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// =====================
// LOG כללי (חשוב לדיבוג)
// =====================
app.use((req, res, next) => {
  console.log("➡️", req.method, req.url);
  next();
});

// =====================
// ספקים
// =====================
app.get("/suppliers", (req, res) => {
  const data = load(SUPPLIERS_FILE);
  res.json(data);
});

app.post("/supplier", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "missing name" });
  }

  let suppliers = load(SUPPLIERS_FILE);

  if (!suppliers.includes(name)) {
    suppliers.push(name);
    save(SUPPLIERS_FILE, suppliers);
  }

  console.log("✔ supplier saved:", name);

  res.json({ ok: true });
});

// =====================
// העלאה + Drive
// =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { supplier, digits, date } = req.body;

    if (!supplier || !digits || !req.file) {
      console.log("❌ missing data");
      return res.status(400).json({ message: "missing data" });
    }

    let invoices = load(INVOICES_FILE);

    const exists = invoices.find(i =>
      i.supplier === supplier && i.digits === digits
    );

    if (exists) {
      return res.status(400).json({ message: "already exists" });
    }

    // =====================
    // Upload Drive
    // =====================
    let fileId = null;

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const response = await drive.files.create({
      requestBody: {
        name: `${supplier}-${digits}-${Date.now()}`,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: req.file.mimetype,
        body: bufferStream,
      },
      fields: "id",
    });

    fileId = response.data.id;

    console.log("✔ uploaded to drive:", fileId);

    // =====================
    // Save invoice
    // =====================
    invoices.push({
      supplier,
      digits,
      date,
      fileId,
      time: new Date().toISOString()
    });

    save(INVOICES_FILE, invoices);

    console.log("✔ invoice saved");

    res.json({
      ok: true,
      fileId
    });

  } catch (err) {
    console.error("❌ upload error:", err.message);
    res.status(500).json({ message: "upload failed" });
  }
});

// =====================
app.listen(3000, () => {
  console.log("server running");
});
