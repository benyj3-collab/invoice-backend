const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

/* ---------------- זיכרון זמני ---------------- */
let suppliers = [];
let invoices = [];

/* ---------------- בדיקת חיים ---------------- */
app.get("/", (req, res) => {
  res.send("SERVER OK - ALL IN ONE");
});

/* ---------------- ספקים ---------------- */
app.get("/suppliers", (req, res) => {
  res.json(suppliers);
});

app.post("/supplier", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "missing name" });
  }

  if (!suppliers.includes(name)) {
    suppliers.push(name);
  }

  res.json({ ok: true, suppliers });
});

/* ---------------- חשבוניות ---------------- */
app.post("/invoice", upload.single("file"), (req, res) => {
  const { supplier, invoiceNumber, date } = req.body;

  if (!supplier || !invoiceNumber) {
    return res.status(400).json({ error: "missing data" });
  }

  // בדיקת כפילות
  const exists = invoices.find(
    (i) => i.supplier === supplier && i.invoiceNumber === invoiceNumber
  );

  if (exists) {
    return res.status(409).json({
      error: "חשבונית כבר קיימת למספר הזה"
    });
  }

  const newInvoice = {
    supplier,
    invoiceNumber,
    date: date || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  invoices.push(newInvoice);

  res.json({
    ok: true,
    invoice: newInvoice
  });
});

/* ---------------- רשימת חשבוניות ---------------- */
app.get("/invoices", (req, res) => {
  res.json(invoices);
});

/* ---------------- שרת ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
