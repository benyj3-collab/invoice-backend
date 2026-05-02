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
const upload = multer({ storage: multer.memoryStorage() });

// =====================
const SUPPLIERS_FILE = "./suppliers.json";
const INVOICES_FILE = "./invoices.json";

// ===================== GOOGLE DRIVE =====================
const CLIENT_ID = "901364224480-jh9argoe0lg9s94p3s1hlp1gd3aqnum0.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://invoice-backend-2akp.onrender.com/oauth2callback";

const REFRESH_TOKEN = "1//06XJY22PAx9hLCgYIARAAGAYSNgF-L9IrFc7mcuAO_a_lBDdTPnjGRfUujPnFZ0P6pXsI24VR07bxn-xkixDez4EjjJ_jlbOg8g";

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

const FOLDER_ID = "1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9";

// ===================== FILE HELPERS =====================
function load(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===================== SUPPLIERS =====================
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

// ===================== UPLOAD =====================
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { supplier, digits, date } = req.body;

    if (!supplier || !digits || !req.file) {
      return res.status(400).json({ message: "missing data" });
    }

    let invoices = load(INVOICES_FILE);

    const exists = invoices.find(i =>
      i.supplier === supplier && i.digits === digits
    );

    if (exists) {
      return res.status(400).json({ message: "חשבונית כבר קיימת" });
    }

    // ===================== DRIVE UPLOAD FIX =====================
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

    // ===================== SAVE =====================
    invoices.push({
      supplier,
      digits,
      date,
      fileId,
      time: new Date().toISOString()
    });

    save(INVOICES_FILE, invoices);

    res.json({ ok: true, fileId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "upload failed" });
  }
});

// =====================
app.listen(3000, () => {
  console.log("server running");
});
