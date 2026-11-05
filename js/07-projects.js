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
  pid=id;polyDraft=null;$('#polybar').style.display='none';const d=lsGet('p:'+id)||{};setLY(d);shapes=d.shapes||[];V=d.V||{x:24,y:24,s:40};sel=[];hist=nh();cur=null;save();upd();draw();
}

function newP(name,sh,ly){
  save();polyDraft=null;$('#polybar').style.display='none';pid=uid();PJ.push({id:pid,name:name||`مشروع ${PJ.length+1}`});shapes=sh||[];setLY(ly||null);V={x:24,y:24,s:40};sel=[];hist=nh();save();upd();draw();
}

function delP(){
  try{localStorage.removeItem(K+'p:'+pid)}catch(e){}
  if(PJ.length<2){shapes=[];setLY(null);V={x:24,y:24,s:40};sel=[];hist=nh();save();upd();draw();return}
  PJ=PJ.filter(p=>p.id!==pid);openP(PJ[0].id,1);
}

function projSheet(){
  const sh=$('#sheet');
  sh.innerHTML='<label>اسم المشروع<input id="pnm"></label><div class="pl"></div><div class="row"><button class="fl" id="pnew">جديد</button><button class="fl" id="pdup">تكرار</button><button class="fl" id="pdel">حذف</button></div><button id="ok">تم</button>';
  const nm=$('#pnm'),pl=sh.querySelector('.pl');
  const fill=()=>{pl.textContent='';PJ.forEach(p=>{const b=document.createElement('button');b.className='pi'+(p.id===pid?' on':'');b.textContent=p.name||'بدون اسم';b.onclick=()=>{if(p.id!==pid){openP(p.id);nm.value=pname();fill()}};pl.append(b)})};
  nm.value=pname();fill();
  nm.oninput=()=>{const p=PJ.find(x=>x.id===pid);p.name=nm.value;save();$('#pn').textContent=pname();fill()};
  $('#pnew').onclick=()=>{newP();nm.value=pname();fill()};
  $('#pdup').onclick=()=>{newP(`${pname()} (نسخة)`,copy(shapes),{LY:copy(LY),cl});nm.value=pname();fill()};
  let armed=0;
  $('#pdel').onclick=e=>{
    const b=e.currentTarget;
    if(!armed){armed=1;b.textContent='تأكيد الحذف';setTimeout(()=>{armed=0;b.textContent='حذف'},3000);return}
    armed=0;b.textContent='حذف';delP();nm.value=pname();fill();
  };
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#pj').onclick=projSheet;
