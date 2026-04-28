const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DATA ================= */
let suppliers = [];
let invoices = [];

/* ================= UPLOAD SETUP ================= */
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

/* ================= SERVER CHECK ================= */
app.get("/", (req, res) => {
  res.send("SERVER OK - FULL SYSTEM READY");
});

/* ================= SUPPLIERS ================= */
app.get("/suppliers", (req, res) => {
  res.json(suppliers);
});

app.post("/suppliers", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "missing name" });
  }

  if (suppliers.includes(name)) {
    return res.status(409).json({ error: "supplier exists" });
  }

  suppliers.push(name);

  res.json({ ok: true, suppliers });
});

/* ================= INVOICES ================= */
app.post("/invoices", (req, res) => {
  const { supplier, invoiceNumber, date } = req.body;

  if (!supplier || !invoiceNumber) {
    return res.status(400).json({ error: "missing data" });
  }

  const exists = invoices.find(
    (i) => i.supplier === supplier && i.invoiceNumber === invoiceNumber
  );

  if (exists) {
    return res.status(409).json({ error: "invoice already exists" });
  }

  const invoice = {
    supplier,
    invoiceNumber,
    date: date || new Date().toISOString()
  };

  invoices.push(invoice);

  res.json({ ok: true, invoice });
});

app.get("/invoices", (req, res) => {
  res.json(invoices);
});

/* ================= FILE UPLOAD ================= */
app.post("/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "no file uploaded" });
  }

  res.json({
    ok: true,
    message: "file saved",
    fileName: req.file.filename,
    path: req.file.path
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
