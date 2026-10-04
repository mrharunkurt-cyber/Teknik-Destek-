
const STORE_KEY = "metal-bakim-takip-v1";
let db = loadDB();
let deferredPrompt = null;
let maintFilter = "all";

function loadDB(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {customers:[], devices:[], payments:[], collections:[]};
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

  // Kullanıcı "Bakım Yapılmadı" seçtiyse tarih ilerlemez.
  // Kayıt beklemede/gecikmiş olarak kalır.
  if(device.maintenanceState === "not_done"){
    if(d < 0) return {key:"late", label:"Yapılmadı / Gecikmiş", days:d, next};
    return {key:"upcoming", label:"Bakım Yapılmadı", days:d, next};
  }

  if(d < 0) return {key:"late", label:"Gecikmiş", days:d, next};
  if(d === 0) return {key:"upcoming", label:"Bugün", days:d, next};
  if(d <= Number(device.reminderDays ?? 5)) return {key:"upcoming", label:"Planlandı", days:d, next};
  return {key:"ok", label:"Normal", days:d, next};
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

  const due = db.devices.map(d=>({d,s:maintStatus(d)})).filter(x=>x.s.key!=="ok").sort((a,b)=>a.s.days-b.s.days);
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
          <div class="muted small">${esc(d.brandModel||"")} ${d.serialNumber? "• Seri No: "+esc(d.serialNumber):""}</div>
          <div class="muted small">Sonraki bakım: ${fmtDate(s.next)}</div>
          ${d.photoData?`<img src="${d.photoData}" class="preview" style="margin-top:8px">`:""}
          <div class="actions">
            <button onclick="openDeviceModal('${c.id}','${d.id}')">Düzenle</button>
            <button class="ok-btn" onclick="completeMaintenance('${d.id}')">Bakım Tamamlandı</button>
            <button class="warn-btn" onclick="markMaintenanceNotDone('${d.id}')">Bakım Yapılmadı</button>
            <button class="danger-btn" onclick="deleteDevice('${d.id}')">Cihazı Sil</button>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("") : `<div class="item muted">Kayıt bulunamadı.</div>`;
}

function renderMaintenance(){
  let arr=db.devices.map(d=>({d,s:maintStatus(d)})).sort((a,b)=>a.s.days-b.s.days);
  if(maintFilter!=="all") arr=arr.filter(x=>x.s.key===maintFilter);
  document.getElementById("maintenanceList").innerHTML = arr.length ? arr.map(({d,s})=>{
    const c=getCustomer(d.customerId);
    return `<div class="item">
      <div class="row"><h3>${esc(c?.companyName||"Müşteri")} – ${esc(d.name)}</h3><span class="badge ${s.key}">${s.label}</span></div>
      <div class="muted small">Seri No: ${esc(d.serialNumber||"-")}</div>
      <div>Sonraki bakım: <strong>${fmtDate(s.next)}</strong></div>
      <div class="actions">
        <button class="ok-btn" onclick="completeMaintenance('${d.id}')">Bakım Tamamlandı</button>
        <button class="warn-btn" onclick="markMaintenanceNotDone('${d.id}')">Bakım Yapılmadı</button>
      </div>
    </div>`;
  }).join("") : `<div class="item muted">Bu filtrede kayıt yok.</div>`;
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
  deviceCustomerId.value=cid; deviceId.value=x?.id||""; deviceName.value=x?.name||""; brandModel.value=x?.brandModel||"";
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
  const obj={id:did||id(),customerId:deviceCustomerId.value,name:deviceName.value.trim(),brandModel:brandModel.value.trim(),serialNumber:serialNumber.value.trim(),lastMaintenance:lastMaintenance.value,intervalMonths:Number(intervalMonths.value||6),reminderDays:Number(reminderDays.value||5),notes:deviceNotes.value.trim(),photoData,maintenanceState:existing?.maintenanceState||"pending"};
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
  if(confirm(`${d.name} için bakım bugün TAMAMLANDI olarak işaretlensin mi?`)){
    d.lastMaintenance=todayISO();
    d.maintenanceState="completed";
    saveDB();
  }
}

function markMaintenanceNotDone(did){
  const d=getDevice(did); if(!d)return;
  if(confirm(`${d.name} için bakım YAPILMADI olarak işaretlensin mi? Tarih ilerletilmeyecek.`)){
    d.maintenanceState="not_done";
    saveDB();
  }
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
