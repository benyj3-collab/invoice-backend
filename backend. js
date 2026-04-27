const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const upload = multer({ dest: "uploads/" });

let db = {
    suppliers: ["ספק כללי"],
    files: []
};

app.get("/suppliers",(req,res)=>{
    res.json(db.suppliers);
});

app.post("/supplier",(req,res)=>{
    db.suppliers.push(req.body.name);
    res.json({ok:true});
});

app.post("/upload", upload.single("file"), (req,res)=>{
    const {supplier, digits, date} = req.body;

    let month = date.slice(0,7);

    let exists = db.files.find(f =>
        f.supplier === supplier &&
        f.digits === digits &&
        f.month === month
    );

    if(exists){
        return res.json({message:"❌ כבר קיים"});
    }

    let folder = `storage/${supplier}/${month}`;
    fs.mkdirSync(folder, {recursive:true});

    let name = `${date}-${digits}-${supplier}.pdf`;
    let path = `${folder}/${name}`;

    fs.renameSync(req.file.path, path);

    db.files.push({
        supplier,
        digits,
        month,
        path
    });

    res.json({message:"✅ נשמר בהצלחה"});
});

app.listen(3000, ()=>{
    console.log("Server running");
});
