(()=>{"use strict";
const API="https://www.googleapis.com/drive/v3",UPLOAD="https://www.googleapis.com/upload/drive/v3",SCOPE="https://www.googleapis.com/auth/drive.file";
const C=window.SCATOLA_CONFIG||{},S={token:"",client:null,root:null,cats:[],active:null,stack:[],allFolders:[],previewUrl:null,searchRun:0,selectedFiles:new Set(),currentFiles:[],sortMode:"name"};
const $=x=>document.getElementById(x),E={login:$("login"),login2:$("login2"),refresh:$("refresh"),backup:$("backup"),restore:$("restore"),restoreInput:$("restoreInput"),locked:$("locked"),dash:$("dash"),grid:$("grid"),summary:$("summary"),add:$("add"),search:$("search"),searchBtn:$("searchBtn"),searchClear:$("searchClear"),searchResults:$("searchResults"),favoritesPanel:$("favoritesPanel"),favoritesList:$("favoritesList"),favoritesCount:$("favoritesCount"),pdfPreview:$("pdfPreview"),pdfTitle:$("pdfTitle"),pdfFrame:$("pdfFrame"),pdfClose:$("pdfClose"),setup:$("setup"),origin:$("origin"),clientId:$("clientId"),saveClient:$("saveClient"),googleCloud:$("googleCloud"),filesModal:$("filesModal"),catTitle:$("catTitle"),breadcrumbs:$("breadcrumbs"),close:$("close"),drop:$("drop"),pick:$("pick"),fileInput:$("fileInput"),fileList:$("fileList"),toast:$("toast"),newFolder:$("newFolder"),upLevel:$("upLevel"),renameFolder:$("renameFolder"),folderColor:$("folderColor"),progress:$("progress"),progressTitle:$("progressTitle"),progressText:$("progressText"),progressBar:$("progressBar"),sortFiles:$("sortFiles"),selectionToolbar:$("selectionToolbar"),selectAllFiles:$("selectAllFiles"),selectedCount:$("selectedCount"),bulkMove:$("bulkMove"),bulkDelete:$("bulkDelete")};
const DRIVE_COLORS=["#ac725e","#d06b64","#f83a22","#fa573c","#ff7537","#ffad46","#42d692","#16a765","#7bd148","#b3dc6c","#fbe983","#fad165","#92e1c0","#9fc6e7","#4986e7","#9a9cff","#b99aff","#cd74e6","#e1e1e1","#cabdbf","#cca6ac","#f691b2","#ffb878","#e7e6e6"];
function driveColor(hex){const n=parseInt(hex.slice(1),16),r=n>>16,g=(n>>8)&255,b=n&255;let best=DRIVE_COLORS[0],dist=Infinity;for(const c of DRIVE_COLORS){const v=parseInt(c.slice(1),16),dr=r-(v>>16),dg=g-((v>>8)&255),db=b-(v&255),d=dr*dr+dg*dg+db*db;if(d<dist){dist=d;best=c}}return best}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeColor=(v,fallback="#f2b33d")=>/^#[0-9a-fA-F]{6}$/.test(String(v||""))?v:fallback;
const qesc=s=>String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
function clientId(){let v=(C.googleClientId||"").trim();if(v.includes("INCOLLA_QUI")||!v.includes(".apps.googleusercontent.com"))v=(localStorage.getItem("scatola_client_id")||"").trim();return v.includes(".apps.googleusercontent.com")?v:""}
function toast(t,k=""){const d=document.createElement("div");d.className="toast "+k;d.textContent=t;E.toast.appendChild(d);setTimeout(()=>d.remove(),5000)}
async function gis(){for(let i=0;i<100;i++){if(window.google?.accounts?.oauth2)return;await new Promise(r=>setTimeout(r,100))}throw Error("Google Identity Services non disponibile")}
async function auth(){let id=clientId();if(!id){openSetup();return}await gis();S.client=google.accounts.oauth2.initTokenClient({client_id:id,scope:SCOPE,callback:()=>{}});return new Promise((ok,ko)=>{S.client.callback=async r=>{if(r.error)return ko(Error(r.error_description||r.error));S.token=r.access_token;try{await boot();ok()}catch(e){ko(e)}};S.client.requestAccessToken({prompt:"consent"})})}
async function fetchApi(url,opt={}){const h=new Headers(opt.headers||{});h.set("Authorization","Bearer "+S.token);const r=await fetch(url,{...opt,headers:h});if(!r.ok){let m="";try{m=(await r.json())?.error?.message}catch{m=await r.text()}throw Error(m||"Errore Google "+r.status)}return r.status===204?null:r.json()}
async function list(q,fields="id,name,mimeType,size,modifiedTime,webViewLink,parents,iconLink,folderColorRgb,appProperties"){if(!fields.split(",").includes("appProperties"))fields+=" ,appProperties";fields=fields.replace(" ,",",");let out=[],token;do{const p=new URLSearchParams({q,pageSize:"1000",spaces:"drive",fields:`nextPageToken,files(${fields})`,orderBy:"name_natural"});if(token)p.set("pageToken",token);const r=await fetchApi(API+"/files?"+p);out.push(...(r.files||[]));token=r.nextPageToken}while(token);return out}
async function createFolder(name,parent){const body={name,mimeType:"application/vnd.google-apps.folder"};if(parent)body.parents=[parent];return fetchApi(API+"/files?fields=id,name,mimeType,webViewLink,folderColorRgb,parents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})}
async function root(){const n=C.driveRootName||"ScatolaDashboard",f=await list(`name='${qesc(n)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);return f[0]||createFolder(n,null)}
async function boot(){S.root=await root();await loadCats();E.locked.classList.add("hidden");E.dash.classList.remove("hidden");[E.refresh,E.backup,E.restore].forEach(b=>b.disabled=false);E.login.textContent="G Ricollega Google";toast("Google Drive collegato","ok")}
async function loadCats(){S.cats=await list(`'${S.root.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);S.cats.sort((a,b)=>a.name.localeCompare(b.name,"it",{numeric:true}));for(const c of S.cats)c.count=(await list(`'${c.id}' in parents and trashed=false`,"id")).length;render();await loadFavorites()}
function render(){E.summary.textContent=S.cats.length+" caselle";E.grid.innerHTML="";for(const c of S.cats){const d=document.createElement("article");d.className="card";d.style.setProperty("--folder-color",safeColor(c.folderColorRgb,"#0879ff"));d.innerHTML=`<div class="accent"></div><div class="body"><div class="cardTitle"><h4>${esc(c.name)}</h4><button class="starBtn fav" type="button" title="Aggiungi ai Preferiti" aria-label="Aggiungi ai Preferiti">☆</button></div><div class="meta">${c.count||0} elementi diretti su Google Drive</div><div class="dropmini"><b>Trascina qui i file</b><br><small>upload diretto su Drive</small></div><div class="cardBtns"><button class="blue up">⇧ Carica</button><button class="green open">Apri</button><button class="gray ren">Rinomina</button><button class="gray color" title="Cambia il colore della cartella">Colore</button><button class="gray drive">Drive</button><button class="red del">Elimina</button></div></div>`;const dz=d.querySelector(".dropmini");["dragenter","dragover"].forEach(x=>dz.addEventListener(x,e=>{e.preventDefault();dz.classList.add("on")}));["dragleave","drop"].forEach(x=>dz.addEventListener(x,e=>{e.preventDefault();dz.classList.remove("on")}));dz.addEventListener("drop",e=>upload(c,[...e.dataTransfer.files]).catch(er=>toast(er.message,"err")));d.querySelector(".fav").onclick=()=>toggleFavorite(c).catch(e=>toast(e.message,"err"));if(c.appProperties?.scatolaFavorite==="true"){d.querySelector(".fav").textContent="★";d.querySelector(".fav").classList.add("isFavorite")}d.querySelector(".up").onclick=()=>pick(c);d.querySelector(".open").onclick=()=>openCat(c);d.querySelector(".ren").onclick=()=>rename(c);d.querySelector(".color").onclick=()=>chooseColor(c);d.querySelector(".drive").onclick=()=>window.open(c.webViewLink||"https://drive.google.com/drive/u/0/my-drive","_blank");d.querySelector(".del").onclick=()=>delFolder(c);E.grid.appendChild(d)}}
function pick(c){S.active=c;E.fileInput.value="";E.fileInput.click()}
async function upload(c,fs){if(!fs.length)return;for(const f of fs){const init=await fetch(UPLOAD+"/files?uploadType=resumable&fields=id,name",{method:"POST",headers:{Authorization:"Bearer "+S.token,"Content-Type":"application/json","X-Upload-Content-Type":f.type||"application/octet-stream","X-Upload-Content-Length":String(f.size)},body:JSON.stringify({name:f.name,parents:[c.id]})});if(!init.ok)throw Error("Errore upload: "+f.name);const u=init.headers.get("Location"),r=await fetch(u,{method:"PUT",headers:{"Content-Type":f.type||"application/octet-stream"},body:f});if(!r.ok)throw Error("Errore upload "+f.name)}await refreshCurrent();toast(fs.length+" file caricati","ok")}
async function openCat(c){S.active=c;S.stack=[c];E.filesModal.classList.remove("hidden");await loadFiles(c)}
async function loadFiles(c){
 S.active=c;
 S.selectedFiles.clear();
 E.catTitle.textContent=c.name;
 E.folderColor.value=c.folderColorRgb||"#0879ff";
 E.breadcrumbs.innerHTML=S.stack.map((x,i)=>`<button data-i="${i}">${esc(x.name)}</button>`).join(" / ");
 E.breadcrumbs.querySelectorAll("button").forEach(b=>b.onclick=()=>{S.stack=S.stack.slice(0,Number(b.dataset.i)+1);loadFiles(S.stack.at(-1))});
 E.upLevel.disabled=S.stack.length<=1;
 const items=await list(`'${c.id}' in parents and trashed=false`);
 const folders=items.filter(x=>x.mimeType==="application/vnd.google-apps.folder");
 const files=items.filter(x=>x.mimeType!=="application/vnd.google-apps.folder");
 folders.sort((a,b)=>a.name.localeCompare(b.name,"it",{numeric:true}));
 const mode=E.sortFiles?.value||S.sortMode||"name";
 files.sort((a,b)=>{
  if(mode==="newest")return new Date(b.modifiedTime||0)-new Date(a.modifiedTime||0);
  if(mode==="oldest")return new Date(a.modifiedTime||0)-new Date(b.modifiedTime||0);
  if(mode==="largest")return Number(b.size||0)-Number(a.size||0)||a.name.localeCompare(b.name,"it",{numeric:true});
  return a.name.localeCompare(b.name,"it",{numeric:true});
 });
 S.currentFiles=files;
 E.fileList.innerHTML="";
 if(!items.length)E.fileList.innerHTML="<p>Nessun file o sottocartella.</p>";
 for(const f of folders){
  const d=document.createElement("div");d.className="folderRow";
  d.innerHTML=`<div class="folderName"><span class="folderIcon" aria-hidden="true" style="--folder-color:${safeColor(f.folderColorRgb,"#f2b33d")}"></span><div><b>${esc(f.name)}</b><span>Sottocartella</span></div></div><div class="row"><button class="green enter">Apri</button><button class="gray ren">Rinomina</button><button class="gray color" title="Cambia il colore della cartella">Colore</button><button class="starBtn fav" type="button" title="Aggiungi ai Preferiti" aria-label="Aggiungi ai Preferiti">☆</button><button class="red del">Elimina</button></div>`;
  if(f.appProperties?.scatolaFavorite==="true"){d.querySelector(".fav").textContent="★";d.querySelector(".fav").classList.add("isFavorite")}
  d.querySelector(".fav").onclick=()=>toggleFavorite(f).catch(e=>toast(e.message,"err"));
  d.querySelector(".enter").onclick=()=>{S.stack.push(f);loadFiles(f)};
  d.querySelector(".ren").onclick=()=>rename(f,true);
  d.querySelector(".color").onclick=()=>chooseColor(f);
  d.querySelector(".del").onclick=()=>delFolder(f,true);
  E.fileList.appendChild(d);
 }
 for(const f of files){
  const d=document.createElement("div");d.className="file";
  d.innerHTML=`<div class="fileInfo"><label class="selectFile"><input type="checkbox" class="fileSelect" aria-label="Seleziona ${esc(f.name)}"><span></span></label><div class="fileText"><b>${esc(f.name)}</b><span>${f.size?formatSize(Number(f.size)):f.mimeType}</span></div></div><div class="fileActions">${f.mimeType==="application/pdf"?'<button class="blue preview previewBtn">👁 Anteprima PDF</button>':""}${f.webViewLink?'<button class="green o">Apri</button>':""}<button class="gray ren">Rinomina</button><button class="gray move">Sposta</button><button class="starBtn fav" type="button" title="Aggiungi ai Preferiti" aria-label="Aggiungi ai Preferiti">☆</button><button class="red x">Elimina</button></div>`;
  if(f.appProperties?.scatolaFavorite==="true"){d.querySelector(".fav").textContent="★";d.querySelector(".fav").classList.add("isFavorite")}
  d.querySelector(".fileSelect").onchange=e=>{
   if(e.target.checked)S.selectedFiles.add(f.id);else S.selectedFiles.delete(f.id);
   renderSelectionToolbar();
  };
  d.querySelector(".fav").onclick=()=>toggleFavorite(f).catch(e=>toast(e.message,"err"));
  d.querySelector(".preview")?.addEventListener("click",()=>previewPdf(f).catch(e=>toast(e.message,"err")));
  d.querySelector(".o")?.addEventListener("click",()=>window.open(f.webViewLink,"_blank"));
  d.querySelector(".ren").onclick=()=>rename(f,true);
  d.querySelector(".move").onclick=()=>moveFile(f);
  d.querySelector(".x").onclick=async()=>{
   if(!confirm(`Spostare "${f.name}" nel Cestino di Google Drive?`))return;
   await patch(f.id,{trashed:true});await loadFiles(S.active);await loadCats();
  };
  E.fileList.appendChild(d);
 }
 renderSelectionToolbar();
}
function renderSelectionToolbar(){
 if(!E.selectionToolbar)return;
 const total=S.currentFiles.length,selected=S.selectedFiles.size;
 E.selectionToolbar.classList.toggle("hidden",total===0);
 E.selectedCount.textContent=selected+" selezionati";
 E.bulkMove.disabled=selected===0;
 E.bulkDelete.disabled=selected===0;
 E.selectAllFiles.checked=total>0&&selected===total;
 E.selectAllFiles.indeterminate=selected>0&&selected<total;
}
async function toggleFavorite(f){
 const props={...(f.appProperties||{})};
 const willAdd=props.scatolaFavorite!=="true";
 // Drive richiede esplicitamente null per cancellare una appProperty:
 // omettere la chiave lascia invariato il valore precedente sul server.
 const updateProps={...props,scatolaFavorite:willAdd?"true":null};
 await fetchApi(API+"/files/"+f.id+"?fields=id,name,appProperties",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({appProperties:updateProps})});
 if(willAdd)props.scatolaFavorite="true";else delete props.scatolaFavorite;
 f.appProperties=props;
 // Aggiorna subito sia il contrassegno sia l'elenco Preferiti.
 await refreshCurrent();
 toast(willAdd?"Aggiunto ai Preferiti":"Rimosso dai Preferiti","ok");
}
async function folderChain(parentId,cache=new Map()){
 if(!parentId||parentId===S.root.id)return [];
 if(cache.has(parentId))return cache.get(parentId);
 const meta=await fetchApi(API+"/files/"+parentId+"?fields=id,name,mimeType,parents,folderColorRgb,webViewLink,appProperties");
 const parent=meta.parents?.[0];
 const chain=parent&&parent!==S.root.id?await folderChain(parent,cache):[];
 const result=[...chain,meta];cache.set(parentId,result);return result;
}
async function loadFavorites(){
 if(!E.favoritesPanel)return;
 try{
  const favs=await list("appProperties has { key='scatolaFavorite' and value='true' } and trashed=false","id,name,mimeType,webViewLink,parents,appProperties,size,folderColorRgb");
  const cache=new Map([[S.root.id,[]]]),items=[];
  for(const f of favs){
   const parentChain=await folderChain(f.parents?.[0],cache);
   const isFolder=f.mimeType==="application/vnd.google-apps.folder";
   items.push({f,path:(isFolder?[...parentChain,f]:parentChain).map(x=>x.name).join(" / "),chain:isFolder?[...parentChain,f]:parentChain});
  }
  items.sort((a,b)=>a.f.name.localeCompare(b.f.name,"it",{numeric:true}));
  E.favoritesList.innerHTML="";E.favoritesCount.textContent=items.length+" elementi salvati";
  E.favoritesPanel.classList.remove("hidden");
  if(!items.length){E.favoritesList.innerHTML='<p class="emptyFavorites">Non hai ancora salvato Preferiti. Premi ☆ accanto a una cartella o a un documento per ritrovarlo qui.</p>';return;}
  for(const item of items){
   const row=document.createElement("div");row.className="favoriteItem";
   const folder=item.f.mimeType==="application/vnd.google-apps.folder";
   row.innerHTML=`<div class="favoriteInfo"><span class="favoriteType">${folder?"📁":"📄"}</span><div><b>${esc(item.f.name)}</b><small>${esc(item.path||"ScatolaDashboard")}</small></div></div><div class="favoriteActions"><button type="button" class="green openFav">${folder?"Apri cartella":item.f.mimeType==="application/pdf"?"Anteprima":"Apri"}</button><button type="button" class="starBtn isFavorite removeFav" title="Rimuovi dai Preferiti" aria-label="Rimuovi dai Preferiti">★</button></div>`;
   row.querySelector(".openFav").onclick=async()=>{
    if(folder){S.stack=[{...S.root},...item.chain];E.filesModal.classList.remove("hidden");await loadFiles(item.f)}
    else if(item.f.mimeType==="application/pdf")await previewPdf(item.f);
    else if(item.f.webViewLink)window.open(item.f.webViewLink,"_blank");
    else toast("Non è disponibile un collegamento di apertura per questo elemento.");
   };
   row.querySelector(".removeFav").onclick=()=>toggleFavorite(item.f).catch(e=>toast(e.message,"err"));
   E.favoritesList.appendChild(row);
  }
 }catch(e){
  E.favoritesPanel.classList.remove("hidden");E.favoritesCount.textContent="Non disponibili";
  E.favoritesList.innerHTML='<p class="emptyFavorites">Non è stato possibile leggere i Preferiti. Riprova con Aggiorna.</p>';
  console.error("Preferiti:",e);
 }
}
async function previewPdf(f){
 if(f.mimeType!=="application/pdf"){toast("L'anteprima è disponibile per i file PDF.");return;}
 const old=E.pdfTitle.textContent;E.pdfTitle.textContent=f.name;E.pdfPreview.classList.remove("hidden");E.pdfFrame.src="about:blank";
 try{
  const r=await fetch(API+"/files/"+f.id+"?alt=media",{headers:{Authorization:"Bearer "+S.token}});
  if(!r.ok){let msg="Errore nel caricamento del PDF";try{msg=(await r.json())?.error?.message||msg}catch{}throw Error(msg)}
  const blob=await r.blob();
  if(S.previewUrl)URL.revokeObjectURL(S.previewUrl);
  S.previewUrl=URL.createObjectURL(new Blob([blob],{type:"application/pdf"}));
  E.pdfFrame.src=S.previewUrl;
 }catch(e){E.pdfPreview.classList.add("hidden");E.pdfTitle.textContent=old;throw e;}
}
function closePdfPreview(){E.pdfPreview.classList.add("hidden");E.pdfFrame.src="about:blank";if(S.previewUrl){URL.revokeObjectURL(S.previewUrl);S.previewUrl=null;}}
function formatSize(n){if(!n)return "";const u=["B","KB","MB","GB"];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return n.toFixed(i?1:0)+" "+u[i]}
async function patch(id,b){return fetchApi(API+"/files/"+id+"?fields=id,name,trashed,folderColorRgb,webViewLink,parents,appProperties",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})}
async function rename(f,inModal=false){const n=prompt("Nuovo nome:",f.name);if(!n?.trim()||n.trim()===f.name)return;await patch(f.id,{name:n.trim()});f.name=n.trim();S.stack=S.stack.map(x=>x.id===f.id?{...x,name:n.trim()}:x);if(S.active?.id===f.id)S.active.name=n.trim();await refreshCurrent();toast("Nome aggiornato","ok")}
async function chooseColor(f){
 const existing=document.querySelector(".colorPaletteOverlay");
 if(existing)existing.remove();
 const overlay=document.createElement("div");
 overlay.className="colorPaletteOverlay";
 overlay.setAttribute("role","presentation");
 const selected=safeColor(f.folderColorRgb,"");
 overlay.innerHTML=`<section class="colorPaletteDialog" role="dialog" aria-modal="true" aria-label="Scegli il colore della cartella">
  <div class="colorPaletteHead"><div><h3>Scegli il colore</h3><p>${esc(f.name)}</p></div><button type="button" class="colorPaletteClose" aria-label="Chiudi">×</button></div>
  <div class="colorPaletteGrid">${DRIVE_COLORS.map(c=>`<button type="button" class="colorSwatch ${c===selected?"isSelected":""}" data-color="${c}" style="--swatch:${c}" title="${c}" aria-label="Colore ${c}" ${c===selected?'aria-pressed="true"':'aria-pressed="false"'}></button>`).join("")}</div>
  <p class="colorPaletteNote">Scegli un colore supportato da Google Drive.</p>
  <div class="colorPaletteFoot"><button type="button" class="gray colorPaletteCancel">Annulla</button></div>
 </section>`;
 document.body.appendChild(overlay);
 const close=()=>overlay.remove();
 overlay.querySelector(".colorPaletteClose").onclick=close;
 overlay.querySelector(".colorPaletteCancel").onclick=close;
 overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
 overlay.querySelectorAll(".colorSwatch").forEach(btn=>btn.addEventListener("click",async()=>{
  const color=btn.dataset.color;
  overlay.querySelectorAll("button").forEach(b=>b.disabled=true);
  try{
   await patch(f.id,{folderColorRgb:color});
   const saved=await fetchApi(API+"/files/"+f.id+"?fields=id,name,folderColorRgb");
   if(!saved?.folderColorRgb)throw Error("Google Drive non ha confermato il colore. Riprova.");
   f.folderColorRgb=saved.folderColorRgb;
   const cat=S.cats.find(x=>x.id===f.id);if(cat)cat.folderColorRgb=saved.folderColorRgb;
   S.stack=S.stack.map(x=>x.id===f.id?{...x,folderColorRgb:saved.folderColorRgb}:x);
   if(S.active?.id===f.id)S.active.folderColorRgb=saved.folderColorRgb;
   close();
   await refreshCurrent();
   toast("Colore della cartella aggiornato","ok");
  }catch(e){
   overlay.querySelectorAll("button").forEach(b=>b.disabled=false);
   toast("Non sono riuscita a salvare il colore: "+e.message,"err");
  }
 }));
 const first=overlay.querySelector(".colorSwatch");
 first?.focus();
}
async function nextFolderNumber(parentId){const children=await list(`'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,"id,name");let max=children.length;for(const f of children){const m=f.name.match(/^\s*(\d+)\s*[-.)_]/);if(m)max=Math.max(max,Number(m[1]))}return max+1}
async function addCat(){const n=prompt("Nome della nuova casella:");if(!n?.trim())return;const num=await nextFolderNumber(S.root.id);await createFolder(String(num).padStart(2,"0")+" - "+n.trim(),S.root.id);await loadCats()}
async function addSubfolder(){const n=prompt("Nome della nuova sottocartella:");if(!n?.trim())return;const num=await nextFolderNumber(S.active.id);await createFolder(String(num).padStart(2,"0")+" - "+n.trim(),S.active.id);await loadFiles(S.active)}
async function delFolder(f,inModal=false){if(!confirm(`Spostare "${f.name}" e tutto il suo contenuto nel Cestino di Google Drive?`))return;await patch(f.id,{trashed:true});if(inModal)await loadFiles(S.stack.at(-1));await loadCats();toast("Cartella spostata nel Cestino","ok")}
let movePickerFiles=[],movePickerSourceId=null,movePickerStack=[];
function ensureMovePicker(){
 let host=$("folderPicker");
 if(host)return host;
 host=document.createElement("div");host.id="folderPicker";host.className="overlay hidden";
 host.innerHTML=`<div class="modal movePickerModal"><div class="modalHead"><div><h2>Scegli la cartella di destinazione</h2><p class="pickerHelp" id="pickerHelp">Apri le cartelle con il mouse e scegli la destinazione.</p></div><button type="button" id="pickerClose">×</button></div><div id="pickerCrumbs" class="breadcrumbs pickerCrumbs"></div><div class="pickerCurrent"><div><b id="pickerCurrentName"></b><small>Cartella attualmente visualizzata</small></div><button type="button" class="green" id="pickerChooseCurrent">Sposta qui</button></div><div id="pickerList" class="pickerList"><p>Caricamento cartelle...</p></div><div class="pickerFooter"><button type="button" class="gray" id="pickerUp">↑ Cartella superiore</button><button type="button" class="gray" id="pickerCancel">Annulla</button></div></div>`;
 document.body.appendChild(host);
 $("pickerClose").onclick=$("pickerCancel").onclick=()=>host.classList.add("hidden");
 $("pickerUp").onclick=()=>{if(movePickerStack.length>1){movePickerStack.pop();renderMovePicker().catch(e=>toast(e.message,"err"))}};
 $("pickerChooseCurrent").onclick=()=>moveFileTo(movePickerStack.at(-1));
 return host;
}
async function openMovePicker(files){
 movePickerFiles=Array.isArray(files)?files:[files];
 movePickerSourceId=S.active.id;
 ensureMovePicker();
 $("pickerHelp").textContent=movePickerFiles.length===1
  ?"Apri le cartelle con il mouse e scegli dove spostare il documento."
  :`Scegli la destinazione per ${movePickerFiles.length} documenti selezionati.`;
 $("pickerChooseCurrent").textContent=movePickerFiles.length===1?"Sposta qui":"Sposta qui ("+movePickerFiles.length+")";
 movePickerStack=[{...S.root}];
 $("folderPicker").classList.remove("hidden");
 await renderMovePicker();
}
async function renderMovePicker(){
 const here=movePickerStack.at(-1);
 $("pickerCurrentName").textContent=here.id===S.root.id?"ScatolaDashboard":here.name;
 $("pickerUp").disabled=movePickerStack.length<=1;
 $("pickerCrumbs").innerHTML=movePickerStack.map((x,i)=>`<button type="button" data-crumb="${i}">${esc(x.id===S.root.id?"ScatolaDashboard":x.name)}</button>`).join(" / ");
 $("pickerCrumbs").querySelectorAll("button").forEach(b=>b.onclick=()=>{movePickerStack=movePickerStack.slice(0,Number(b.dataset.crumb)+1);renderMovePicker().catch(e=>toast(e.message,"err"))});
 $("pickerList").innerHTML="<p class='pickerLoading'>Caricamento cartelle...</p>";
 const folders=await list(`'${here.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,"id,name,mimeType,folderColorRgb");
 folders.sort((a,b)=>a.name.localeCompare(b.name,"it",{numeric:true}));
 $("pickerList").innerHTML=folders.length?"":"<p class='pickerEmpty'>Non ci sono sottocartelle in questa posizione.</p>";
 for(const folder of folders){
  const row=document.createElement("div");row.className="pickerFolder";
  row.innerHTML=`<div class="pickerFolderInfo"><span class="pickerFolderIcon" style="color:${esc(folder.folderColorRgb||"#e5a000")}">📁</span><div><b>${esc(folder.name)}</b><small>Cartella</small></div></div><div class="pickerFolderActions"><button type="button" class="gray pickerOpen">Apri</button><button type="button" class="green pickerChoose">Scegli</button></div>`;
  row.querySelector(".pickerOpen").onclick=()=>{movePickerStack.push(folder);renderMovePicker().catch(e=>toast(e.message,"err"))};
  row.querySelector(".pickerChoose").onclick=()=>moveFileTo(folder);
  $("pickerList").appendChild(row);
 }
}
async function moveFileTo(destination){
 if(!movePickerFiles.length)return;
 if(destination.id===movePickerSourceId){toast("I documenti si trovano già in questa cartella.");return}
 try{
  $("pickerChooseCurrent").disabled=true;
  document.querySelectorAll(".pickerChoose").forEach(b=>b.disabled=true);
  let moved=0,failed=[];
  for(const f of movePickerFiles){
   try{
    await fetchApi(API+"/files/"+f.id+"?addParents="+encodeURIComponent(destination.id)+"&removeParents="+encodeURIComponent(movePickerSourceId),{method:"PATCH"});
    moved++;
   }catch(e){failed.push(f.name+": "+e.message)}
  }
  $("folderPicker").classList.add("hidden");
  movePickerFiles=[];S.selectedFiles.clear();
  await loadFiles(S.active);await loadCats();
  if(failed.length)toast(`Spostati ${moved} documenti. ${failed.length} non sono stati spostati: ${failed[0]}`,"err");
  else toast(`${moved} documenti spostati in: ${destination.name||"ScatolaDashboard"}`,"ok");
 }catch(e){toast("Spostamento non riuscito: "+e.message,"err")}
 finally{$("pickerChooseCurrent").disabled=false;document.querySelectorAll(".pickerChoose").forEach(b=>b.disabled=false)}
}
async function moveFile(f){await openMovePicker(f)}
async function moveSelectedFiles(){
 const selected=S.currentFiles.filter(f=>S.selectedFiles.has(f.id));
 if(!selected.length)return;
 await openMovePicker(selected);
}
async function deleteSelectedFiles(){
 const selected=S.currentFiles.filter(f=>S.selectedFiles.has(f.id));
 if(!selected.length)return;
 if(!confirm(`Spostare nel Cestino di Google Drive ${selected.length} documenti selezionati?`))return;
 E.bulkDelete.disabled=true;E.bulkMove.disabled=true;
 let deleted=0,failed=[];
 for(const f of selected){
  try{await patch(f.id,{trashed:true});deleted++}
  catch(e){failed.push(f.name+": "+e.message)}
 }
 S.selectedFiles.clear();
 await loadFiles(S.active);await loadCats();
 if(failed.length)toast(`Eliminati ${deleted} documenti. ${failed.length} non eliminati: ${failed[0]}`,"err");
 else toast(`${deleted} documenti spostati nel Cestino di Google Drive.`,"ok");
}
async function collectFolders(){let out=[];async function walk(id,path){const fs=await list(`'${id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,"id,name,mimeType");for(const f of fs){const p=path+"/"+f.name;out.push({...f,path:p});await walk(f.id,p)}}await walk(S.root.id,"");return out}
async function refreshCurrent(){await loadCats();if(!E.filesModal.classList.contains("hidden")&&S.active)await loadFiles(S.active)}
function openSetup(){E.origin.textContent=location.origin;E.clientId.value=clientId();E.setup.classList.remove("hidden")}
function showProgress(title,txt){E.progressTitle.textContent=title;E.progressText.textContent=txt;E.progressBar.value=0;E.progress.classList.remove("hidden")}
function updateProgress(done,total,txt){E.progressBar.value=total?Math.round(done/total*100):0;E.progressText.textContent=txt}
function hideProgress(){E.progress.classList.add("hidden")}
const exportMime={"application/vnd.google-apps.document":["application/pdf",".pdf"],"application/vnd.google-apps.spreadsheet":["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",".xlsx"],"application/vnd.google-apps.presentation":["application/pdf",".pdf"],"application/vnd.google-apps.drawing":["image/png",".png"]};
function safeName(n){return n.replace(/[\\/:*?"<>|]/g,"_")}
async function blobFor(f){if(exportMime[f.mimeType]){const [mime,ext]=exportMime[f.mimeType];const r=await fetch(API+"/files/"+f.id+"/export?mimeType="+encodeURIComponent(mime),{headers:{Authorization:"Bearer "+S.token}});if(!r.ok)throw Error("Esportazione non riuscita: "+f.name);return {blob:await r.blob(),name:safeName(f.name)+ext}}const r=await fetch(UPLOAD.replace("/upload","")+"/files/"+f.id+"?alt=media",{headers:{Authorization:"Bearer "+S.token}});if(!r.ok)throw Error("Download non riuscito: "+f.name);return {blob:await r.blob(),name:safeName(f.name)}}
async function backup(){if(!window.JSZip)return toast("Libreria ZIP non caricata. Ricarica la pagina.","err");try{showProgress("Backup completo","Lettura delle cartelle...");const zip=new JSZip(),rootName=safeName(S.root.name||"ScatolaDashboard"),rootZip=zip.folder(rootName);let files=[];async function scan(id,path){const items=await list(`'${id}' in parents and trashed=false`,"id,name,mimeType,size,modifiedTime");for(const f of items){if(f.mimeType==="application/vnd.google-apps.folder"){const next=path?path+"/"+safeName(f.name):safeName(f.name);rootZip.folder(next);await scan(f.id,next)}else files.push({f,path})}}await scan(S.root.id,"");updateProgress(0,files.length||1,files.length+" documenti da copiare...");let done=0,errors=[];for(const item of files){try{const got=await blobFor(item.f);rootZip.file(item.path?item.path+"/"+got.name:got.name,got.blob)}catch(e){errors.push(item.f.name+": "+e.message)}done++;updateProgress(done,files.length||1,`Copiati ${done} di ${files.length} documenti...`)}if(errors.length)rootZip.file("_BACKUP_AVVISI.txt","Alcuni file non sono stati esportati:\n"+errors.join("\n"));updateProgress(0,1,"Creazione archivio ZIP...");const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:4}},m=>updateProgress(m.percent,100,"Creazione ZIP: "+Math.round(m.percent)+"%"));const a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download="BACKUP_SCATOLA_"+new Date().toISOString().slice(0,10)+".zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);hideProgress();toast(errors.length?`Backup creato con ${errors.length} avvisi. Controlla il file _BACKUP_AVVISI.txt.`:"Backup completo scaricato sul computer!","ok")}catch(e){hideProgress();toast("Backup non riuscito: "+e.message,"err")}}
async function restoreZip(file){if(!file||!window.JSZip)return;const yes=confirm("Il ripristino aggiunge cartelle e file allo spazio Google Drive. Non cancella gli elementi esistenti. Continuare?");if(!yes)return;try{showProgress("Ripristino backup","Lettura archivio ZIP...");const zip=await JSZip.loadAsync(file),allEntries=Object.values(zip.files),rootPrefix=(allEntries.find(x=>x.name.includes("/"))?.name.split("/")[0]||"")+"/",entries=allEntries.filter(x=>!x.dir&&x.name.startsWith(rootPrefix)&&!x.name.includes("_BACKUP_AVVISI.txt")).map(x=>({...x,restoreName:x.name.slice(rootPrefix.length)})).filter(x=>x.restoreName);const folders=new Map([["",S.root.id]]);const paths=new Set();for(const e of allEntries){if(e.dir&&e.name.startsWith(rootPrefix)){const p=e.name.slice(rootPrefix.length).replace(/\/$/,"");if(p)paths.add(p)}}for(const e of entries){const parts=e.restoreName.split("/");parts.pop();for(let i=1;i<=parts.length;i++)paths.add(parts.slice(0,i).join("/"))}const ordered=[...paths].sort((a,b)=>a.split("/").length-b.split("/").length);for(const p of ordered){const parent=p.includes("/")?p.substring(0,p.lastIndexOf("/")):"";if(!folders.has(p)){const parentId=folders.get(parent)||S.root.id,folderName=p.split("/").pop(),existing=await list(`'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${qesc(folderName)}' and trashed=false`,"id,name");const f=existing[0]||await createFolder(folderName,parentId);folders.set(p,f.id)}}let done=0;for(const e of entries){const parts=e.restoreName.split("/"),name=parts.pop(),parent=parts.join("/"),blob=await e.async("blob");const meta={name,parents:[folders.get(parent)||S.root.id]};const init=await fetch(UPLOAD+"/files?uploadType=resumable&fields=id",{method:"POST",headers:{Authorization:"Bearer "+S.token,"Content-Type":"application/json","X-Upload-Content-Type":blob.type||"application/octet-stream","X-Upload-Content-Length":String(blob.size)},body:JSON.stringify(meta)});if(!init.ok)throw Error("Creazione file non riuscita: "+name);const put=await fetch(init.headers.get("Location"),{method:"PUT",headers:{"Content-Type":blob.type||"application/octet-stream"},body:blob});if(!put.ok)throw Error("Caricamento non riuscito: "+name);done++;updateProgress(done,entries.length,`Ripristinati ${done} di ${entries.length} file...`)}hideProgress();await loadCats();toast(`Ripristino completato: ${done} file aggiunti.`,"ok")}catch(e){hideProgress();toast("Ripristino interrotto: "+e.message,"err")}}
async function searchAll(q){
 const term=String(q||"").trim();
 const run=++S.searchRun;
 if(!term){E.searchResults.classList.add("hidden");E.searchResults.innerHTML="";return;}
 E.searchResults.classList.remove("hidden");E.searchResults.innerHTML='<p class="searchStatus">Ricerca in corso...</p>';
 const results=[];
 async function walk(id,path,chain){
  const items=await list(`'${id}' in parents and trashed=false`,"id,name,mimeType,webViewLink,parents,appProperties,size,folderColorRgb");
  for(const f of items){
   if(run!==S.searchRun)return;
   const p=path?path+" / "+f.name:f.name;
   const folder=f.mimeType==="application/vnd.google-apps.folder";
   const itemChain=folder?[...chain,f]:chain;
   if(f.name.toLocaleLowerCase("it").includes(term.toLocaleLowerCase("it")))results.push({f,path:p,chain:itemChain});
   if(folder)await walk(f.id,p,itemChain);
  }
 }
 await walk(S.root.id,"",[]);
 if(run!==S.searchRun)return;
 E.searchResults.innerHTML="";
 const heading=document.createElement("div");heading.className="searchHeading";
 heading.textContent=`Risultati per “${term}” · ${results.length} elementi`;
 E.searchResults.appendChild(heading);
 if(!results.length){const empty=document.createElement("p");empty.className="searchStatus";empty.textContent="Nessun risultato. Prova con un'altra parola o lettera.";E.searchResults.appendChild(empty);return;}
 results.sort((a,b)=>a.f.name.localeCompare(b.f.name,"it",{numeric:true}));
 for(const item of results){
  const folder=item.f.mimeType==="application/vnd.google-apps.folder";
  const row=document.createElement("div");row.className="searchItem";
  row.innerHTML=`<div class="searchInfo"><b>${esc(item.f.name)}</b><small>${esc(item.path)}</small></div><div class="searchActions"><button type="button" class="green resultOpen">${folder?"Apri cartella":"Apri"}</button>${item.f.mimeType==="application/pdf"?'<button type="button" class="blue resultPreview">Anteprima</button>':""}<button type="button" class="starBtn resultFav" aria-label="Aggiungi ai Preferiti" title="Aggiungi ai Preferiti">☆</button></div>`;
  const star=row.querySelector(".resultFav");if(item.f.appProperties?.scatolaFavorite==="true"){star.textContent="★";star.classList.add("isFavorite")}
  star.onclick=()=>toggleFavorite(item.f).catch(e=>toast(e.message,"err"));
  row.querySelector(".resultOpen").onclick=()=>{
   if(folder){S.stack=[{...S.root},...item.chain];E.filesModal.classList.remove("hidden");loadFiles(item.f).catch(e=>toast(e.message,"err"));}
   else if(item.f.webViewLink)window.open(item.f.webViewLink,"_blank");
   else toast("Non è disponibile un collegamento di apertura.");
  };
  row.querySelector(".resultPreview")?.addEventListener("click",()=>previewPdf(item.f).catch(e=>toast(e.message,"err")));
  E.searchResults.appendChild(row);
 }
}
E.saveClient.onclick=()=>{const v=E.clientId.value.trim();if(!v.includes(".apps.googleusercontent.com"))return alert("Client ID non valido");localStorage.setItem("scatola_client_id",v);E.setup.classList.add("hidden");toast("Client ID salvato. Ora premi Accedi con Google.","ok")};
E.googleCloud.onclick=()=>window.open("https://console.cloud.google.com/apis/library/drive.googleapis.com","_blank");E.login.onclick=()=>auth().catch(e=>toast(e.message,"err"));E.login2.onclick=()=>auth().catch(e=>toast(e.message,"err"));E.refresh.onclick=()=>loadCats().then(()=>toast("Aggiornato","ok")).catch(e=>toast(e.message,"err"));E.add.onclick=()=>addCat().catch(e=>toast(e.message,"err"));E.close.onclick=()=>E.filesModal.classList.add("hidden");E.pick.onclick=()=>S.active&&pick(S.active);E.fileInput.onchange=()=>S.active&&upload(S.active,[...E.fileInput.files]).catch(e=>toast(e.message,"err"));E.backup.onclick=backup;E.restore.onclick=()=>E.restoreInput.click();E.restoreInput.onchange=()=>restoreZip(E.restoreInput.files[0]);E.newFolder.onclick=()=>addSubfolder().catch(e=>toast(e.message,"err"));E.upLevel.onclick=()=>{if(S.stack.length>1){S.stack.pop();loadFiles(S.stack.at(-1))}};E.renameFolder.onclick=()=>rename(S.active);E.folderColor.onchange=async()=>{await patch(S.active.id,{folderColorRgb:driveColor(E.folderColor.value)});await refreshCurrent()};const runSearch=()=>searchAll(E.search.value).catch(e=>toast(e.message,"err"));E.searchBtn.onclick=runSearch;E.search.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();runSearch()}});E.search.oninput=()=>{clearTimeout(E.searchTimer);E.searchTimer=setTimeout(runSearch,250)};E.searchClear.onclick=()=>{E.search.value="";S.searchRun++;E.searchResults.classList.add("hidden");E.searchResults.innerHTML="";E.search.focus()};E.sortFiles.onchange=()=>{S.sortMode=E.sortFiles.value;if(S.active)loadFiles(S.active).catch(e=>toast(e.message,"err"))};
E.selectAllFiles.onchange=()=>{if(E.selectAllFiles.checked)S.currentFiles.forEach(f=>S.selectedFiles.add(f.id));else S.selectedFiles.clear();E.fileList.querySelectorAll(".fileSelect").forEach(cb=>{cb.checked=E.selectAllFiles.checked});renderSelectionToolbar()};
E.bulkMove.onclick=()=>moveSelectedFiles().catch(e=>toast(e.message,"err"));
E.bulkDelete.onclick=()=>deleteSelectedFiles().catch(e=>toast(e.message,"err"));
E.pdfClose.onclick=closePdfPreview;E.pdfPreview.addEventListener("click",e=>{if(e.target===E.pdfPreview)closePdfPreview()});["dragenter","dragover"].forEach(x=>E.drop.addEventListener(x,e=>{e.preventDefault();E.drop.classList.add("on")}));["dragleave","drop"].forEach(x=>E.drop.addEventListener(x,e=>{e.preventDefault();E.drop.classList.remove("on")}));E.drop.addEventListener("drop",e=>S.active&&upload(S.active,[...e.dataTransfer.files]).catch(er=>toast(er.message,"err")));
if(!clientId())setTimeout(openSetup,350);
})();
