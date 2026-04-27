const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: "*"
}));

app.use(express.json());
