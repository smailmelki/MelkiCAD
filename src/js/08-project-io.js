/* ==================================================================
 * 08-project-io.js
 * حفظ الملفات واستيراد/تصدير المشروع: حفظ ملف أو Blob، نسخ النص، تصدير JSON،
 * استيراد JSON/DXF مع التحقق، ولوحتا اختيار الصيغة.
 *
 * يعرّف: saveFile، saveBlob، copyText، io، exportFile، validateProjectData، impText،
 *        importFile، handleImportFile، exportChoice، importChoice
 * يعتمد على: 01-core.js، 07-projects.js، 17-dxf.js، 21-settings.js
 * ================================================================== */

async function saveFile(name,text){
  if(window.claude){
    let d=null;try{d=await claude.use('downloads')}catch(e){}
    if(d){try{await d.save({filename:name,data:text});return 'ok'}catch(e){return e&&e.code==='declined'?'no':'text'}}
    return 'text';
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=name;document.body.append(a);a.click();a.remove();return 'ok';
}

async function saveBlob(name,blob){
  if(window.claude){
    let d=null;try{d=await claude.use('downloads')}catch(e){}
    if(d){try{await d.save({filename:name,data:blob});return 'ok'}catch(e){return e&&e.code==='declined'?'no':(e&&e.code==='rejected_extension'?'ext':'err')}}
    return 'err';
  }
  // استخدم نافذة الحفظ الأصلية عندما يدعمها المتصفح، لتحديد الاسم والمجلد.
  if(typeof window.showSaveFilePicker==='function'){
    try{
      const ext=(name.match(/\\.[^.]+$/)||['.dxf'])[0];
      const mime=blob.type||'application/octet-stream';
      const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'ملف DXF',accept:{[mime]:[ext]}}]});
      const stream=await handle.createWritable();await stream.write(blob);await stream.close();return 'ok';
    }catch(e){if(e&&e.name==='AbortError')return 'no';return 'err'}
  }
  // على الهواتف التي لا تدعم نافذة اختيار الملف، افتح قائمة المشاركة
  // حتى يتمكن المستخدم من اختيار تطبيق الملفات أو وجهة الحفظ المتاحة.
  try{
    const file=new File([blob],name,{type:blob.type||'application/octet-stream'});
    if(navigator.canShare&&navigator.canShare({files:[file]})&&navigator.share){await navigator.share({files:[file],title:name});return 'ok'}
  }catch(e){if(e&&e.name==='AbortError')return 'no'}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return 'ok';
}

async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}catch(e){}
  const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();return ok;
}

function io(mode){
  const o=$('#io'),t=$('#iot'),a=$('#ioa'),m=$('#iop');o.hidden=false;
  if(mode==='export'){
    t.value=JSON.stringify({app:'plan',schemaVersion:2,v:2,name:pname(),unit:ST.unit||'m',LY,cl,shapes});
    a.textContent='نسخ';
    m.textContent='هذه نسخة مشروع كاملة تشمل العناصر والطبقات. انسخ النص واحفظه لاستعادته لاحقًا.';
    a.onclick=()=>{t.focus();t.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){};try{navigator.clipboard?.writeText(t.value).then(()=>{m.textContent='تم نسخ المشروع'}).catch(()=>{})}catch(e){}if(!ok)m.textContent='تم تحديد النص؛ اضغط مطولًا واختر نسخ.'};
  }else{
    t.value='';a.textContent='استيراد';m.textContent='الصق محتوى ملف JSON أو DXF ASCII هنا ثم اضغط استيراد.';
    try{navigator.clipboard?.readText().then(v=>{if(v&&v.trim()&&!t.value){t.value=v;m.textContent='تم لصق محتوى الحافظة — اضغط استيراد'}}).catch(()=>{})}catch(e){}
    a.onclick=()=>{
      try{impText(t.value);o.hidden=true;toast('تم استيراد المشروع')}
      catch(e){m.textContent=e?.message||'النص غير صالح أو غير مكتمل؛ تحقق من الملف ثم أعد المحاولة'}
    };
  }
}

async function exportFile(){
  const nm=(pname().replace(/[^\p{L}\p{N} _.()-]+/gu,'').trim()||'مشروع')+'.json';
  const data={app:'plan',schemaVersion:2,v:2,name:pname(),unit:ST.unit||'m',createdAt:new Date().toISOString(),LY,cl,shapes};
  const r=await saveFile(nm,JSON.stringify(data));
  if(r==='ok')toast('تم حفظ ملف المشروع الكامل');else if(r==='text')io('export');
}

