
const STORE_KEY = "metal-bakim-takip-v1";
let db = loadDB();
if(!db.serviceRecords) db.serviceRecords=[];
let deferredPrompt = null;
let maintFilter = "upcoming";
const $ = id => document.getElementById(id);

function loadDB(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {customers:[], devices:[], payments:[], collections:[], serviceRecords:[]};
}
function saveDB(){ localStorage.setItem(STORE_KEY, JSON.stringify(db)); renderAll(); }
function id(){ return crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random(); }
function money(n){ return new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(Number(n||0)); }
function fmtDate(s){ if(!s) return "-"; return new Date(s+"T12:00:00").toLocaleDateString("tr-TR"); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function addMonths(dateStr, months){
  const d = new Date(dateStr+"T12:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth()+Number(months||6));
  if(d.getDate()<day) d.setDate(0);
  return d.toISOString().slice(0,10);
}
function daysUntil(dateStr){
  const a = new Date(); a.setHours(0,0,0,0);
  const b = new Date(dateStr+"T00:00:00");
  return Math.round((b-a)/86400000);
}
function maintStatus(device){
  const next = addMonths(device.lastMaintenance, device.intervalMonths||6);
  const d = daysUntil(next);

  // Tamamlanan bakım kaydı - yeni dönem henüz yaklaşmadıysa "Yapılanlar" filtresinde görünür.
  if(device.maintenanceState === "completed" && device.completedDate){
    return {key:"completed", label:"Yapıldı", days:d, next, completedDate:device.completedDate};
  }

  if(device.maintenanceState === "not_done"){
    if(d < 0) return {key:"late", label:"Yapılmadı / Gecikmiş", days:d, next};
    return {key:"upcoming", label:"Bakım Yapılmadı", days:d, next};
  }

  if(d < 0) return {key:"late", label:"Gecikmiş", days:d, next};
  if(d === 0) return {key:"upcoming", label:"Bugün", days:d, next};
  if(d <= Number(device.reminderDays ?? 5)) return {key:"upcoming", label:"Planlandı", days:d, next};
  return {key:"normal", label:"Normal", days:d, next};
}
function getCustomer(cid){ return db.customers.find(x=>x.id===cid); }
function getDevice(did){ return db.devices.find(x=>x.id===did); }
function esc(s){ return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

function renderAll(){
  renderDashboard(); renderCustomers(); renderMaintenance(); renderPayments();
}
function renderDashboard(){
  const remaining = db.payments.reduce((sum,p)=>sum+Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0),0);
  const now = new Date(), m=now.getMonth(), y=now.getFullYear();
  const collected = db.collections.filter(c=>{const d=new Date(c.date);return d.getMonth()===m&&d.getFullYear()===y}).reduce((s,c)=>s+Number(c.amount),0);
  const overdue = db.payments.filter(p=>Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0)>0 && p.dueDate<todayISO());
  const statuses = db.devices.map(d=>maintStatus(d));
  document.getElementById("sumReceivable").textContent = money(remaining);
  document.getElementById("sumCollected").textContent = money(collected);
  document.getElementById("sumOverdue").textContent = `${overdue.length} / ${money(overdue.reduce((s,p)=>s+Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0),0))}`;
  document.getElementById("sumUpcoming").textContent = statuses.filter(x=>x.key==="upcoming").length;
  document.getElementById("sumLateMaintenance").textContent = statuses.filter(x=>x.key==="late").length;
  document.getElementById("sumCustomers").textContent = db.customers.length;

  const due = db.devices.map(d=>({d,s:maintStatus(d)})).filter(x=>x.s.key==="upcoming" || x.s.key==="late").sort((a,b)=>a.s.days-b.s.days);
  document.getElementById("maintenanceSummary").innerHTML = due.length ? due.map(({d,s})=>{
    const c=getCustomer(d.customerId);
    return `<div class="item">
      <div class="row"><h3>${esc(c?.companyName||"Müşteri")} – ${esc(d.name)}</h3><span class="badge ${s.key}">${s.label}</span></div>
      <div class="muted small">Seri No: ${esc(d.serialNumber||"-")} • Bakım: ${fmtDate(s.next)}</div>
    </div>`;
  }).join("") : `<div class="item muted">Yaklaşan veya gecikmiş bakım yok.</div>`;
}

function renderCustomers(){
  const q = (document.getElementById("customerSearch")?.value||"").toLocaleLowerCase("tr");
  let customers = [...db.customers].sort((a,b)=>a.companyName.localeCompare(b.companyName,"tr"));
  if(q){
    customers = customers.filter(c=>{
      const devs = db.devices.filter(d=>d.customerId===c.id);
      return [c.companyName,c.contactName,c.phone,c.address,...devs.flatMap(d=>[d.name,d.brandModel,d.serialNumber])]
        .join(" ").toLocaleLowerCase("tr").includes(q);
    });
  }
  const el=document.getElementById("customerList");
  el.innerHTML = customers.length ? customers.map(c=>{
    const devs=db.devices.filter(d=>d.customerId===c.id);
    const pays=db.payments.filter(p=>p.customerId===c.id);
    const debt=pays.reduce((s,p)=>s+Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0),0);
    return `<div class="item">
      <div class="row"><div><h3>${esc(c.companyName)}</h3><div class="muted small">${esc(c.contactName||"")} ${c.phone? "• "+esc(c.phone):""}</div></div><span class="badge">${devs.length} cihaz</span></div>
      <div class="muted small">Alacak: ${money(debt)}</div>
      <div class="actions">
        ${c.phone?`<button onclick="location.href='tel:${encodeURIComponent(c.phone)}'">Ara</button>`:""}
        <button onclick="openCustomerModal('${c.id}')">Düzenle</button>
        <button onclick="openDeviceModal('${c.id}')">+ Cihaz</button>
        <button onclick="openPaymentModal('${c.id}')">+ Ödeme</button>
        <button class="danger-btn" onclick="deleteCustomer('${c.id}')">Sil</button>
      </div>
      ${devs.map(d=>{
        const s=maintStatus(d);
        return `<div class="item" style="margin-top:10px;background:#fafafa">
          <div class="row"><strong>${esc(d.name)}</strong><span class="badge ${s.key}">${s.label}</span></div>
          <div class="muted small">${d.brandModel? "Operatör: "+esc(d.brandModel)+" • ":""}${d.serialNumber? "Seri No: "+esc(d.serialNumber):""}</div>
          <div class="muted small">Sonraki bakım: ${fmtDate(s.next)}</div>
          ${d.photoData?`<img src="${d.photoData}" class="preview" style="margin-top:8px">`:""}
          <div class="actions">
            <button onclick="openDeviceModal('${c.id}','${d.id}')">Düzenle</button>
            <button class="ok-btn" onclick="completeMaintenance('${d.id}')">Bakım Tamamlandı</button>
            <button onclick="openHistory('${d.id}')">Geçmiş</button>
            <button class="warn-btn" onclick="markMaintenanceNotDone('${d.id}')">Bakım Yapılmadı</button>
            <button class="danger-btn" onclick="deleteDevice('${d.id}')">Cihazı Sil</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("") : `<div class="item muted">Kayıt bulunamadı.</div>`;
}

function renderMaintenance(){
  let arr=db.devices.map(d=>({d,s:maintStatus(d)})).sort((a,b)=>{
    if(a.s.key==="completed" && b.s.key==="completed"){
      return String(b.s.completedDate||"").localeCompare(String(a.s.completedDate||""));
    }
    return a.s.days-b.s.days;
  });

  arr=arr.filter(x=>x.s.key===maintFilter);

  document.getElementById("maintenanceList").innerHTML = arr.length ? arr.map(({d,s})=>{
    const c=getCustomer(d.customerId);
    const operatorText = d.brandModel ? `<div class="muted small">Operatör: ${esc(d.brandModel)}</div>` : "";
    const completedText = s.key==="completed" && s.completedDate
      ? `<div class="muted small">Yapılan bakım: <strong>${fmtDate(s.completedDate)}</strong></div>`
      : `<div>Planlanan bakım: <strong>${fmtDate(s.next)}</strong></div>`;

    return `<div class="item">
      <div class="row">
        <div>
          <h3>${esc(c?.companyName||"Müşteri")}</h3>
          <div><strong>${esc(d.name)}</strong></div>
        </div>
        <span class="badge ${s.key}">${s.label}</span>
      </div>
      ${operatorText}
      <div class="muted small">Seri No: ${esc(d.serialNumber||"-")}</div>
      ${completedText}
      ${s.key!=="completed" ? `<div class="actions">
        <button class="ok-btn" onclick="completeMaintenance('${d.id}')">Bakım Tamamlandı</button>
        <button onclick="openHistory('${d.id}')">Geçmiş</button>
        <button class="warn-btn" onclick="markMaintenanceNotDone('${d.id}')">Bakım Yapılmadı</button>
      </div>` : ""}
    </div>`;
  }).join("") : `<div class="item muted">Bu bölümde kayıt yok.</div>`;
}

function renderPayments(){
  const arr=[...db.payments].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  document.getElementById("paymentList").innerHTML = arr.length ? arr.map(p=>{
    const c=getCustomer(p.customerId), remaining=Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0);
    const late=remaining>0 && p.dueDate<todayISO();
    return `<div class="item">
      <div class="row"><h3>${esc(c?.companyName||"Müşteri")}</h3><span class="badge ${late?"late":remaining===0?"ok":""}">${remaining===0?"Ödendi":late?"Gecikmiş":"Bekliyor"}</span></div>
      <div>${esc(p.title||"Servis / Bakım")}</div>
      <div class="muted small">Toplam: ${money(p.totalAmount)} • Ödenen: ${money(p.paidAmount)} • Kalan: ${money(remaining)}</div>
      <div class="muted small">Vade: ${fmtDate(p.dueDate)} • ${esc(p.method||"")}</div>
      ${remaining>0?`<div class="actions"><button onclick="openCollectModal('${p.id}')">Tahsilat Ekle</button></div>`:""}
    </div>`;
  }).join("") : `<div class="item muted">Henüz ödeme kaydı yok.</div>`;
}

function openCustomerModal(cid=""){
  const d=document.getElementById("customerDialog"), c=cid?getCustomer(cid):null;
  document.getElementById("customerDialogTitle").textContent=c?"Müşteri Düzenle":"Yeni Müşteri";
  customerId.value=c?.id||""; companyName.value=c?.companyName||""; contactName.value=c?.contactName||"";
  phone.value=c?.phone||""; address.value=c?.address||""; customerNotes.value=c?.notes||"";
  d.showModal();
}
function openDeviceModal(cid,did=""){
  const d=document.getElementById("deviceDialog"), x=did?getDevice(did):null;
  deviceDialogTitle.textContent=x?"Cihaz Düzenle":"Yeni Cihaz";
  deviceCustomerId.value=cid; deviceId.value=x?.id||""; deviceName.value=x?.name||""; deviceType.value=x?.deviceType||"needle"; brandModel.value=x?.brandModel||"";
  serialNumber.value=x?.serialNumber||""; lastMaintenance.value=x?.lastMaintenance||todayISO();
  intervalMonths.value=x?.intervalMonths||6; reminderDays.value=x?.reminderDays??5; deviceNotes.value=x?.notes||"";
  photoPreview.src=x?.photoData||""; photoPreview.classList.toggle("hidden",!x?.photoData);
  devicePhoto.value="";
  d.showModal();
}
function openPaymentModal(cid){
  paymentCustomerId.value=cid; paymentTitle.value="Servis / Bakım"; totalAmount.value=""; paidAmount.value="0";
  dueDate.value=todayISO(); paymentMethod.value="Havale / EFT"; invoiceNumber.value=""; paymentNotes.value="";
  paymentDialog.showModal();
}
function openCollectModal(pid){
  const p=db.payments.find(x=>x.id===pid); if(!p)return;
  collectPaymentId.value=pid; collectAmount.value=Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0);
  collectDialog.showModal();
}

