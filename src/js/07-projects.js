/* ==================================================================
 * 07-projects.js
 * إدارة المشاريع: فتح وجديد وتكرار وحذف، ولوحة المشاريع.
 *
 * يعرّف: pname، META_KEYS، cleanMeta، metaGet، metaSet، openP، newP، delP، closeP، projSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            09-render.js، 22-toolbar.js
 * ================================================================== */

// ---- المشاريع ----
const pname=()=>(PJ.find(p=>p.id===pid)||{}).name||'بدون اسم';

// بيانات المشروع للوحة المطبوعة (المشروع/الموقع/المالك/المساحات/نوع اللوحة/المصمم/رقم اللوحة/التاريخ) وإعدادات الورقة والمقياس (pr).
// تُحفظ لكل مشروع في السجل 'm:<id>' وتُصدَّر مع ملف JSON تحت المفتاح meta. بيانات المكتب عامة وتُحفظ في الإعدادات (coGet في 21-settings.js).
const META_KEYS=['proj','loc','owner','land','built','kind','designer','no','date'];
// تنظيف أي كائن (من ملف مستورد أو من الواجهة): المفاتيح المعروفة فقط، نصوص مقصوصة؛ المفتاح الغائب يبقى غائبًا
function cleanMeta(m){
  const o={};
  if(!m||typeof m!=='object')return o;
  for(const k of META_KEYS)if(m[k]!==undefined&&m[k]!==null)o[k]=String(m[k]).slice(0,200);
  const pr=cleanPrint(m.pr);if(Object.keys(pr).length)o.pr=pr;
  return o;
}
// إعدادات ورقة الطباعة المحفوظة مع المشروع (meta.pr): الورقة والاتجاه والمقياس (0 = تلقائي) والشبكة وشريط المقياس وجدول العنوان.
// قيم غير صالحة تُسقط فيبقى الافتراضي؛ المفتاح الغائب يبقى غائبًا
function cleanPrint(p){
  const o={};
  if(!p||typeof p!=='object')return o;
  if(p.paper==='A4'||p.paper==='A3')o.paper=p.paper;
  if(p.orient==='auto'||p.orient==='port'||p.orient==='land')o.orient=p.orient;
  if(p.N!==undefined&&p.N!==null&&p.N!==''){const n=Number(p.N);if(Number.isFinite(n)&&n>=0&&n<=100000)o.N=Math.round(n)}
  for(const k of['grid','bar','titleBlock'])if(p[k]!==undefined&&p[k]!==null)o[k]=p[k]&&p[k]!=='0'?1:0;
  return o;
}
const metaGet=()=>Object.assign({},cleanMeta(kvGet('m:'+pid)));
function metaSet(patch){const m=Object.assign(metaGet(),cleanMeta(patch));kvSet('m:'+pid,m);return m}
// تاريخ اللوحة = تاريخ أول حفظ للمشروع: يُختم مرة واحدة إن لم يكن موجودًا (غائب لا فارغ)، ولا يتغير بعدها إلا بتعديل المستخدم.
// المشاريع القديمة بلا تاريخ تُختم عند أول فتح للوحة الطباعة.
function ensureMetaDate(){if(metaGet().date===undefined)metaSet({date:todayStr()})}

function openP(id,nosave){
  if(!nosave)save();
  pid=id;
  polyDraft=null;
  $('#polybar').style.display='none';
  const d=kvGet('p:'+id)||{};
  setLY(d);
  shapes=d.shapes||[];
  V=kvGet('v:'+id)||d.V||{x:24,y:24,s:40};
  sel=[];
  hist=nh();
  cur=null;
  save();
  upd();
  draw();
}

function newP(name,sh,ly,meta){
  save();
  polyDraft=null;
  $('#polybar').style.display='none';
  pid=uid();
  PJ.push({id:pid,name:name||`مشروع ${PJ.length+1}`});
  const mt=cleanMeta(meta);if(mt.date===undefined)mt.date=todayStr();kvSet('m:'+pid,mt);
  shapes=sh||[];
  setLY(ly||null);
  V={x:24,y:24,s:40};
  sel=[];
  hist=nh();
  save();
  upd();
  draw();
}

function delP(){
  kvDel('p:'+pid);kvDel('v:'+pid);kvDel('m:'+pid);
  if(PJ.length<2){shapes=[];setLY(null);V={x:24,y:24,s:40};sel=[];hist=nh();save();upd();draw();return}
  PJ=PJ.filter(p=>p.id!==pid);openP(PJ[0].id,1);
}

// إغلاق المشروع الحالي: يُحفظ على التخزين، ثم يُزال من قائمة المشاريع المفتوحة.
// لا تُحذف بياناته (p:<id>)، ويمكن استعادته لاحقًا من نسخة JSON احتياطية.
// إذا بقيت مشاريع مفتوحة ننتقل إلى الأقرب؛ وإذا لم يبقَ أي مشروع ننشئ مشروعًا فارغًا.
function closeP(){
  save();
  const i=PJ.findIndex(p=>p.id===pid);
  if(i<0)return;
  PJ=PJ.filter(p=>p.id!==pid);
  if(PJ.length){
    const nx=PJ[Math.min(i,PJ.length-1)];
    openP(nx.id,1);
  }else newP();
}

function projSheet(){
  const sh=$('#sheet');
  sh.innerHTML='<label>اسم المشروع<input id="pnm"></label><div class="pl"></div><div class="pactions"><button class="pact" id="pnew" title="مشروع جديد"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>جديد</button><button class="pact" id="pdup" title="تكرار المشروع"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>تكرار</button><button class="pact" id="pdel" title="إغلاق المشروع"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>إغلاق</button><button class="pact" id="psave" title="حفظ بصيغة JSON"><svg viewBox="0 0 24 24"><path d="M5 3h12l4 4v14H3V3z"/><path d="M7 3v6h10V3M7 21v-7h10v7"/></svg>حفظ</button><button class="pact" id="popen" title="فتح ملف JSON"><svg viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H3z"/><path d="M3 10h18l-2 10H5z"/></svg>فتح</button></div><button id="ok">تم</button>';
  const nm=$('#pnm'),pl=sh.querySelector('.pl');
  const fill=()=>{
    pl.textContent='';
    PJ.forEach(p=>{
      const b=document.createElement('button');
      b.className='pi'+(p.id===pid?' on':'');
      b.textContent=p.name||'بدون اسم';
      b.onclick=()=>{if(p.id!==pid){openP(p.id);nm.value=pname();fill()}};
      pl.append(b)
    })
  };
  nm.value=pname();fill();
  nm.oninput=()=>{const p=PJ.find(x=>x.id===pid);p.name=nm.value;save();$('#pn').textContent=pname();fill()};
  $('#pnew').onclick=()=>{newP();nm.value=pname();fill()};
  $('#pdup').onclick=()=>{newP(pname()+' (نسخة)',copy(shapes),{LY:copy(LY),cl},{...metaGet(),date:todayStr()});nm.value=pname();fill()};
  $('#psave').onclick=()=>exportFile({auto:true});
  $('#popen').onclick=()=>{$('#finjson').value='';$('#finjson').click()};
  $('#pdel').onclick=()=>{closeP();nm.value=pname();fill()};
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#finjson').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);

$('#pj').onclick=projSheet;