function validateProjectData(d){
  const types=new Set(['line','wall','rect','circle','arc','ellipse','tri','free','polyline','polygon','door','win','dim','text','north','furn']);
  if(!d||!Array.isArray(d.shapes)||d.shapes.length>30000)throw new Error('عدد العناصر غير صالح');
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const point=p=>Array.isArray(p)&&p.length>=2&&finite(p[0])&&finite(p[1]);
  let total=0;
  const shapes=[];
  for(const raw of d.shapes){
    if(!raw||typeof raw!=='object'||!types.has(raw.t))continue;
    const s=JSON.parse(JSON.stringify(raw));
    const xy=['x','y','w','h','r','a','a0','a1','rot','th','off','f','lw'];
    for(const key of xy){if(key==='a'&&['line','wall','dim'].includes(s.t))continue;if(s[key]!==undefined&&!finite(s[key]))throw new Error('قيمة هندسية غير صالحة')}
    if(['line','wall','dim'].includes(s.t)){if(!point(s.a)||!point(s.b))continue}
    else if(['rect','furn'].includes(s.t)){if(!finite(s.x)||!finite(s.y)||!finite(s.w)||!finite(s.h)||s.w<=0||s.h<=0)continue}
    else if(s.t==='circle'){if(!finite(s.x)||!finite(s.y)||!finite(s.r)||s.r<=0)continue}
    else if(s.t==='ellipse'){if(!finite(s.x)||!finite(s.y)||!finite(s.rx)||!finite(s.ry)||s.rx<=0||s.ry<=0)continue;s.rot=finite(s.rot)?s.rot:0}
    else if(s.t==='arc'){if(!finite(s.x)||!finite(s.y)||!finite(s.r)||s.r<=0||!finite(s.a0)||!finite(s.a1)||s.a1<=s.a0||s.a1-s.a0>Math.PI*2)continue}
    else if(['tri','free','polyline','polygon'].includes(s.t)){if(!Array.isArray(s.p)||s.p.length<(s.t==='tri'?3:2)||s.p.length>10000||!s.p.every(point))continue;total+=s.p.length}
    else if(['door','win','text','north'].includes(s.t)){if(!finite(s.x)||!finite(s.y)||!finite(s.h)||s.h<=0)continue;if(['door','win'].includes(s.t)&&(!finite(s.w)||s.w<=0))continue}
    if(s.t==='text')s.txt=String(s.txt||'').slice(0,10000);
    if(s.t==='furn')s.k=String(s.k||'table').slice(0,40);
    if(s.ly!==undefined)s.ly=String(s.ly).slice(0,128);
    shapes.push(s);if(total>250000)throw new Error('المسارات في الملف كبيرة جدًا');
  }
  if(!shapes.length)throw new Error('لا توجد عناصر صالحة في المشروع');
  let LY=Array.isArray(d.LY)?d.LY.filter(l=>l&&typeof l==='object'&&typeof l.id==='string'&&typeof l.name==='string').slice(0,200):[];
  const ids=new Set();LY=LY.filter(l=>!ids.has(l.id)&&ids.add(l.id)).map(l=>({id:l.id.slice(0,128),name:l.name.slice(0,64),vis:l.vis===0?0:1,lock:l.lock?1:0,col:typeof l.col==='string'?l.col:undefined}));
  if(!LY.length)LY=[{id:'l1',name:'طبقة 1',vis:1,lock:0}];
  const validIds=new Set(LY.map(l=>l.id));shapes.forEach(s=>{if(!validIds.has(s.ly))s.ly=LY[0].id});
  const cl=validIds.has(d.cl)?d.cl:LY[0].id;
  return{shapes,LY,cl};
}

function impText(txt){
  txt=String(txt).replace(/^\ufeff/,'');
  if(!/^\s*[\[{]/.test(txt)){dxfImport(txt);return}
  const d=JSON.parse(txt);
  if(d&&Array.isArray(d.projects)){
    let n=0;
    d.projects.forEach(p=>{
      const q=p&&p.d;if(!q||!Array.isArray(q.shapes))return;
      try{const v=validateProjectData(q);newP(`${p.name||'مشروع'} (مستعاد)`,v.shapes,{LY:v.LY,cl:v.cl});n++}catch(e){}
    });
    if(!n)throw new Error('لا توجد مشاريع صالحة في النسخة الاحتياطية');
    $('#sheet').classList.remove('on');return;
  }
  const v=validateProjectData(d);
  newP(d.name||'مشروع',v.shapes,{LY:v.LY,cl:v.cl});
  $('#sheet').classList.remove('on');
}

function importFile(){try{$('#fin').click()}catch(e){io('import')}}

async function handleImportFile(f,input){if(!f)return;let t;try{t=await(f.text?f.text():new Promise((rs,rj)=>{const r=new FileReader();r.onload=()=>rs(r.result);r.onerror=rj;r.readAsText(f)}))}catch(x){toast('تعذّرت قراءة الملف');return}if(input)input.value='';if(!t.trim()){toast('الملف فارغ');return}try{const isDxf=!/^\s*[\[{]/.test(t);impText(t);if(isDxf){toast('تمت قراءة ملف DXF؛ اختر وحدة القياس ثم اضغط «استيراد»')}else{$('#sheet').classList.remove('on');toast('تم استيراد الملف')}}catch(x){console.error('Import error:',x);toast(`لم أتعرف على «${f.name}»: تحقق من أن الملف JSON أو DXF ASCII`)}}

$('#fin').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);

function exportChoice(){const sh=$('#sheet');sh.innerHTML='<b>تصدير المشروع</b><p>اختر صيغة الملف التي تريدها</p><div class="row"><button class="fl" id="exjson">JSON — ملف المشروع</button><button class="fl" id="exdxf">DXF — AutoCAD</button></div><button id="ok">رجوع</button>';$('#exjson').onclick=exportFile;$('#exdxf').onclick=exportDXF;$('#ok').onclick=settingsSheet;sh.classList.add('on')}

function importChoice(){const sh=$('#sheet');sh.innerHTML='<b>استيراد</b><p>استيراد مشروع JSON أو ملف DXF، أو لصق محتوى الملف نصيًا.</p><div class="row"><label class="fl lb">اختيار ملف<input type="file" id="fin2" accept=".json,.dxf,.txt,application/json,application/dxf,text/plain"></label><button class="fl" id="pasteimp">لصق محتوى نصي</button></div><button id="ok">رجوع</button>';$('#fin2').onchange=e=>handleImportFile(e.target.files&&e.target.files[0],e.target);$('#pasteimp').onclick=()=>io('import');$('#ok').onclick=settingsSheet;sh.classList.add('on')}
