const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

/* ================= DATA ================= */
let suppliers = [];
let invoices = [];

/* ================= SERVER CHECK ================= */
app.get("/", (req, res) => {
  res.send("SERVER OK - STEP 1 WORKING");
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
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "no file" });
  }

  res.json({
    ok: true,
    fileName: req.file.originalname,
    size: req.file.size
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
