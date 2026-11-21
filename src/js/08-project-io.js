/* ==================================================================
 * 08-project-io.js
 * حفظ الملفات واستيراد/تصدير المشروع — نموذج احترافي (AutoCAD / Illustrator):
 *
 *  • حفظ (Ctrl+S / زر الحفظ):
 *      - إذا كان للمشروع fileHandle (فُتح من قرص أو حُفظ باسم) → يكتب فيه مباشرةً بدون أي نافذة.
 *      - إذا كان مشروعاً جديداً → يفتح "حفظ باسم" مرة واحدة ثم يتذكر الـ handle.
 *      - الهاتف / بيئة بدون File System Access API → تنزيل مباشر صامت.
 *
 *  • حفظ باسم (Ctrl+Shift+S): دائماً يفتح نافذة اختيار الموقع والاسم،
 *      ثم يحفظ handle الجديد للمشروع.
 *
 *  • فتح (Ctrl+O): نافذة اختيار ملف → يفتح ويحفظ handle → Ctrl+S تالية بدون نافذة.
 *
 * يعرّف: saveFile، saveBlob، copyText، io، fileSave، fileSaveAs، fileOpen،
 *        exportFile، validateProjectData، impText، importFile، handleImportFile،
 *        handleImportFileHandle، exportChoice، importChoice
 * يعتمد على: 01-core.js، 07-projects.js، 17-dxf.js، 21-settings.js
 * ================================================================== */

// وصف نوع الملف في نافذة الحفظ
const FILE_KINDS={'.json':'ملف مشروع JSON','.dxf':'ملف DXF','.png':'صورة PNG','.pdf':'ملف PDF','.csv':'جدول CSV'};

// ── File System Access API ──────────────────────────────────────────
// هل المتصفح يدعم واجهة نظام الملفات الأصيلة (Chromium / Edge على الكمبيوتر)؟
const hasSavePicker=()=>typeof window.showSaveFilePicker==='function';
const hasOpenPicker=()=>typeof window.showOpenFilePicker==='function';

// مقبض الملف لكل مشروع: pid → FileSystemFileHandle
// يُخزَّن فقط في الذاكرة (لا يمكن تسلسله في IndexedDB لأسباب أمنية).
// يُمسح تلقائيًا عند إغلاق/تحديث الصفحة.
const _handles=new Map(); // pid → FileSystemFileHandle
const hGet=()=>_handles.get(pid)||null;
const hSet=h=>{if(h)_handles.set(pid,h);else _handles.delete(pid)};

// اسم الملف بلا امتداده (لتسمية المشروع المستورد باسم ملفه)
const fileBase=n=>String(n||'').replace(/^.*[\\\/]/,'').replace(/\.[^.]*$/,'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,60);

// ── saveBlob: نواة الحفظ ───────────────────────────────────────────
// opts.handle : FileSystemFileHandle محدد مسبقاً (يكتب فيه مباشرةً)
// opts.saveAs : true  → أجبر فتح نافذة "حفظ باسم" حتى لو كان هناك handle
// opts.auto   : true  → تنزيل صامت بدون أي نافذة (للهاتف / fallback)
// النتيجة: { status:'ok'|'no'|'err', handle? }
// ملاحظة: غلاف أندرويد (android-bridge.js) يستبدل saveFile و saveBlob بأكملهما.
async function saveBlob(name,blob,opts){
  opts=opts||{};
  const auto=!!opts.auto;

  // 1) كتابة مباشرة في handle موجود (حفظ سريع بدون نافذة)
  if(!opts.saveAs&&opts.handle){
    try{
      // طلب إذن الكتابة إن لزم (بعض المتصفحات تطلبه بعد فترة)
      if(opts.handle.queryPermission){
        const p=await opts.handle.queryPermission({mode:'readwrite'});
        if(p!=='granted'){
          const r=await opts.handle.requestPermission({mode:'readwrite'});
          if(r!=='granted')throw new Error('no-permission');
        }
      }
      const w=await opts.handle.createWritable();
      await w.write(blob);
      await w.close();
      return {status:'ok',handle:opts.handle};
    }catch(e){
      if(e?.message==='no-permission')return {status:'no'};
      // أي خطأ آخر → اسقط إلى نافذة حفظ باسم
    }
  }

  // 2) نافذة "حفظ باسم" الأصيلة (Chromium / Edge)
  if(hasSavePicker()&&!auto){
    try{
      const ext=((name.match(/\.[^.]+$/)||[''])[0]).toLowerCase();
      const mime=(blob.type||'application/octet-stream').split(';')[0];
      const po={suggestedName:name};
      if(ext)po.types=[{description:FILE_KINDS[ext]||'ملف',accept:{[mime]:[ext]}}];
      const handle=await window.showSaveFilePicker(po);
      const w=await handle.createWritable();
      await w.write(blob);
      await w.close();
      return {status:'ok',handle};
    }catch(e){
      if(e?.name==='AbortError')return {status:'no'};
      // خطأ غير متوقع (إطار معزول …) → جرب المسار التالي
    }
  }

  // 3) قائمة مشاركة الهاتف
  if(!auto)try{
    const file=new File([blob],name,{type:blob.type||'application/octet-stream'});
    if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){
      await navigator.share({files:[file],title:name});
      return {status:'ok'};
    }
  }catch(e){if(e?.name==='AbortError')return {status:'no'}}

  // 4) تنزيل عادي (fallback نهائي)
  try{
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    return {status:'ok'};
  }catch(e){return {status:'err'}}
}

