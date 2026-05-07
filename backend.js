// ============================================================
//  Code_v4.gs  — חשבוניות מירב
//  פיצ'רים: updatePayment, renameSupplier, status filter, multi-supplier, amount, category, invoiceNum
// ============================================================

var MAIN_FOLDER_NAME = "חשבוניות מירב";
var SHEET_NAME       = "חשבוניות";

var COL = {
  DATE_UPLOAD:0,SUPPLIER:1,DIGITS:2,DATE_INV:3,FILE_URL:4,
  PAYMENT:5,AMOUNT:6,PAY_AMOUNT:7,PAY_AMOUNT2:8,
  CHECK_NUM:9,CHECK_NUM2:10,CHECK_DATE:11,CHECK_DATE2:12,
  PAID:13,INV_NUM:14,CATEGORY:15
};

function setCors(output){return output.setMimeType(ContentService.MimeType.JSON);}

function doGet(e){
  try{
    var action=e.parameter.action||"";
    var result;
    if(action==="getSuppliers")result=getSuppliers();
    else if(action==="getInvoices")result=getInvoices(e.parameter);
    else if(action==="sendReport")result=sendReport(e.parameter);
    else result={success:false,error:"unknown: "+action};
    var json=JSON.stringify(result);
    var cb=e.parameter.callback;
    if(cb)return ContentService.createTextOutput(cb+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
    return setCors(ContentService.createTextOutput(json));
  }catch(err){
    var ej=JSON.stringify({success:false,error:err.toString()});
    var cb2=e.parameter&&e.parameter.callback;
    if(cb2)return ContentService.createTextOutput(cb2+"("+ej+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
    return setCors(ContentService.createTextOutput(ej));
  }
}

function doPost(e){
  try{
    var data=JSON.parse(e.postData.contents);
    var result;
    if(data.action==="uploadInvoice")result=uploadInvoice(data);
    else if(data.action==="updatePayment")result=updatePayment(data);
    else if(data.action==="renameSupplier")result=renameSupplier(data);
    else if(data.action==="deleteSupplier")result=deleteSupplier(data);
    else if(data.action==="sendReport")result=sendReport(data);
    else if(data.action==="sendPDF")result=sendPDF(data);
    else result={success:false,error:"unknown: "+data.action};
    return setCors(ContentService.createTextOutput(JSON.stringify(result)));
  }catch(err){
    return setCors(ContentService.createTextOutput(JSON.stringify({success:false,error:err.toString()})));
  }
}

function getMainFolder(){
  var it=DriveApp.getFoldersByName(MAIN_FOLDER_NAME);
  if(it.hasNext())return it.next();
  return DriveApp.createFolder(MAIN_FOLDER_NAME);
}
function getSupplierFolder(name){
  var main=getMainFolder();
  var it=main.getFoldersByName(name);
  if(it.hasNext())return it.next();
  return main.createFolder(name);
}

function getSheet(){
  var ss=getOrCreateSpreadsheet();
  var sh=ss.getSheetByName(SHEET_NAME);
  if(!sh){
    sh=ss.insertSheet(SHEET_NAME);
    sh.appendRow(["תאריך_העלאה","ספק","ספרות","תאריך_חשבונית","קישור_קובץ","תשלום","סכום_חשבונית","סכום_תשלום","סכום_תשלום2","מספר_צ'ק","מספר_צ'ק2","תאריך_צ'ק","תאריך_צ'ק2","שולם","מספר_חשבונית","קטגוריה"]);
  }
  return sh;
}
function getOrCreateSpreadsheet(){
  var main=getMainFolder();
  var it=main.getFilesByName("נתוני חשבוניות מירב");
  if(it.hasNext())return SpreadsheetApp.open(it.next());
  var ss=SpreadsheetApp.create("נתוני חשבוניות מירב");
  DriveApp.getFileById(ss.getId()).moveTo(main);
  return ss;
}

function getSuppliers(){
  var sh=getSheet();
  var data=sh.getDataRange().getValues();
  var m={};
  for(var i=1;i<data.length;i++){var s=data[i][COL.SUPPLIER];if(s)m[s]=1;}
  var subs=getMainFolder().getFolders();
  while(subs.hasNext())m[subs.next().getName()]=1;
  return{success:true,suppliers:Object.keys(m).sort()};
}

function uploadInvoice(data){
  var sh=getSheet();
  var rows=sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++){
    if(rows[i][COL.SUPPLIER]===data.supplier&&String(rows[i][COL.DIGITS])===String(data.digits))
      return{success:false,duplicate:true};
  }
  var folder=getSupplierFolder(data.supplier);
  var fileUrl="";
  if(data.pages&&data.pages.length>0){
    var fileName=data.supplier+"_"+data.digits+"_"+data.date;
    if(data.pages.length===1){
      var blob=Utilities.newBlob(Utilities.base64Decode(data.pages[0]),(data.mimeTypes&&data.mimeTypes[0])||"image/jpeg",fileName+".jpg");
      var file=folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      fileUrl=file.getUrl();
    }else{
      var pdf=createPdfFromImages(data.pages,data.mimeTypes,fileName);
      var pdfFile=folder.createFile(pdf);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      fileUrl=pdfFile.getUrl();
    }
  }
  var payStr=buildPayStr(data);
  var isPaid=(data.payment&&data.payment!=="")?"כן":"";
  sh.appendRow([new Date(),data.supplier,data.digits,data.date,fileUrl,payStr,data.amount||"",data.payAmount||"",data.payAmount2||"",data.checkNum||"",data.checkNum2||"",data.checkDate||"",data.checkDate2||"",isPaid,data.invoiceNum||"",data.category||""]);
  return{success:true,fileUrl:fileUrl,invoiceNum:data.invoiceNum};
}

function updatePayment(data){
  var sh=getSheet();
  var rows=sh.getDataRange().getValues();
  var parts=String(data.rowId||"").split("|");
  var supplier=parts[0],digits=parts[1];
  for(var i=1;i<rows.length;i++){
    if(String(rows[i][COL.SUPPLIER])===supplier&&String(rows[i][COL.DIGITS])===digits){
      var rn=i+1;
      var payStr=buildPayStr(data);
      // תיקון: unpaid = לא שולם, שאר = שולם
      var isPaid=(data.payment&&data.payment!==""&&data.payment!=="unpaid")?"כן":"";
      sh.getRange(rn,COL.PAYMENT+1).setValue(payStr);
      sh.getRange(rn,COL.PAY_AMOUNT+1).setValue(data.payAmount||"");
      sh.getRange(rn,COL.PAY_AMOUNT2+1).setValue(data.payAmount2||"");
      sh.getRange(rn,COL.CHECK_NUM+1).setValue(data.checkNum||"");
      sh.getRange(rn,COL.CHECK_NUM2+1).setValue(data.checkNum2||"");
      sh.getRange(rn,COL.CHECK_DATE+1).setValue(data.checkDate||"");
      sh.getRange(rn,COL.CHECK_DATE2+1).setValue(data.checkDate2||"");
      sh.getRange(rn,COL.PAID+1).setValue(isPaid);
      // עדכן סכום אם סופק
      if(data.amtTotal) sh.getRange(rn,COL.AMOUNT+1).setValue(data.amtTotal);
      return{success:true};
    }
  }
  return{success:false,error:"חשבונית לא נמצאה"};
}

function deleteSupplier(data){
  // מסיר את הספק מהתיקיות (לא מוחק את הקבצים)
  var name=data.supplier;
  if(!name)return{success:false,error:"חסר שם ספק"};
  // שינוי שם התיקיה כדי לסמן כ"מחוק" — לא מוחק לצמיתות
  var it=getMainFolder().getFoldersByName(name);
  if(it.hasNext()){
    var f=it.next();
    f.setName("_מחוק_"+name);
  }
  return{success:true};
}

function renameSupplier(data){
  var oldName=data.oldName,newName=data.newName||data.oldName,cat=data.category||"";
  if(!oldName)return{success:false,error:"חסרים פרטים"};
  var sh=getSheet();
  var rows=sh.getDataRange().getValues();
  var count=0;
  for(var i=1;i<rows.length;i++){
    if(rows[i][COL.SUPPLIER]===oldName){
      sh.getRange(i+1,COL.SUPPLIER+1).setValue(newName);
      if(cat) sh.getRange(i+1,COL.CATEGORY+1).setValue(cat);
      count++;
    }
  }
  if(newName!==oldName){
    var it=getMainFolder().getFoldersByName(oldName);
    if(it.hasNext())it.next().setName(newName);
  }
  return{success:true,updated:count};
}

function getInvoices(params){
  var supplierParam=params.supplier||"all";
  var dateFrom=params.dateFrom||"";
  var dateTo=params.dateTo||"";
  var statusFilter=params.status||params.paidFilter||"all";
  var catFilter=params.category||"all";
  var supplierList=supplierParam==="all"?[]:supplierParam.split(",").map(function(s){return s.trim();});
  var sh=getSheet();
  var rows=sh.getDataRange().getValues();
  var out=[];
  for(var i=1;i<rows.length;i++){
    var r=rows[i];
    var sup=String(r[COL.SUPPLIER]||"");
    // תיקון תאריך: אם זה Date object המר ל-YYYY-MM-DD
    var rawDate=r[COL.DATE_INV];
    var date="";
    if(rawDate instanceof Date){
      date=Utilities.formatDate(rawDate,Session.getScriptTimeZone(),"yyyy-MM-dd");
    } else {
      date=String(rawDate||"").substring(0,10);
    }
    var payment=String(r[COL.PAYMENT]||"");
    var paidCell=String(r[COL.PAID]||"");
    var isPaid=paidCell==="כן"||(payment&&payment!==""&&payment!=="טרם שולם"&&payment!=="unpaid");
    if(supplierList.length>0&&supplierList.indexOf(sup)===-1)continue;
    if(dateFrom&&date<dateFrom)continue;
    if(dateTo&&date>dateTo)continue;
    if(statusFilter==="paid"&&!isPaid)continue;
    if(statusFilter==="unpaid"&&isPaid)continue;
    if(catFilter&&catFilter!=="all"&&String(r[COL.CATEGORY]||"")!==catFilter)continue;
    out.push({
      rowId:sup+"|"+String(r[COL.DIGITS]||""),
      supplier:sup,digits:String(r[COL.DIGITS]||""),date:date,
      fileUrl:String(r[COL.FILE_URL]||""),payment:payment,
      amtTotal:String(r[COL.AMOUNT]||""),amtBefore:"",
      payAmount:String(r[COL.PAY_AMOUNT]||""),payAmount2:String(r[COL.PAY_AMOUNT2]||""),
      checkNum:String(r[COL.CHECK_NUM]||""),checkNum2:String(r[COL.CHECK_NUM2]||""),
      checkDate:String(r[COL.CHECK_DATE]||""),checkDate2:String(r[COL.CHECK_DATE2]||""),
      amount:String(r[COL.AMOUNT]||""),
      invoiceNum:String(r[COL.INV_NUM]||""),invNum:String(r[COL.INV_NUM]||""),
      category:String(r[COL.CATEGORY]||""),paid:isPaid
    });
  }
  out.reverse();
  return{success:true,invoices:out};
}

function sendReport(params){
  var email=params.email||"";
  var inv=getInvoices({supplier:params.supplier||"all",dateFrom:params.dateFrom||"",dateTo:params.dateTo||"",status:params.status||"all"});
  if(!inv.success)return inv;
  var total=0,paidTotal=0,cashTotal=0,checkTotal=0,bankTotal=0;
  inv.invoices.forEach(function(i){
    var amt=parseFloat(i.amtTotal)||0;
    total+=amt;
    var pm=String(i.payment||"");
    if(i.paid){
      paidTotal+=amt;
      if(pm.indexOf("מזומן")!==-1)cashTotal+=amt;
      else if(pm.indexOf("צ'ק")!==-1||pm.indexOf("צק")!==-1)checkTotal+=amt;
      else if(pm.indexOf("העברה")!==-1)bankTotal+=amt;
    }
  });

  // HTML email
  var html='<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">';
  html+='<div style="background:linear-gradient(135deg,#6c3eb8,#8b5cf6);padding:20px;border-radius:12px 12px 0 0;text-align:center;">';
  html+='<h1 style="color:#fff;margin:0;font-size:22px;">🧾 דוח חשבוניות מירב</h1>';
  html+='<p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px;">'+(params.dateFrom||"—")+" עד "+(params.dateTo||"—")+'</p>';
  html+='</div>';
  html+='<div style="background:#f3eeff;padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
  html+='<div style="background:#fff;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:900;color:#6c3eb8;">'+inv.invoices.length+'</div><div style="font-size:11px;color:#9d8ec4;">חשבוניות</div></div>';
  html+='<div style="background:#fff;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:18px;font-weight:900;color:#d97706;">₪'+total.toFixed(2)+'</div><div style="font-size:11px;color:#9d8ec4;">סה"כ</div></div>';
  html+='<div style="background:#dcfce7;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:13px;font-weight:700;color:#16a34a;">💵 ₪'+cashTotal.toFixed(2)+'</div><div style="font-size:10px;color:#16a34a;">מזומן</div></div>';
  html+='<div style="background:#dbeafe;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:13px;font-weight:700;color:#2563eb;">📄 ₪'+checkTotal.toFixed(2)+'</div><div style="font-size:10px;color:#2563eb;">צ׳קים</div></div>';
  html+='<div style="background:#ccfbf1;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:13px;font-weight:700;color:#0d9488;">🏦 ₪'+bankTotal.toFixed(2)+'</div><div style="font-size:10px;color:#0d9488;">העברות</div></div>';
  html+='<div style="background:#fee2e2;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:13px;font-weight:700;color:#dc2626;">⏳ ₪'+(total-paidTotal).toFixed(2)+'</div><div style="font-size:10px;color:#dc2626;">טרם שולם</div></div>';
  html+='</div>';
  html+='<table style="width:100%;border-collapse:collapse;background:#fff;">';
  html+='<tr style="background:#6c3eb8;color:#fff;font-size:12px;"><th style="padding:8px;text-align:right;">ספק</th><th style="padding:8px;">תאריך</th><th style="padding:8px;">₪</th><th style="padding:8px;">תשלום</th></tr>';
  inv.invoices.forEach(function(i,n){
    var bg=n%2===0?"#fff":"#f7f3ff";
    var statusColor=i.paid?"#16a34a":"#dc2626";
    var statusIcon=i.paid?"✅":"⏳";
    html+='<tr style="background:'+bg+';">';
    html+='<td style="padding:8px;font-weight:700;font-size:13px;">'+i.supplier+(i.invNum?" <span style='color:#6c3eb8;'>#"+i.invNum+"</span>":"")+'</td>';
    html+='<td style="padding:8px;font-size:12px;text-align:center;">'+i.date+'</td>';
    html+='<td style="padding:8px;font-weight:700;text-align:center;">₪'+(i.amtTotal?parseFloat(i.amtTotal).toFixed(2):"—")+'</td>';
    html+='<td style="padding:8px;font-size:11px;color:'+statusColor+';text-align:center;">'+statusIcon+' '+(i.payment||"טרם שולם")+'</td>';
    html+='</tr>';
  });
  html+='<tr style="background:#6c3eb8;color:#fff;font-weight:700;"><td colspan="2" style="padding:8px;">סה"כ</td><td style="padding:8px;text-align:center;">₪'+total.toFixed(2)+'</td><td></td></tr>';
  html+='</table></div>';

  MailApp.sendEmail({
    to:email,
    subject:"דוח חשבוניות מירב — "+new Date().toLocaleDateString("he-IL"),
    htmlBody:html
  });
  return{success:true,message:"הדוח נשלח ל-"+email};
}

function buildPayStr(data){
  if(!data.payment||data.payment===""||data.payment==="unpaid")return"טרם שולם";
  if(data.payment==="cash")  return"💵 מזומן ₪"+(data.payAmount||"");
  if(data.payment==="check") return"📄 צ'ק #"+(data.checkNum||"")+" ₪"+(data.payAmount||"")+(data.checkDate?" ("+data.checkDate+")":"");
  if(data.payment==="both")  return"🔀 מזומן ₪"+(data.payAmount||"")+" + צ'ק #"+(data.checkNum2||"")+" ₪"+(data.payAmount2||"");
  if(data.payment==="bank")  return"🏦 העברה #"+(data.checkNum||"")+" ₪"+(data.payAmount||"");
  return String(data.payment);
}


// ============================================================
//  sendPDF — שולח PDF אחד מאוחד עם כל החשבוניות למייל
// ============================================================
function sendPDF(data) {
  var email      = data.email    || "";
  var supplier   = data.supplier || "all";
  var dateFrom   = data.dateFrom || "";
  var dateTo     = data.dateTo   || "";

  if (!email) return { success:false, error:"חסר מייל" };

  // שלב 1: קבל רשימת חשבוניות
  var inv = getInvoices({ supplier:supplier, dateFrom:dateFrom, dateTo:dateTo, status:"all" });
  if (!inv.success || !inv.invoices.length) {
    return { success:false, error:"לא נמצאו חשבוניות לסינון זה" };
  }

  var invoices = inv.invoices;
  var total = 0;
  invoices.forEach(function(i){ total += parseFloat(i.amtTotal)||0; });
  var totalPaid = invoices.filter(function(i){ return i.paid; }).length;

  // שלב 2: בנה HTML מלא עבור PDF
  var html = buildPdfHtml(invoices, supplier, dateFrom, dateTo, total, totalPaid);

  // שלב 3: צור PDF מה-HTML
  var blob = Utilities.newBlob(html, "text/html", "report.html");
  var pdf  = blob.getAs("application/pdf");
  var supLabel = supplier === "all" ? "כל הספקים" : supplier.replace(/,/g," ");
  var dateLabel = (dateFrom||"הכל") + "_" + (dateTo||"הכל");
  pdf.setName("חשבוניות_מירב_" + supLabel + "_" + dateLabel + ".pdf");

  // שלב 4: שלח במייל עם PDF מצורף
  var subject = "חשבוניות מירב — " + supLabel + " | " + new Date().toLocaleDateString("he-IL");
  var body    = "שלום,\n\nמצורף דוח חשבוניות מירב.\n\n";
  body += "ספק: " + supLabel + "\n";
  body += "תקופה: " + (dateFrom||"—") + " עד " + (dateTo||"—") + "\n";
  body += "סה\"כ חשבוניות: " + invoices.length + "\n";
  body += "סה\"כ סכום: ₪" + total.toFixed(2) + "\n";
  body += "שולמו: " + totalPaid + " | טרם שולמו: " + (invoices.length - totalPaid) + "\n\n";
  body += "בברכה,\nמערכת חשבוניות מירב";

  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: body,
    attachments: [pdf]
  });

  return { success:true, message:"PDF נשלח ל-" + email + " (" + invoices.length + " חשבוניות)" };
}

