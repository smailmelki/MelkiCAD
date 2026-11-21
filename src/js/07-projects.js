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
  sh.classList.add('is-file-menu');
  sh.innerHTML=`
    <div class="fmenu">
      <div class="fmenu-head">
        <div class="fmenu-title">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <b>ملف</b>
        </div>
        <button id="ok" class="fmenu-close" title="إغلاق">✕</button>
      </div>

      <div class="fmenu-name-row">
        <label for="pnm">المشروع الحالي</label>
        <input id="pnm" placeholder="اسم المشروع..." autocomplete="off">
      </div>

      <div class="fmenu-actions">
        <button class="fmenu-item" id="pnew" title="مشروع جديد (Ctrl+N)">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg></span>
          <span class="fmenu-label">مشروع جديد</span>
          <kbd class="fmenu-kbd">Ctrl+N</kbd>
        </button>

        <button class="fmenu-item" id="popen" title="فتح ملف (Ctrl+O)">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H3z"/><path d="M3 10h18l-2 10H5z"/></svg></span>
          <span class="fmenu-label">فتح ملف...</span>
          <kbd class="fmenu-kbd">Ctrl+O</kbd>
        </button>

        <button class="fmenu-item" id="psave" title="حفظ (Ctrl+S)">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span>
          <span class="fmenu-label">حفظ</span>
          <kbd class="fmenu-kbd">Ctrl+S</kbd>
        </button>

        <button class="fmenu-item" id="psaveas" title="حفظ باسم (Ctrl+Shift+S)">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/><circle cx="17.5" cy="17.5" r="3.5" fill="var(--ui)" stroke="currentColor"/><path d="M17.5 16v3M16 17.5h3"/></svg></span>
          <span class="fmenu-label">حفظ باسم...</span>
          <kbd class="fmenu-kbd">Ctrl+Shift+S</kbd>
        </button>

        <div class="fmenu-sep"></div>

        <button class="fmenu-item" id="pexport" title="تصدير بصيغة DXF أو JSON">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
          <span class="fmenu-label">تصدير (DXF / JSON)...</span>
          <span class="fmenu-arrow">‹</span>
        </button>

        <button class="fmenu-item" id="pprint" title="طباعة أو تصدير PDF (Ctrl+P)">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/><path d="M18 12h.01"/></svg></span>
          <span class="fmenu-label">طباعة المخطط / PDF...</span>
          <kbd class="fmenu-kbd">Ctrl+P</kbd>
        </button>

        <div class="fmenu-sep"></div>

        <button class="fmenu-item" id="pdup" title="تكرار المشروع الحالي">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          <span class="fmenu-label">تكرار المشروع (نسخة)</span>
        </button>

        <button class="fmenu-item danger" id="pdel" title="إغلاق المشروع الحالي">
          <span class="fmenu-icon"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg></span>
          <span class="fmenu-label">إغلاق المشروع</span>
        </button>
      </div>

      <div class="fmenu-recents-hdr">
        <span>المشاريع المفتوحة</span>
        <span class="fmenu-badge" id="pjcount"></span>
      </div>
      <div class="pl fmenu-recents" id="pjlist"></div>
    </div>
  `;
  const nm=$('#pnm'),pl=$('#pjlist'),count=$('#pjcount');
  const fill=()=>{
    pl.textContent='';
    if(count)count.textContent=String(PJ.length);
    PJ.forEach(p=>{
      const isCur = p.id===pid;
      const b=document.createElement('button');
      b.className='pi fmenu-proj-item'+(isCur?' on':'');
      b.innerHTML=`
        <svg viewBox="0 0 24 24" class="fmenu-proj-ico"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        <span class="fmenu-proj-name">${esc(p.name||'بدون اسم')}</span>
        ${isCur?'<span class="fmenu-proj-badge">نشط</span>':''}
      `;
      b.onclick=()=>{if(p.id!==pid){openP(p.id);nm.value=pname();fill()}};
      pl.append(b);
    });
  };
  nm.value=pname();fill();
  nm.oninput=()=>{const p=PJ.find(x=>x.id===pid);if(p){p.name=nm.value;save();$('#pn').textContent=pname();fill()}};
  $('#pnew').onclick=()=>{sh.classList.remove('on','is-file-menu');newP()};
  $('#popen').onclick=()=>{sh.classList.remove('on','is-file-menu');fileOpen()};
  $('#psave').onclick=()=>{sh.classList.remove('on','is-file-menu');fileSave()};
  $('#psaveas').onclick=()=>{sh.classList.remove('on','is-file-menu');fileSaveAs()};
  $('#pexport').onclick=()=>{sh.classList.remove('is-file-menu');exportChoice()};
  $('#pprint').onclick=()=>{sh.classList.remove('on','is-file-menu');$('#shot').click()};
  $('#pdup').onclick=()=>{newP(pname()+' (نسخة)',copy(shapes),{LY:copy(LY),cl},{...metaGet(),date:todayStr()});nm.value=pname();fill()};
  $('#pdel').onclick=()=>{closeP();nm.value=pname();fill()};
  $('#ok').onclick=()=>{sh.classList.remove('on','is-file-menu');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#finjson').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);

$('#pj').onclick=projSheet;
