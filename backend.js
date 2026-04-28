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

/* ================= GOOGLE AUTH ================= */
const auth = new google.auth.GoogleAuth({
  keyFile: "./google-drive.json",
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({ version: "v3", auth });

/* ================= STORAGE ================= */
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ================= SERVER ================= */
app.get("/", (req, res) => {
  res.send("SERVER OK - DRIVE FIXED VERSION");
});

/* ================= PDF + DRIVE ================= */
app.get("/invoice-pdf", (req, res) => {
  const { supplier, invoiceNumber, date } = req.query;

  const doc = new PDFDocument();
  const filePath = path.join(__dirname, `temp-${invoiceNumber}.pdf`);
  const stream = fs.createWriteStream(filePath);

  res.setHeader("Content-Type", "application/pdf");

  doc.pipe(stream);
  doc.pipe(res);

  doc.fontSize(20).text("INVOICE", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).text(`Supplier: ${supplier}`);
  doc.text(`Invoice: ${invoiceNumber}`);
  doc.text(`Date: ${date || new Date().toISOString()}`);

  doc.end();

  stream.on("finish", async () => {
    try {
      const result = await drive.files.create({
        requestBody: {
          name: `invoice-${invoiceNumber}.pdf`,
          mimeType: "application/pdf",
          parents: ["1rSkp1C_u-JuGRIKBUfEzVwsesz2ckI60"]
        },
        media: {
          mimeType: "application/pdf",
          body: fs.createReadStream(filePath)
        }
      });

      console.log("UPLOAD SUCCESS:", result.data);

      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("DRIVE ERROR:", err);
    }
  });
});

/* ================= UPLOAD ================= */
app.post("/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });

  res.json({ ok: true, file: req.file.filename });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