customerForm.addEventListener("submit",e=>{
  e.preventDefault();
  const cid=customerId.value;
  const obj={id:cid||id(),companyName:companyName.value.trim(),contactName:contactName.value.trim(),phone:phone.value.trim(),address:address.value.trim(),notes:customerNotes.value.trim()};
  if(cid){ db.customers=db.customers.map(x=>x.id===cid?obj:x); } else db.customers.push(obj);
  saveDB(); customerDialog.close();
});
deviceForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const did=deviceId.value, existing=did?getDevice(did):null;
  let photoData=existing?.photoData||"";
  const file=devicePhoto.files[0];
  if(file) photoData=await fileToDataURL(file);
  const obj={id:did||id(),customerId:deviceCustomerId.value,name:deviceName.value.trim(),deviceType:deviceType.value,brandModel:brandModel.value.trim(),serialNumber:serialNumber.value.trim(),lastMaintenance:lastMaintenance.value,intervalMonths:Number(intervalMonths.value||6),reminderDays:Number(reminderDays.value||5),notes:deviceNotes.value.trim(),photoData,maintenanceState:existing?.maintenanceState||"pending",completedDate:existing?.completedDate||""};
  if(did) db.devices=db.devices.map(x=>x.id===did?obj:x); else db.devices.push(obj);
  saveDB(); deviceDialog.close();
});
paymentForm.addEventListener("submit",e=>{
  e.preventDefault();
  const paid=Math.min(Number(paidAmount.value||0),Number(totalAmount.value||0));
  const p={id:id(),customerId:paymentCustomerId.value,title:paymentTitle.value.trim(),totalAmount:Number(totalAmount.value),paidAmount:paid,dueDate:dueDate.value,method:paymentMethod.value,invoiceNumber:invoiceNumber.value.trim(),notes:paymentNotes.value.trim()};
  db.payments.push(p);
  if(paid>0) db.collections.push({id:id(),paymentId:p.id,customerId:p.customerId,amount:paid,date:new Date().toISOString(),method:p.method});
  saveDB(); paymentDialog.close();
});
collectForm.addEventListener("submit",e=>{
  e.preventDefault();
  const p=db.payments.find(x=>x.id===collectPaymentId.value); if(!p)return;
  const remaining=Math.max(Number(p.totalAmount)-Number(p.paidAmount||0),0);
  const amt=Math.min(Number(collectAmount.value||0),remaining);
  if(amt<=0)return;
  p.paidAmount=Number(p.paidAmount||0)+amt;
  db.collections.push({id:id(),paymentId:p.id,customerId:p.customerId,amount:amt,date:new Date().toISOString(),method:collectMethod.value});
  saveDB(); collectDialog.close();
});
devicePhoto.addEventListener("change",async()=>{
  const f=devicePhoto.files[0]; if(!f)return;
  photoPreview.src=await fileToDataURL(f); photoPreview.classList.remove("hidden");
});
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}