// غلاف نصي (JSON …)
async function saveFile(name,text,opts){
  const r=await saveBlob(name,new Blob([text],{type:'application/json;charset=utf-8'}),opts);
  // توافق مع الكود القديم الذي يتوقع 'ok'|'no'|'err' كنتيجة مباشرة
  return (r&&r.status)?r.status:r;
}

// ── copyText ────────────────────────────────────────────────────────
async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}catch(e){}
  const ta=document.createElement('textarea');
  ta.value=t;ta.style.cssText='position:fixed;opacity:0';
  document.body.append(ta);ta.select();
  let ok=false;try{ok=document.execCommand('copy')}catch(e){}
  ta.remove();return ok;
}

// ── io: نافذة النص (نسخ / لصق) ────────────────────────────────────
function io(mode){
  const o=$('#io'),t=$('#iot'),a=$('#ioa'),m=$('#iop');o.hidden=false;
  if(mode==='export'){
    t.value=JSON.stringify({app:'plan',schemaVersion:2,v:2,name:pname(),unit:ST.unit||'m',meta:metaGet(),LY,cl,shapes});
    a.textContent='نسخ';
    m.textContent='هذه نسخة مشروع كاملة تشمل العناصر والطبقات. انسخ النص واحفظه لاستعادته لاحقًا.';
    a.onclick=()=>{
      t.focus();t.select();
      let ok=false;try{ok=document.execCommand('copy')}catch(e){}
      try{navigator.clipboard?.writeText(t.value).then(()=>{m.textContent='تم نسخ المشروع'}).catch(()=>{})}catch(e){}
      if(!ok)m.textContent='تم تحديد النص؛ اضغط مطولًا واختر نسخ.'
    };
  }else{
    t.value='';a.textContent='استيراد';m.textContent='الصق محتوى ملف JSON أو DXF ASCII هنا ثم اضغط استيراد.';
    try{navigator.clipboard?.readText().then(v=>{if(v&&v.trim()&&!t.value){t.value=v;m.textContent='تم لصق محتوى الحافظة — اضغط استيراد'}}).catch(()=>{})}catch(e){}
    a.onclick=()=>{
      try{impText(t.value);o.hidden=true;toast('تم استيراد المشروع')}
      catch(e){m.textContent=e?.message||'النص غير صالح أو غير مكتمل؛ تحقق من الملف ثم أعد المحاولة'}
    };
  }
}

// ── بناء بيانات المشروع ─────────────────────────────────────────────
function buildProjectData(){
  return {app:'plan',schemaVersion:2,v:2,name:pname(),unit:ST.unit||'m',
    createdAt:new Date().toISOString(),meta:metaGet(),LY,cl,shapes};
}
function projectFileName(){
  return (pname().replace(/[^\p{L}\p{N} _.()-]+/gu,'').trim()||'مشروع')+'.json';
}

// تحديث اسم المشروع من اسم الملف (بعد حفظ باسم أو فتح)
function _syncNameFromHandle(handle){
  if(!handle)return;
  try{
    const fn=fileBase(handle.name);
    if(fn){const p=PJ.find(x=>x.id===pid);if(p&&p.name!==fn){p.name=fn;save();$('#pn').textContent=pname()}}
  }catch(e){}
}

// ── fileSave: حفظ احترافي (مثل Ctrl+S في AutoCAD) ─────────────────
// - له handle → كتابة مباشرة بدون نافذة.
// - بدون handle (جديد) → يفتح حفظ باسم مرة واحدة.
// - الهاتف → تنزيل مباشر صامت.
const saveStatus=res=>res?.status||res;