function buildPdfHtml(invoices, supplier, dateFrom, dateTo, total, totalPaid) {
  var css = [
    'body{font-family:Arial,sans-serif;direction:rtl;margin:0;padding:0;color:#1e1040;}',
    '.cover{page-break-after:always;padding:40px;background:#f3eeff;min-height:100vh;box-sizing:border-box;}',
    '.cover-logo{text-align:center;margin-bottom:30px;}',
    '.cover-logo h1{color:#6c3eb8;font-size:32px;margin:0;}',
    '.cover-logo p{color:#9d8ec4;font-size:14px;margin:6px 0 0;}',
    '.stats{display:flex;flex-wrap:wrap;gap:16px;margin:30px 0;}',
    '.stat{background:#fff;border-radius:12px;padding:16px 20px;flex:1;min-width:120px;text-align:center;box-shadow:0 2px 8px rgba(108,62,184,.1);}',
    '.stat .val{font-size:26px;font-weight:900;color:#6c3eb8;}',
    '.stat .lbl{font-size:11px;color:#9d8ec4;margin-top:4px;}',
    '.stat.green .val{color:#16a34a;} .stat.red .val{color:#dc2626;} .stat.gold .val{color:#d97706;}',
    '.sum-table{width:100%;border-collapse:collapse;margin-top:20px;font-size:13px;}',
    '.sum-table th{background:#6c3eb8;color:#fff;padding:10px;text-align:right;}',
    '.sum-table td{padding:9px 10px;border-bottom:1px solid #eee;}',
    '.sum-table tr:nth-child(even) td{background:#f9f6ff;}',
    '.sum-table .total-row td{background:#6c3eb8;color:#fff;font-weight:900;}',
    '.paid{color:#16a34a;font-weight:700;} .unpaid{color:#dc2626;font-weight:700;}',
    '.inv-page{page-break-before:always;padding:24px;box-sizing:border-box;}',
    '.inv-header{background:linear-gradient(135deg,#6c3eb8,#8b5cf6);color:#fff;border-radius:12px;padding:16px 20px;margin-bottom:16px;}',
    '.inv-header h2{margin:0;font-size:18px;} .inv-header p{margin:4px 0 0;font-size:12px;opacity:.85;}',
    '.inv-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}',
    '.meta-box{background:#f3eeff;border-radius:8px;padding:8px 14px;flex:1;min-width:110px;}',
    '.meta-box .mk{font-size:10px;color:#9d8ec4;font-weight:700;} .meta-box .mv{font-size:14px;font-weight:900;color:#1e1040;}',
    '.inv-img{text-align:center;} .inv-img img{max-width:100%;max-height:700px;border-radius:8px;border:1px solid #ddd;}'
  ].join('');

  var html = '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">';
  html += '<style>' + css + '</style></head><body>';

  // --- דף שער ---
  var supLabel = supplier === "all" ? "כל הספקים" : supplier.replace(/,/g, ", ");
  html += '<div class="cover">';
  html += '<div class="cover-logo">';
  html += '<h1>🧾 חשבוניות מירב</h1>';
  html += '<p>דוח חשבוניות | ' + supLabel + '</p>';
  html += '<p>' + (dateFrom||"הכל") + ' — ' + (dateTo||"הכל") + '</p>';
  html += '<p style="font-size:12px;color:#aaa;">הופק: ' + new Date().toLocaleDateString("he-IL") + '</p>';
  html += '</div>';

  html += '<div class="stats">';
  html += '<div class="stat"><div class="val">' + invoices.length + '</div><div class="lbl">חשבוניות</div></div>';
  html += '<div class="stat gold"><div class="val">₪' + total.toFixed(0) + '</div><div class="lbl">סה"כ</div></div>';
  html += '<div class="stat green"><div class="val">' + totalPaid + '</div><div class="lbl">שולמו</div></div>';
  html += '<div class="stat red"><div class="val">' + (invoices.length - totalPaid) + '</div><div class="lbl">לא שולמו</div></div>';
  html += '</div>';

  // טבלת סיכום בדף שער
  html += '<table class="sum-table">';
  html += '<tr><th>#</th><th>מס׳</th><th>ספק</th><th>תאריך</th><th>סכום ₪</th><th>תשלום</th><th>סטטוס</th></tr>';
  invoices.forEach(function(inv, n) {
    var isPaid = inv.paid === true || inv.paid === "true";
    html += '<tr>';
    html += '<td>' + (n+1) + '</td>';
    html += '<td style="color:#6c3eb8;font-weight:700;">' + (inv.invNum ? "#"+inv.invNum : "—") + '</td>';
    html += '<td style="font-weight:700;">' + (inv.supplier||"") + '</td>';
    html += '<td>' + (inv.date||"") + '</td>';
    html += '<td style="font-weight:700;">₪' + (parseFloat(inv.amtTotal)||0).toFixed(2) + '</td>';
    html += '<td style="font-size:12px;">' + (inv.payment||"טרם שולם") + '</td>';
    html += '<td class="' + (isPaid?"paid":"unpaid") + '">' + (isPaid?"✅ שולם":"❌ לא שולם") + '</td>';
    html += '</tr>';
  });
  html += '<tr class="total-row"><td colspan="4">סה"כ</td><td>₪' + total.toFixed(2) + '</td><td></td><td>' + totalPaid + '/' + invoices.length + '</td></tr>';
  html += '</table></div>';

  // --- עמוד לכל חשבונית ---
  invoices.forEach(function(inv, n) {
    var isPaid = inv.paid === true || inv.paid === "true";

    html += '<div class="inv-page">';

    // כותרת
    html += '<div class="inv-header">';
    html += '<h2>' + (inv.supplier||"") + (inv.invNum ? ' — #' + inv.invNum : '') + '</h2>';
    html += '<p>חשבונית ' + (n+1) + ' מתוך ' + invoices.length + '</p>';
    html += '</div>';

    // פרטים
    html += '<div class="inv-meta">';
    html += '<div class="meta-box"><div class="mk">תאריך</div><div class="mv">' + (inv.date||"—") + '</div></div>';
    html += '<div class="meta-box"><div class="mk">ספרות</div><div class="mv" style="letter-spacing:3px;">' + (inv.digits||"—") + '</div></div>';
    html += '<div class="meta-box"><div class="mk">סכום</div><div class="mv">₪' + (parseFloat(inv.amtTotal)||0).toFixed(2) + '</div></div>';
    html += '<div class="meta-box"><div class="mk">קטגוריה</div><div class="mv">' + (inv.category||"—") + '</div></div>';
    html += '<div class="meta-box" style="flex:2;"><div class="mk">תשלום</div><div class="mv ' + (isPaid?"paid":"unpaid") + '">' + (inv.payment||"טרם שולם") + '</div></div>';
    html += '</div>';

    // תמונה מ-Drive
    if (inv.fileUrl) {
      try {
        var fileId = extractFileId(inv.fileUrl);
        if (fileId) {
          var file = DriveApp.getFileById(fileId);
          var mimeType = file.getMimeType();
          if (mimeType === "application/pdf") {
            // PDF — הכנס הודעה
            html += '<div style="text-align:center;padding:30px;background:#f3eeff;border-radius:8px;">';
            html += '<p style="font-size:14px;color:#6c3eb8;">📄 קובץ PDF — <a href="' + inv.fileUrl + '">' + inv.fileUrl + '</a></p>';
            html += '</div>';
          } else {
            // תמונה — הכנס ישירות
            var imgData = Utilities.base64Encode(file.getBlob().getBytes());
            html += '<div class="inv-img"><img src="data:' + mimeType + ';base64,' + imgData + '" /></div>';
          }
        }
      } catch(e) {
        html += '<div style="text-align:center;padding:20px;color:#9d8ec4;"><p>לא ניתן לטעון את התמונה</p><p><a href="' + inv.fileUrl + '">' + inv.fileUrl + '</a></p></div>';
      }
    } else {
      html += '<div style="text-align:center;padding:30px;color:#9d8ec4;">אין קובץ מצורף</div>';
    }

    html += '</div>'; // inv-page
  });

  html += '</body></html>';
  return html;
}

function extractFileId(url) {
  if (!url) return null;
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}
