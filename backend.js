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
    else if(data.action==="sendReport")result=sendReport(data);
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
      var isPaid=(data.payment&&data.payment!=="")?"כן":"";
      sh.getRange(rn,COL.PAYMENT+1).setValue(payStr);
      sh.getRange(rn,COL.PAY_AMOUNT+1).setValue(data.payAmount||"");
      sh.getRange(rn,COL.PAY_AMOUNT2+1).setValue(data.payAmount2||"");
      sh.getRange(rn,COL.CHECK_NUM+1).setValue(data.checkNum||"");
      sh.getRange(rn,COL.CHECK_NUM2+1).setValue(data.checkNum2||"");
      sh.getRange(rn,COL.CHECK_DATE+1).setValue(data.checkDate||"");
      sh.getRange(rn,COL.CHECK_DATE2+1).setValue(data.checkDate2||"");
      sh.getRange(rn,COL.PAID+1).setValue(isPaid);
      return{success:true};
    }
  }
  return{success:false,error:"חשבונית לא נמצאה"};
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
  var total=0;
  inv.invoices.forEach(function(i){total+=parseFloat(i.amtTotal)||0;});
  var body="דוח חשבוניות מירב 🧾\n";
  body+="============================\n";
  body+="ספק: "+(params.supplier==="all"||!params.supplier?"כל הספקים":params.supplier)+"\n";
  body+="תקופה: "+(params.dateFrom||"—")+" עד "+(params.dateTo||"—")+"\n";
  body+="סה\"כ: "+inv.invoices.length+" חשבוניות | ₪"+total.toFixed(2)+"\n";
  body+="============================\n\n";
  inv.invoices.forEach(function(i,n){
    body+=(n+1)+". "+i.supplier+(i.invNum?" #"+i.invNum:"")+" | "+i.digits+" | "+i.date;
    if(i.amtTotal) body+=" | ₪"+parseFloat(i.amtTotal).toFixed(2);
    body+=" | "+(i.paid?"✅ שולם":"⏳ לא שולם");
    if(i.payment&&i.payment!=="טרם שולם") body+=" ("+i.payment+")";
    if(i.fileUrl) body+="\n   🔗 "+i.fileUrl;
    body+="\n\n";
  });
  MailApp.sendEmail({to:email,subject:"דוח חשבוניות מירב — "+new Date().toLocaleDateString("he-IL"),body:body});
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

function createPdfFromImages(pagesB64,mimeTypes,name){
  var html='<html><head><style>body{margin:0;padding:0;}.page{width:100%;height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;page-break-inside:avoid;overflow:hidden;}.page img{max-width:100%;max-height:100vh;object-fit:contain;display:block;}</style></head><body>';
  for(var i=0;i<pagesB64.length;i++){
    var mime=(mimeTypes&&mimeTypes[i])?mimeTypes[i]:"image/jpeg";
    html+='<div class="page"><img src="data:'+mime+';base64,'+pagesB64[i]+'" /></div>';
  }
  html+='</body></html>';
  var blob=Utilities.newBlob(html,"text/html",name+".html");
  return blob.getAs("application/pdf").setName(name+".pdf");
}
