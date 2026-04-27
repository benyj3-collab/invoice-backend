const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let suppliers = [];
let invoices = [];

/* ---------------- בדיקת חיים ---------------- */
app.get("/", (req,res)=>{
  res.send("SERVER OK");
});

/* ---------------- ספקים ---------------- */
app.get("/suppliers", (req,res)=>{
  res.json(suppliers);
});

app.post("/supplier", (req,res)=>{
  const { name } = req.body;

  if(!name){
    return res.status(400).json({message:"missing name"});
  }

  if(!suppliers.includes(name)){
    suppliers.push(name);
  }

  res.json({ok:true});
});

/* ---------------- העלאה ---------------- */
app.post("/upload", upload.single("file"), (req,res)=>{
  const { supplier, digits, date } = req.body;

  if(!supplier || !digits){
    return res.status(400).json({message:"missing data"});
  }

  // כפילות
  const exists = invoices.find(i =>
    i.supplier === supplier && i.digits === digits
  );

  if(exists){
    return res.status(400).json({
      message:"חשבונית כבר קיימת"
    });
  }

  invoices.push({
    supplier,
    digits,
    date,
    time: new Date().toISOString()
  });

  res.json({ok:true});
});

/* ---------------- חשוב ל-Render ---------------- */
const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
  console.log("server running on", PORT);
});