function completeMaintenance(did){
  const d=getDevice(did); if(!d)return;
  const c=getCustomer(d.customerId);

  $("serviceDeviceId").value=d.id;
  $("serviceDialogTitle").textContent = d.deviceType==="handheld"
    ? "El Tipi Metal Dedektör Kalibrasyon Formu"
    : d.deviceType==="needle"
      ? "İğne Dedektörü Kalibrasyon Formu"
      : "Servis / Bakım Formu";

  $("certificateNo").value = String((db.serviceRecords?.length||0)+1).padStart(4,"0");
  $("serviceDate").value=todayISO();
  $("serviceCompany").value=c?.companyName||"";
  $("serviceAddress").value=c?.address||"";
  $("servicePhone").value=c?.phone||"";
  $("serviceMachineName").value=d.name||"";
  $("serviceSerial").value=d.serialNumber||"";
  $("serviceOperators").value=d.brandModel||"";

  $("needleFields").classList.toggle("hidden", d.deviceType==="handheld");
  $("handheldFields").classList.toggle("hidden", d.deviceType!=="handheld");

  $("sensitivity").value="";
  $("counterSensors").checked=false;
  $("autoStart").checked=false;
  $("printerWorks").checked=false;
  $("dateTimeOk").checked=false;
  $("beltClean").checked=false;
  $("testCard12").checked=false;
  $("ninePoint").checked=false;
  $("trainedPeople").value="";

  $("powerSupply").value="";
  $("batteryBackup").value="";
  $("processBoard").value="";
  $("headCapacitor").value="";
  $("handheldTestCard").checked=false;

  $("workDone").value = d.deviceType==="handheld"
    ? "1.2 test karta göre makine ayarları kontrol edildi.\\nUyarı sistemleri kontrol edildi."
    : "1.2 test karta göre makine ayarları kontrol edildi.\\nOperatör eğitimleri yenilendi.\\n9 nokta test işlemi yapıldı.";

  $("nextServiceDate").value=addMonths(todayISO(), d.intervalMonths||6);
  $("technicianName").value="Kalmer Kalibrasyon";
  $("serviceAttachment").value="";
  $("attachmentInfo").textContent="Evrak eklenmedi.";
  $("serviceDialog").showModal();
}