async function fileSave(){
  const nm=projectFileName();
  const blob=new Blob([JSON.stringify(buildProjectData())],{type:'application/json;charset=utf-8'});
  const h=hGet();
  if(hasSavePicker()){
    if(h){
      // حفظ مباشر في الملف — بدون أي نافذة ✓
      const res=await saveBlob(nm,blob,{handle:h});
      if(saveStatus(res)==='ok'){toast(`✓ ${h.name||nm}`);return}
      if(saveStatus(res)==='no')return;
      // فشل → نفتح حفظ باسم
    }
    // مشروع جديد أو فشل → حفظ باسم (مرة واحدة)
    const res=await saveBlob(nm,blob,{});
    if(saveStatus(res)==='ok'&&res.handle){
      hSet(res.handle);
      _syncNameFromHandle(res.handle);
      toast(`✓ ${res.handle.name||nm}`);
    }
  }else{
    // هاتف / بيئة بدون API
    const res=await saveBlob(nm,blob,{auto:true});
    if(saveStatus(res)==='ok')
      toast(`✓ تم الحفظ${window.lastSavedWhere?' — '+window.lastSavedWhere:''}`);
    else if(saveStatus(res)==='err')io('export');
  }
}

// ── fileSaveAs: حفظ باسم — دائماً يفتح نافذة اختيار ───────────────
async function fileSaveAs(){
  const nm=projectFileName();
  const blob=new Blob([JSON.stringify(buildProjectData())],{type:'application/json;charset=utf-8'});
  if(hasSavePicker()){
    const res=await saveBlob(nm,blob,{saveAs:true});
    if(saveStatus(res)==='ok'&&res.handle){
      hSet(res.handle);
      _syncNameFromHandle(res.handle);
      toast(`✓ ${res.handle.name||nm}`);
    }
  }else{
    // هاتف: مشاركة أو تنزيل
    const res=await saveBlob(nm,blob,{auto:false});
    if(saveStatus(res)==='ok')toast(`✓ تم الحفظ — ${nm}`);
    else if(saveStatus(res)==='err')io('export');
  }
}

// ── fileOpen: فتح ملف احترافي (مثل Ctrl+O في AutoCAD) ─────────────
// الكمبيوتر: نافذة اختيار ملف → يفتح ويحفظ handle → Ctrl+S تالية بدون نافذة.
// الهاتف: <input type=file> العادي.
async function fileOpen(){
  if(hasOpenPicker()){
    try{
      const [handle]=await window.showOpenFilePicker({
        types:[{description:'ملفات MelkiCAD / DXF',
          accept:{'application/json':['.json'],'text/plain':['.dxf','.txt'],'*/*':[]}}],
        multiple:false
      });
      const file=await handle.getFile();
      await handleImportFileHandle(file,handle);
    }catch(e){
      if(e?.name!=='AbortError')toast('تعذّر فتح الملف');
    }
  }else{
    // هاتف: input file العادي
    $('#fin').value='';$('#fin').click();
  }
}

// ── exportFile: تصدير عام (للاستخدام القديم والـ DXF …) ────────────
// يبقى للتوافق مع الكود الآخر (الطباعة، DXF …)
async function exportFile(opts){
  const nm=projectFileName();
  const r=await saveFile(nm,JSON.stringify(buildProjectData()),opts||{});
  if(r==='ok')toast(opts&&opts.auto?`تم حفظ «${nm}»${window.lastSavedWhere?' في '+window.lastSavedWhere:''}`:' تم تصدير ملف المشروع');
  else if(r==='err')io('export');
}

