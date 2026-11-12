/* ==================================================================
 * 07-projects.js
 * إدارة المشاريع: فتح وجديد وتكرار وحذف، ولوحة المشاريع.
 *
 * يعرّف: pname، openP، newP، delP، projSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            09-render.js، 22-toolbar.js
 * ================================================================== */

// ---- المشاريع ----
const pname=()=>(PJ.find(p=>p.id===pid)||{}).name||'بدون اسم';

function openP(id,nosave){
  if(!nosave)save();
  pid=id;polyDraft=null;$('#polybar').style.display='none';const d=kvGet('p:'+id)||{};setLY(d);shapes=d.shapes||[];V=kvGet('v:'+id)||d.V||{x:24,y:24,s:40};sel=[];hist=nh();cur=null;save();upd();draw();
}

function newP(name,sh,ly){
  save();polyDraft=null;$('#polybar').style.display='none';pid=uid();PJ.push({id:pid,name:name||`مشروع ${PJ.length+1}`});shapes=sh||[];setLY(ly||null);V={x:24,y:24,s:40};sel=[];hist=nh();save();upd();draw();
}

function delP(){
  kvDel('p:'+pid);kvDel('v:'+pid);
  if(PJ.length<2){shapes=[];setLY(null);V={x:24,y:24,s:40};sel=[];hist=nh();save();upd();draw();return}
  PJ=PJ.filter(p=>p.id!==pid);openP(PJ[0].id,1);
}

function projSheet(){
  const sh=$('#sheet');
  sh.innerHTML='<label>اسم المشروع<input id="pnm"></label><div class="pl"></div><div class="pactions"><button class="pact" id="pnew" title="مشروع جديد"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>جديد</button><button class="pact" id="pdup" title="تكرار المشروع"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>تكرار</button><button class="pact" id="pdel" title="حذف المشروع"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>حذف</button><button class="pact" id="psave" title="حفظ بصيغة JSON"><svg viewBox="0 0 24 24"><path d="M5 3h12l4 4v14H3V3z"/><path d="M7 3v6h10V3M7 21v-7h10v7"/></svg>حفظ</button><button class="pact" id="popen" title="فتح ملف JSON"><svg viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H3z"/><path d="M3 10h18l-2 10H5z"/></svg>فتح</button></div><button id="ok">تم</button>';
  const nm=$('#pnm'),pl=sh.querySelector('.pl');
  const fill=()=>{pl.textContent='';PJ.forEach(p=>{const b=document.createElement('button');b.className='pi'+(p.id===pid?' on':'');b.textContent=p.name||'بدون اسم';b.onclick=()=>{if(p.id!==pid){openP(p.id);nm.value=pname();fill()}};pl.append(b)})};
  nm.value=pname();fill();
  nm.oninput=()=>{const p=PJ.find(x=>x.id===pid);p.name=nm.value;save();$('#pn').textContent=pname();fill()};
  $('#pnew').onclick=()=>{newP();nm.value=pname();fill()};
  $('#pdup').onclick=()=>{newP(pname()+' (نسخة)',copy(shapes),{LY:copy(LY),cl});nm.value=pname();fill()};
  $('#psave').onclick=()=>exportFile();
  $('#popen').onclick=()=>{$('#finjson').value='';$('#finjson').click()};
  let armed=0;
  $('#pdel').onclick=e=>{
    const b=e.currentTarget;
    if(!armed){armed=1;b.textContent='تأكيد الحذف';setTimeout(()=>{armed=0;b.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>حذف'},3000);return}
    armed=0;b.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>حذف';delP();nm.value=pname();fill();
  };
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#finjson').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);

$('#pj').onclick=projSheet;