function markMaintenanceNotDone(did){
  const d=getDevice(did); if(!d)return;
  if(confirm(`${d.name} için bakım YAPILMADI olarak işaretlensin mi? Tarih ilerletilmeyecek.`)){
    d.maintenanceState="not_done";
    d.completedDate="";
    saveDB();
  }
}


$("serviceAttachment").addEventListener("change", ()=>{
  const f=$("serviceAttachment").files[0];
  $("attachmentInfo").textContent = f
    ? `${f.name} • ${(f.size/1024/1024).toFixed(2)} MB`
    : "Evrak eklenmedi.";
});

function fileToDataURLSafe(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

$("serviceCancelBtn").addEventListener("click", ()=>{
  $("serviceDialog").close();
});

$("serviceForm").addEventListener("submit", async e=>{
  e.preventDefault();

  const d=getDevice($("serviceDeviceId").value);
  if(!d){
    alert("Cihaz kaydı bulunamadı.");
    return;
  }

  const c=getCustomer(d.customerId);

  const record={
    id:id(),
    deviceId:d.id,
    customerId:d.customerId,
    certificateNo:$("certificateNo").value.trim(),
    date:$("serviceDate").value,
    companyName:c?.companyName||"",
    address:c?.address||"",
    phone:c?.phone||"",
    machineName:d.name||"",
    serialNumber:d.serialNumber||"",
    deviceType:d.deviceType||"needle",
    operators:$("serviceOperators").value.trim(),
    sensitivity:$("sensitivity").value.trim(),
    counterSensors:$("counterSensors").checked,
    autoStart:$("autoStart").checked,
    printerWorks:$("printerWorks").checked,
    dateTimeOk:$("dateTimeOk").checked,
    beltClean:$("beltClean").checked,
    testCard12:$("testCard12").checked,
    ninePoint:$("ninePoint").checked,
    trainedPeople:$("trainedPeople").value.trim(),
    powerSupply:$("powerSupply").value.trim(),
    batteryBackup:$("batteryBackup").value.trim(),
    processBoard:$("processBoard").value.trim(),
    headCapacitor:$("headCapacitor").value.trim(),
    handheldTestCard:$("handheldTestCard").checked,
    workDone:$("workDone").value.trim(),
    nextServiceDate:$("nextServiceDate").value,
    technicianName:$("technicianName").value.trim(),
    attachmentName:"",
    attachmentType:"",
    attachmentData:""
  };

  const attachmentFile=$("serviceAttachment").files[0];
  if(attachmentFile){
    // localStorage capacity is limited; warn for larger files
    if(attachmentFile.size > 3 * 1024 * 1024){
      alert("Evrak 3 MB'dan büyük. Daha küçük bir PDF veya fotoğraf seçin.");
      return;
    }
    try{
      record.attachmentName=attachmentFile.name;
      record.attachmentType=attachmentFile.type;
      record.attachmentData=await fileToDataURLSafe(attachmentFile);
    }catch(err){
      alert("Evrak okunamadı.");
      return;
    }
  }

  if(!record.date){
    alert("Servis tarihini seçin.");
    return;
  }
  if(!record.nextServiceDate){
    alert("Gelecek servis tarihini seçin.");
    return;
  }

  if(!db.serviceRecords) db.serviceRecords=[];
  db.serviceRecords.push(record);

  d.lastMaintenance=record.date;
  d.completedDate=record.date;
  d.maintenanceState="completed";
  d.brandModel=record.operators;

  saveDB();
  $("serviceDialog").close();
  alert("Bakım / kalibrasyon kaydı başarıyla kaydedildi.");
});

function openHistory(did){
  const d=getDevice(did); if(!d)return;
  const records=(db.serviceRecords||[])
    .filter(r=>r.deviceId===did)
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  historyList.innerHTML = records.length ? records.map(r=>`
    <div class="history-card">
      <div class="row">
        <div>
          <h4>${fmtDate(r.date)} • Sertifika No: ${esc(r.certificateNo||"-")}</h4>
          <div class="muted small">${esc(r.machineName)} • Seri No: ${esc(r.serialNumber||"-")}</div>
        </div>
        <span class="badge completed">Yapıldı</span>
      </div>
      <div class="muted small">Operatör: ${esc(r.operators||"-")}</div>
      <div class="muted small">Gelecek servis: ${fmtDate(r.nextServiceDate)}</div>
      <div class="actions">
        ${r.attachmentData ? `<button onclick="openAttachment('${r.id}')">Evrakı Aç</button>` : ""}
      </div>
    </div>
  `).join("") : `<div class="item muted">Bu makine için geçmiş kayıt yok.</div>`;

  historyDialog.showModal();
}


let currentAttachmentRecordId = null;

function dataURLToFile(dataUrl, filename, mimeType){
  const parts=dataUrl.split(",");
  const binary=atob(parts[1]);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return new File([bytes], filename || "evrak", {type:mimeType || "application/octet-stream"});
}

function openAttachment(recordId){
  const r=(db.serviceRecords||[]).find(x=>x.id===recordId);
  if(!r || !r.attachmentData){
    alert("Bu bakım kaydında evrak yok.");
    return;
  }

  currentAttachmentRecordId=recordId;
  $("attachmentTitle").textContent = r.attachmentName || "Bakım Evrakı";

  const body=$("attachmentViewerBody");
  body.innerHTML="";

  if((r.attachmentType||"").startsWith("image/")){
    const img=document.createElement("img");
    img.src=r.attachmentData;
    img.alt=r.attachmentName||"Bakım evrakı";
    body.appendChild(img);
  }else if((r.attachmentType||"")==="application/pdf"){
    const iframe=document.createElement("iframe");
    iframe.src=r.attachmentData;
    iframe.title=r.attachmentName||"Bakım PDF";
    body.appendChild(iframe);
  }else{
    body.innerHTML='<div class="item">Bu dosya türü önizlenemiyor.</div>';
  }

  $("attachmentDialog").showModal();
}

$("attachmentCloseBtn").addEventListener("click", ()=>{
  $("attachmentDialog").close();
  $("attachmentViewerBody").innerHTML="";
  currentAttachmentRecordId=null;
});

$("attachmentShareBtn").addEventListener("click", async ()=>{
  const r=(db.serviceRecords||[]).find(x=>x.id===currentAttachmentRecordId);
  if(!r || !r.attachmentData) return;

  try{
    const file=dataURLToFile(
      r.attachmentData,
      r.attachmentName || (r.attachmentType==="application/pdf" ? "bakim-evraki.pdf" : "bakim-evraki.jpg"),
      r.attachmentType
    );

    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({
        title:"Bakım Evrakı",
        text:`${r.companyName || "Müşteri"} - ${r.machineName || "Makine"} bakım evrakı`,
        files:[file]
      });
    }else{
      alert("Bu cihaz dosya paylaşımını desteklemiyor. iPhone'da Safari üzerinden açıp tekrar deneyin.");
    }
  }catch(err){
    if(err && err.name==="AbortError") return;
    alert("Evrak paylaşılırken bir sorun oluştu.");
  }
});