// ── validateProjectData ─────────────────────────────────────────────
function validateProjectData(d){
  const types=new Set(['line','wall','rect','circle','arc','ellipse','tri','free','polyline','polygon','door','door2','win','dim','text','north','furn']);
  if(!d||!Array.isArray(d.shapes)||d.shapes.length>30000)throw new Error('عدد العناصر غير صالح');
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const lineType=v=>typeof v==='string'&&LINE_PATTERNS[v]?v:undefined;
  const point=p=>Array.isArray(p)&&p.length>=2&&finite(p[0])&&finite(p[1]);
  let total=0;
  const shapes=[];
  for(const raw of d.shapes){
    if(!raw||typeof raw!=='object'||!types.has(raw.t))continue;
    const s=JSON.parse(JSON.stringify(raw));
    const xy=['x','y','w','w1','w2','h','r','a','a0','a1','rot','th','off','f','lw','oa'];
    for(const key of xy){
      if(key==='a'&&['line','wall','dim'].includes(s.t))continue;
      if(s[key]!==undefined&&!finite(s[key]))throw new Error('قيمة هندسية غير صالحة')
    }
    if(['line','wall','dim'].includes(s.t)){if(!point(s.a)||!point(s.b))continue}
    else if(['rect','furn'].includes(s.t)){if(!finite(s.x)||!finite(s.y)||!finite(s.w)||!finite(s.h)||s.w<=0||s.h<=0)continue}
    else if(s.t==='circle'){if(!finite(s.x)||!finite(s.y)||!finite(s.r)||s.r<=0)continue}
    else if(s.t==='ellipse'){if(!finite(s.x)||!finite(s.y)||!finite(s.rx)||!finite(s.ry)||s.rx<=0||s.ry<=0)continue;s.rot=finite(s.rot)?s.rot:0}
    else if(s.t==='arc'){if(!finite(s.x)||!finite(s.y)||!finite(s.r)||s.r<=0||!finite(s.a0)||!finite(s.a1)||s.a1<=s.a0||s.a1-s.a0>Math.PI*2)continue}
    else if(['tri','free','polyline','polygon'].includes(s.t)){
      if(!Array.isArray(s.p)||s.p.length<(s.t==='tri'?3:2)||s.p.length>10000||!s.p.every(point))continue;
      total+=s.p.length
    }
    else if(['door','door2','win','text','north'].includes(s.t)){
      if(!finite(s.x)||!finite(s.y)||!finite(s.h)||s.h<=0)continue;
      if(['door','win'].includes(s.t)&&(!finite(s.w)||s.w<=0))continue;
      if(s.t==='door2'){if(!finite(s.w1)||!finite(s.w2)||s.w1<=0||s.w2<=0)continue;s.w=s.w1+s.w2;s.f=s.f===-1?-1:1}
      if(['door','door2'].includes(s.t))s.oa=finite(s.oa)?Math.max(0,Math.min(180,s.oa)):90
    }
    if(s.t==='text')s.txt=String(s.txt||'').slice(0,10000);
    if(s.t==='furn')s.k=String(s.k||'table').slice(0,40);
    if(s.ly!==undefined)s.ly=String(s.ly).slice(0,128);
    if(s.linetype!==undefined){const lt=lineType(s.linetype);if(lt)s.linetype=lt;else delete s.linetype}
    if(s.doubleLine!==true)delete s.doubleLine;
    if(s.doubleLineGap!==undefined&&!(finite(s.doubleLineGap)&&s.doubleLineGap>0&&s.doubleLineGap<=10))delete s.doubleLineGap;
    shapes.push(s);if(total>250000)throw new Error('المسارات في الملف كبيرة جدًا');
  }
  if(!shapes.length)throw new Error('لا توجد عناصر صالحة في المشروع');
  let LY=Array.isArray(d.LY)?d.LY.filter(l=>l&&typeof l==='object'&&typeof l.id==='string'&&typeof l.name==='string').slice(0,200):[];
  const ids=new Set();
  LY=LY.filter(l=>!ids.has(l.id)&&ids.add(l.id)).map(l=>({
    id:l.id.slice(0,128),
    name:l.name.slice(0,64),
    vis:l.vis===0?0:1,
    lock:l.lock?1:0,
    col:typeof l.col==='string'?l.col:undefined,
    linetype:lineType(l.linetype)
  }));
  if(!LY.length)LY=[{id:'l1',name:'طبقة 1',vis:1,lock:0}];
  const validIds=new Set(LY.map(l=>l.id));shapes.forEach(s=>{if(!validIds.has(s.ly))s.ly=LY[0].id});
  const cl=validIds.has(d.cl)?d.cl:LY[0].id;
  return{shapes,LY,cl,meta:cleanMeta(d.meta)};
}

