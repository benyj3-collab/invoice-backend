let suppliers = [];

/* ===== ספקים ===== */

// קבלת כל הספקים
app.get("/suppliers", (req, res) => {
  res.json(suppliers);
});

// הוספת ספק חדש
app.post("/suppliers", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "missing name" });
  }

  if (suppliers.includes(name)) {
    return res.status(409).json({ error: "supplier already exists" });
  }

  suppliers.push(name);

  res.json({
    ok: true,
    suppliers
  });
});