$("attachmentPrintBtn").addEventListener("click", ()=>{
  const r=(db.serviceRecords||[]).find(x=>x.id===currentAttachmentRecordId);
  if(!r || !r.attachmentData) return;

  const w=window.open("","_blank");
  if(!w){
    alert("Yazdırma penceresi açılamadı. Tarayıcı açılır pencereyi engelliyor olabilir.");
    return;
  }

  if((r.attachmentType||"").startsWith("image/")){
    w.document.write(`
      <html>
        <head><title>${esc(r.attachmentName||"Bakım Evrakı")}</title></head>
        <body style="margin:0;text-align:center;background:white">
          <img src="${r.attachmentData}" style="max-width:100%;height:auto">
          <script>window.onload=()=>window.print();<\/script>
        </body>
      </html>
    `);
    w.document.close();
  }else{
    w.location.href=r.attachmentData;
    setTimeout(()=>{ try{ w.print(); }catch(e){} }, 1200);
  }
});

function yesNo(v){ return v ? "✓" : "—"; }

function printServiceRecord(recordId){
  const r=(db.serviceRecords||[]).find(x=>x.id===recordId); if(!r)return;
  const isHandheld=r.deviceType==="handheld";

  const detailRows = isHandheld ? `
    <tr><td>Power Supply</td><td>${esc(r.powerSupply||"-")}</td></tr>
    <tr><td>Battery Back-up</td><td>${esc(r.batteryBackup||"-")}</td></tr>
    <tr><td>Proces Board</td><td>${esc(r.processBoard||"-")}</td></tr>
    <tr><td>Head Capacitor</td><td>${esc(r.headCapacitor||"-")}</td></tr>
    <tr><td>1.2 Ferrous Test Kartı</td><td>${yesNo(r.handheldTestCard)}</td></tr>
  ` : `
    <tr><td>Hassasiyet Ayarı</td><td>${esc(r.sensitivity||"-")}</td></tr>
    <tr><td>Sayaç Sensörleri</td><td>${yesNo(r.counterSensors)}</td></tr>
    <tr><td>Otomatik Başlama</td><td>${yesNo(r.autoStart)}</td></tr>
    <tr><td>Yazıcı Çalışıyor</td><td>${yesNo(r.printerWorks)}</td></tr>
    <tr><td>Saat / Tarih Ayarı</td><td>${yesNo(r.dateTimeOk)}</td></tr>
    <tr><td>Konveyör Band Temiz</td><td>${yesNo(r.beltClean)}</td></tr>
    <tr><td>1.2 Ferrous Test Kartı</td><td>${yesNo(r.testCard12)}</td></tr>
    <tr><td>9 Nokta Aparatı</td><td>${yesNo(r.ninePoint)}</td></tr>
    <tr><td>Eğitim Alan Kişiler</td><td>${esc(r.trainedPeople||"-")}</td></tr>
  `;

  const title = isHandheld
    ? "EL TİPİ METAL DEDEKTÖR KALİBRASYON SERTİFİKASI"
    : "KALİBRASYON SERTİFİKASI";

  const w=window.open("","_blank");
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:28px;color:#111}
      h1,h2{text-align:center;margin:6px 0}
      .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
      .brand{font-size:28px;font-weight:800;border:3px solid #d7a900;padding:8px 20px;background:#111827;color:#fff;border-radius:8px}
      table{width:100%;border-collapse:collapse;margin-top:14px}
      td,th{border:1px solid #bbb;padding:7px;font-size:12px;vertical-align:top}
      .section{margin-top:16px;font-weight:700}
      .footer{margin-top:24px;text-align:center;font-size:11px}
      .sign{margin-top:26px;display:flex;justify-content:space-between}
      @media print{button{display:none}}
    </style></head><body>
      <div class="top"><div class="brand">KALMER</div><div>No: <strong>${esc(r.certificateNo||"-")}</strong></div></div>
      <h2>${title}</h2>

      <table>
        <tr><th colspan="2">Firma Bilgileri</th></tr>
        <tr><td>Tarih</td><td>${fmtDate(r.date)}</td></tr>
        <tr><td>Firma Adı</td><td>${esc(r.companyName)}</td></tr>
        <tr><td>Firma Adresi</td><td>${esc(r.address||"-")}</td></tr>
        <tr><td>Firma Tel No</td><td>${esc(r.phone||"-")}</td></tr>
        <tr><th colspan="2">Makine Detayları</th></tr>
        <tr><td>Makine Adı</td><td>${esc(r.machineName)}</td></tr>
        <tr><td>Seri No</td><td>${esc(r.serialNumber||"-")}</td></tr>
        <tr><td>Operatör İsimleri</td><td>${esc(r.operators||"-")}</td></tr>
        ${detailRows}
        <tr><th colspan="2">Yapılan Çalışmalar</th></tr>
        <tr><td colspan="2">${esc(r.workDone||"-").replace(/\n/g,"<br>")}</td></tr>
        <tr><td>Gelecek Kalibrasyon / Servis</td><td><strong>${fmtDate(r.nextServiceDate)}</strong></td></tr>
      </table>

      <div class="sign">
        <div>Teknisyen / Onay<br><br><strong>${esc(r.technicianName||"Kalmer Kalibrasyon")}</strong></div>
        <div>İmza / Kaşe<br><br>______________________</div>
      </div>

      <div class="footer">
        KALMER DEDEKTÖR TEKSTİL MAKİNALARI SATIŞ SANAYİ TİC. LTD. ŞTİ.
      </div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>
  `);
  w.document.close();
}

function deleteDevice(did){
  if(confirm("Bu cihaz silinsin mi?")){ db.devices=db.devices.filter(x=>x.id!==did); saveDB(); }
}
function deleteCustomer(cid){
  if(!confirm("Müşteri ve bağlı cihaz/ödeme kayıtları silinsin mi?"))return;
  const deviceIds=db.devices.filter(d=>d.customerId===cid).map(d=>d.id);
  db.customers=db.customers.filter(c=>c.id!==cid);
  db.devices=db.devices.filter(d=>d.customerId!==cid);
  const paymentIds=db.payments.filter(p=>p.customerId===cid).map(p=>p.id);
  db.payments=db.payments.filter(p=>p.customerId!==cid);
  db.collections=db.collections.filter(c=>c.customerId!==cid && !paymentIds.includes(c.paymentId));
  saveDB();
}

document.getElementById("customerSearch").addEventListener("input",renderCustomers);
document.querySelectorAll(".bottomnav button").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".bottomnav button").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("active")); document.getElementById(b.dataset.page).classList.add("active");
}));
document.querySelectorAll("[data-maint-filter]").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("[data-maint-filter]").forEach(x=>x.classList.remove("active")); b.classList.add("active");
  maintFilter=b.dataset.maintFilter; renderMaintenance();
}));

exportBtn.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}), a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=`metal-bakim-yedek-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href);
});
importFile.addEventListener("change",async()=>{
  const f=importFile.files[0]; if(!f)return;
  try{ const data=JSON.parse(await f.text()); if(!data.customers||!data.devices||!data.payments)throw 0; db=data; saveDB(); alert("Yedek geri yüklendi."); }
  catch{ alert("Geçersiz yedek dosyası.");}
});
notifyBtn.addEventListener("click",async()=>{
  if(!("Notification" in window)){alert("Bu tarayıcı bildirimleri desteklemiyor.");return;}
  const p=await Notification.requestPermission(); alert("Bildirim izni: "+p);
});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove("hidden");});
installBtn.addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add("hidden");});
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

renderAll();