// ── impText: استيراد نص (JSON / DXF) ───────────────────────────────
function impText(txt,fname){
  txt=String(txt).replace(/^\ufeff/,'');
  if(!/^\s*[\[{]/.test(txt)){dxfImport(txt,fname);return}
  const d=JSON.parse(txt);
  if(d&&Array.isArray(d.projects)){
    let n=0;
    d.projects.forEach(p=>{
      const q=p&&p.d;if(!q||!Array.isArray(q.shapes))return;
      try{const v=validateProjectData(q);newP(`${p.name||'مشروع'} (مستعاد)`,v.shapes,{LY:v.LY,cl:v.cl},v.meta);n++}catch(e){}
    });
    if(!n)throw new Error('لا توجد مشاريع صالحة في النسخة الاحتياطية');
    $('#sheet').classList.remove('on');return;
  }
  const v=validateProjectData(d);
  const importedName=fileBase(fname);
  newP(importedName||d.name||'مشروع',v.shapes,{LY:v.LY,cl:v.cl},v.meta);
  $('#sheet').classList.remove('on');
}

function importFile(){try{$('#fin').click()}catch(e){io('import')}}

// ── handleImportFile: استيراد من <input type=file> (هاتف/كمبيوتر) ──
async function handleImportFile(f,input){
  if(!f)return;
  let t;
  dxfEnc='';
  try{
    t=decodeImportBytes(new Uint8Array(await(f.arrayBuffer?f.arrayBuffer():new Promise((rs,rj)=>{
      const r=new FileReader();
      r.onload=()=>rs(r.result);
      r.onerror=rj;
      r.readAsArrayBuffer(f)
    }))))
  }catch(x){toast('تعذّرت قراءة الملف');return}
  if(input)input.value='';
  if(!t.trim()){toast('الملف فارغ');return}
  try{
    const isDxf=!/^\s*[\[{]/.test(t);
    impText(t,f.name);
    // بعد فتح ملف JSON بالطريقة الكلاسيكية لا يوجد handle — الحفظ التالي سيفتح حفظ باسم
    hSet(null);
    if(isDxf){toast('تمت قراءة ملف DXF؛ اختر وحدة القياس ثم اضغط «استيراد»')}
    else{$('#sheet').classList.remove('on');toast('تم فتح الملف')}
  }catch(x){console.error('Import error:',x);toast(`لم أتعرف على «${f.name}»: تحقق من أن الملف JSON أو DXF ASCII`)}
}

// ── handleImportFileHandle: استيراد مع حفظ handle (fileOpen) ────────
// يستدعى من fileOpen فيحتفظ بـ handle → Ctrl+S تالية تكتب في نفس الملف بدون نافذة.
async function handleImportFileHandle(f,handle){
  if(!f)return;
  let t;dxfEnc='';
  try{t=decodeImportBytes(new Uint8Array(await f.arrayBuffer()))}
  catch(x){toast('تعذّرت قراءة الملف');return}
  if(!t.trim()){toast('الملف فارغ');return}
  try{
    const isDxf=!/^\s*[\[{]/.test(t);
    impText(t,f.name);
    if(!isDxf&&handle){
      // احفظ handle للمشروع المُفتَح حديثاً (pid تغيّر بعد newP داخل impText)
      _handles.set(pid,handle);
    }
    if(isDxf){toast('تمت قراءة ملف DXF؛ اختر وحدة القياس ثم اضغط «استيراد»')}
    else{$('#sheet').classList.remove('on');toast(`تم فتح «${f.name}»`)}
  }catch(x){console.error('Import error:',x);toast(`لم أتعرف على «${f.name}»: تحقق من أن الملف JSON أو DXF ASCII`)}
}

$('#fin').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);

// ── exportChoice: لوحة التصدير ─────────────────────────────────────
function exportChoice(){
  const sh=$('#sheet');
  sh.innerHTML='<b>تصدير المشروع</b><p>اختر صيغة الملف التي تريدها</p>'
    +'<div class="row">'
    +'<button class="fl" id="exjson">JSON — ملف المشروع</button>'
    +'<button class="fl" id="exdxf">DXF — AutoCAD</button>'
    +'</div><button id="ok">رجوع</button>';
  $('#exjson').onclick=()=>{sh.classList.remove('on');fileSaveAs()};
  $('#exdxf').onclick=exportDXF;
  $('#ok').onclick=settingsSheet;
  sh.classList.add('on')
}

// ── importChoice: لوحة الاستيراد ───────────────────────────────────
function importChoice(){
  const sh=$('#sheet');
  sh.innerHTML='<b>فتح / استيراد</b><p>افتح ملف مشروع JSON أو DXF، أو الصق محتوى الملف نصيًا.</p>'
    +'<div class="row">'
    +'<label class="fl lb">اختيار ملف<input type="file" id="fin2" accept=".json,.dxf,.txt,application/json,text/plain,*/*"></label>'
    +'<button class="fl" id="pasteimp">لصق محتوى نصي</button>'
    +'</div><button id="ok">رجوع</button>';
  $('#fin2').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);
  $('#pasteimp').onclick=()=>io('import');
  $('#ok').onclick=settingsSheet;
  sh.classList.add('on')
}

// ── ربط أزرار الشريط العلوي ────────────────────────────────────────
// يُنفَّذ بعد تحميل DOM (الملف يُحمَّل في النهاية بعد index.html)
(function(){
  const b_open=$('#hdr-open'),b_save=$('#hdr-save'),b_saveas=$('#hdr-saveas');
  if(b_open)b_open.onclick=()=>fileOpen();
  if(b_save)b_save.onclick=()=>fileSave();
  if(b_saveas)b_saveas.onclick=()=>fileSaveAs();
})();
