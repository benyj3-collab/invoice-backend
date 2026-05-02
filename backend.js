const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");

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
// פונקציות עזר
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

  res.json({ ok: true });
});

// =====================
// העלאה (לוג בלבד - כמו שהיה אצלך)
// =====================
app.post("/upload", upload.single("file"), (req, res) => {
  const { supplier, digits, date } = req.body;

  if (!supplier || !digits) {
    return res.status(400).json({ message: "missing data" });
  }

  let invoices = load(INVOICES_FILE);

  const exists = invoices.find(i =>
    i.supplier === supplier &&
    i.digits === digits
  );

  if (exists) {
    return res.status(400).json({
      message: "חשבונית כבר קיימת למספר הזה"
    });
  }

  invoices.push({
    supplier,
    digits,
    date,
    time: new Date().toISOString()
  });

  save(INVOICES_FILE, invoices);

  res.json({ ok: true });
});

// =====================
app.listen(3000, () => {
  console.log("server running");
});
