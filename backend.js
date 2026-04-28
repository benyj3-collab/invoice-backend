const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "no file" });
  }

  res.json({
    ok: true,
    filename: req.file.originalname,
    size: req.file.size
  });
});
