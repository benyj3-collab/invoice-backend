const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= DATA ================= */
let suppliers = [];
let invoices = [];

/* ================= GOOGLE DRIVE ================= */
const auth = new google.auth.GoogleAuth({
  keyFile: "./google-drive.json",
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({ version: "v3", auth });

/* ================= FILE UPLOAD ================= */
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
  res.send("SERVER OK - FULL SYSTEM + DRIVE");
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
    return res.status(409).json({ error: "invoice exists" });
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

/* ================= UPLOAD ================= */
app.post("/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "no file" });
  }

  res.json({
    ok: true,
    fileName: req.file.filename
  });
});

/* ================= PDF + GOOGLE DRIVE ================= */
app.get("/invoice-pdf", (req, res) => {
  const { supplier, invoiceNumber, date } = req.query;

  if (!supplier || !invoiceNumber) {
    return res.status(400).send("missing data");
  }

  const doc = new PDFDocument();

  const filePath = path.join(__dirname, `temp-${invoiceNumber}.pdf`);
  const stream = fs.createWriteStream(filePath);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=invoice-${invoiceNumber}.pdf`);

  doc.pipe(stream);
  doc.pipe(res);

  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();

  doc.fontSize(14).text(`Supplier: ${supplier}`);
  doc.text(`Invoice Number: ${invoiceNumber}`);
  doc.text(`Date: ${date || new Date().toISOString()}`);

  doc.end();

  stream.on("finish", async () => {
    try {
     await drive.files.create({
  requestBody: {
    name: `invoice-${invoiceNumber}.pdf`,
    parents: ["PASTE_FOLDER_ID_HERE"],
    mimeType: "application/pdf"
  },
  media: {
    mimeType: "application/pdf",
    body: fs.createReadStream(filePath)
  }
});

      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("Drive upload error:", err);
    }
  });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
