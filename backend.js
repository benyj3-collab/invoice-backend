const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { google } = require("googleapis");
const stream = require("stream");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const SUPPLIERS_FILE = "./suppliers.json";
const INVOICES_FILE = "./invoices.json";
const FOLDERS_FILE = "./folders.json"; // 🔥 חדש

// ===== GOOGLE =====
const CLIENT_ID = "YOUR_CLIENT_ID";
const CLIENT_SECRET = "YOUR_SECRET";
const REDIRECT_URI = "YOUR_REDIRECT";
const REFRESH_TOKEN = "YOUR_REFRESH_TOKEN";

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client
});

const ROOT_FOLDER_ID = "1OLhekPhsvTQF3m4gQq0f38OM_mECIdA9";

// ===== FILE HELPERS =====
function load(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ===== תיקיית ספק לפי ID (יציב!) =====
async function getSupplierFolder(supplier) {
  let folders = load(FOLDERS_FILE);

  // כבר קיים
  if (folders[supplier]) {
    return folders[supplier];
  }

  // יצירה חדשה
  const folder = await drive.files.create({
    requestBody: {
      name: supplier,
      mimeType: "application/vnd.google-apps.folder",
      parents: [ROOT_FOLDER_ID]
    },
    fields: "id"
  });

  folders[supplier] = folder.data.id;
  save(FOLDERS_FILE, folders);

  console.log("📁 created folder:", supplier);

  return folder.data.id;
}

// ===== ספקים =====
app.get("/suppliers", (req, res) => {
  let data = load(SUPPLIERS_FILE);
  if (!Array.isArray(data)) data = [];
  res.json(data);
});

app.post("/supplier", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "missing name" });
  }

  let suppliers = load(SUPPLIERS_FILE);
  if (!Array.isArray(suppliers)) suppliers = [];

  if (!suppliers.includes(name)) {
    suppliers.push(name);
    save(SUPPLIERS_FILE, suppliers);
  }

  console.log("✔ supplier saved:", name);

  res.json({ ok: true });
});

// ===== העלאה =====
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { supplier, digits, date } = req.body;

    if (!supplier || !digits || !req.file) {
      return res.status(400).json({ message: "missing data" });
    }

    let invoices = load(INVOICES_FILE);
    if (!Array.isArray(invoices)) invoices = [];

    const exists = invoices.find(i =>
      i.supplier === supplier && i.digits === digits
    );

    if (exists) {
      return res.status(400).json({ message: "כבר קיים" });
    }

    // 🔥 תיקיית ספק יציבה
    const folderId = await getSupplierFolder(supplier);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const response = await drive.files.create({
      requestBody: {
        name: `${supplier}-${digits}-${Date.now()}.pdf`,
        parents: [folderId]
      },
      media: {
        mimeType: req.file.mimetype,
        body: bufferStream
      },
      fields: "id"
    });

    const fileId = response.data.id;

    invoices.push({
      supplier,
      digits,
      date,
      fileId
    });

    save(INVOICES_FILE, invoices);

    console.log("✔ uploaded:", fileId);

    res.json({ ok: true });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.status(500).json({ message: "upload failed" });
  }
});

app.listen(3000, () => {
  console.log("server running");
});
