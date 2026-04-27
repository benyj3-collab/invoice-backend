const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let suppliers = [];
let invoices = [];

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

  // 🔥 בדיקת כפילות אמיתית
  const exists = invoices.find(i =>
    i.supplier === supplier &&
    i.digits === digits
  );

  if(exists){
    return res.status(400).json({
      message:"חשבונית כבר קיימת למספר הזה"
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

app.listen(3000, ()=>{
  console.log("server running");
});
