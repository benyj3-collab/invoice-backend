let invoices = [];

/* ===== חשבוניות ===== */

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

// רשימת חשבוניות
app.get("/invoices", (req, res) => {
  res.json(invoices);
});
