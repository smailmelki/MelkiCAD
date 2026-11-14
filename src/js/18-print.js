/* ==================================================================
 * 18-print.js
 * الطباعة والتصدير: ورقة A4/A3 بمقياس رسم وإطار مزدوج وجدول عنوان من ثلاثة أعمدة
 * (المكتب | المشروع والمالك | اللوحة والاعتماد)، وحفظ PNG أو PDF.
 * بيانات المكتب من الإعدادات (coGet) وبيانات المشروع تُحفظ مع المشروع (metaGet) وتُدخَل في لوحة الطباعة.
 *
 * يعرّف: EX، todayStr، areaText، sheetMeta، sheetLayout، drawTitleBlock، renderSheet، sheetPdfBytes، makePDF، doExport، exportSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 06-layers.js، 07-projects.js،
 *            08-project-io.js، 09-render.js، 10-dimensions.js، 18a-pdf.js، 21-settings.js، 22-toolbar.js
 * ================================================================== */

// ---- التصدير: PNG أو PDF بمقياس رسم على ورقة A4/A3 مع إطار وجدول عنوان ----
let EX={paper:'A4',orient:'auto',N:0,grid:0,bar:0};

// تاريخ اليوم بالتوقيت المحلي (YYYY-MM-DD)
const todayStr=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};

// «الأرض: 5000 م² | البناء: 2000 م²»؛ الرقم وحده تُضاف له وحدة م²، وما فيه حروف يبقى كما كتبه المستخدم
function areaText(m){
  const u=v=>/^[\d٠-٩.,٫\s]+$/.test(v)?v.trim()+' م²':v.trim();
  return[['الأرض',m.land],['البناء',m.built]].filter(([,v])=>v&&String(v).trim()).map(([l,v])=>`${l}: ${u(String(v))}`).join('  |  ');
}

// القيم الفعلية للطباعة: المحفوظة مع المشروع، والفارغ يأخذ الافتراضي (اسم المشروع، «مسقط أفقي»، تاريخ اليوم)
function sheetMeta(){
  const m=metaGet();
  return Object.assign({},m,{proj:(m.proj||'').trim()||pname(),kind:m.kind===undefined?'مسقط أفقي':m.kind,date:(m.date||'').trim()||todayStr()});
}

function sheetLayout(o){
  const vis=shapes.filter(s=>shown(s));if(!vis.length)return null;
  const BB=bounds(vis),x0=BB.x,y0=BB.y,x1=BB.X,y1=BB.Y,bw=Math.max(x1-x0,.1),bh=Math.max(y1-y0,.1);
  const dim={A4:[297,210],A3:[420,297]}[o.paper],land=o.orient==='land'?true:o.orient==='port'?false:bw>=bh,pw=land?dim[0]:dim[1],ph=land?dim[1]:dim[0];
  // tb: ارتفاع جدول العنوان (صف عناوين hh + 4 صفوف بيانات)
  const dpi=150,m=10,fr=5,hh=6.5,tb=42,aw=pw-2*(m+fr),ah=ph-2*(m+fr)-tb;
  const need=N=>bw*1000/N<=aw&&bh*1000/N<=ah;
  const N=o.N||[10,20,25,50,75,100,125,150,200,250,300,400,500,750,1000,2000,5000].find(need)||5000;
  return{x0,y0,bw,bh,pw,ph,dpi,m,fr,hh,tb,aw,ah,N,fits:need(N),mm:v=>v/25.4*dpi};
}

// جدول العنوان: ثلاثة أعمدة من اليمين (المكتب 28% | المشروع والمالك 44% | اللوحة والاعتماد 28%)،
// صف عناوين ثم أربعة صفوف، في كل خانة عنوان صغير رمادي فوق القيمة. يستعمل واجهة Canvas الأساسية فقط (يعمل مع PdfRecorder).
function drawTitleBlock(g2,L,o,mt,co){
  const mm=L.mm,tx=mm(L.m),ty=mm(L.ph-L.m-L.tb),tw=mm(L.pw-2*L.m),th=mm(L.tb),hh=mm(L.hh),rh=(th-hh)/4;
  const ink='#15324b',dim='#6b7d8e',soft='#d3dce4',mid='#9fb0bf',head='#eaf0f4',pad=mm(2.5);
  const cx=[tx,tx+tw*.28,tx+tw*.72,tx+tw];
  const cols=[
    {x0:cx[2],x1:cx[3],hd:(co.kind||'').trim()||CO_KIND,icon:1,rows:[['اسم المكتب',co.name],['الهاتف',co.phone],['البريد الإلكتروني',co.email],['العنوان',co.addr]]},
    {x0:cx[1],x1:cx[2],hd:'بيانات المشروع والمالك',rows:[['المشروع / نوع المبنى',mt.proj],['موقع المشروع',mt.loc],['اسم المالك',mt.owner],['مساحة الأرض / البناء',areaText(mt)]]},
    {x0:cx[0],x1:cx[1],hd:'بيانات اللوحة والاعتماد',rows:[['نوع اللوحة',mt.kind],['مقياس الرسم',`1 : ${L.N}`],['المصمم / الاستشاري',mt.designer],['رقم اللوحة / التاريخ',[mt.no,mt.date].filter(v=>v&&String(v).trim()).join('  |  ')]]}
  ];
  const txt=(s,xr,yc,w,sz,col,wt)=>{
    s=String(s==null?'':s);if(!s.trim())return;
    g2.textAlign='right';g2.textBaseline='middle';g2.direction=/[\u0600-\u06FF]/.test(s)?'rtl':'ltr';
    g2.font=`${wt||400} ${mm(sz)}px ${FONT}`;g2.fillStyle=col;g2.fillText(s,xr,yc,w);
  };
  g2.fillStyle=head;g2.fillRect(tx,ty,tw,hh);
  g2.strokeStyle=soft;g2.lineWidth=mm(.25);g2.beginPath();
  for(let i=0;i<4;i++){const y=ty+hh+i*rh;g2.moveTo(tx,y);g2.lineTo(tx+tw,y)}
  g2.stroke();
  g2.strokeStyle=mid;g2.lineWidth=mm(.3);g2.beginPath();
  [cx[1],cx[2]].forEach(x=>{g2.moveTo(x,ty);g2.lineTo(x,ty+th)});
  g2.stroke();
  g2.strokeStyle=ink;g2.lineWidth=mm(.5);g2.beginPath();g2.moveTo(tx,ty);g2.lineTo(tx+tw,ty);g2.stroke();
  cols.forEach(c=>{
    const w=c.x1-c.x0-2*pad;
    txt(c.hd,c.x1-pad,ty+hh/2,w-(c.icon?mm(7):0),3.4,ink,600);
    c.rows.forEach(([lab,val],r)=>{
      const y=ty+hh+r*rh;
      txt(lab,c.x1-pad,y+mm(2.2),w,2.4,dim);
      txt(val,c.x1-pad,y+mm(6),w,3.5,ink);
    });
    if(c.icon){   // أيقونة بيت صغيرة في طرف خانة العنوان
      const s=mm(4.6),ix=c.x0+mm(3),iy=ty+(hh-s)/2;
      g2.strokeStyle=ink;g2.lineWidth=mm(.25);g2.strokeRect(ix,iy,s,s);
      g2.beginPath();
      g2.moveTo(ix+s*.2,iy+s*.5);g2.lineTo(ix+s*.5,iy+s*.22);g2.lineTo(ix+s*.8,iy+s*.5);
      g2.moveTo(ix+s*.3,iy+s*.45);g2.lineTo(ix+s*.3,iy+s*.78);g2.lineTo(ix+s*.7,iy+s*.78);g2.lineTo(ix+s*.7,iy+s*.45);
      g2.stroke();
    }
  });
}

// mk (اختياري): (عرض,ارتفاع,تخطيط) ← سطح رسم بديل عن Canvas (مسجِّل PDF)؛ حينها لا يُنشأ oc ويعود السطح في g2
function renderSheet(o,mk){syncDims();
  const L=sheetLayout(o);if(!L)return null;
  const mm=L.mm,Wp=Math.round(mm(L.pw)),Hp=Math.round(mm(L.ph)),oc=mk?null:document.createElement('canvas');if(oc){oc.width=Wp;oc.height=Hp}
  const g2=mk?mk(Wp,Hp,L):oc.getContext('2d'),k=1.6,ppm=L.dpi*1000/(25.4*L.N),ap=L.m+L.fr,axp=mm(ap),ayp=mm(ap),awp=mm(L.aw),ahp=mm(L.ah);
  const ox=axp+(awp-L.bw*ppm)/2-L.x0*ppm,oy=ayp+(ahp-L.bh*ppm)/2-L.y0*ppm,sv={ctx,V,W,H,dpr,mkPath};
  ctx=g2;V={x:ox/k,y:oy/k,s:ppm/k};W=Wp/k;H=Hp/k;dpr=1;if(mk)mkPath=()=>new PdfPath();
  try{
    g2.fillStyle='#ffffff';g2.fillRect(0,0,Wp,Hp);
    g2.save();g2.beginPath();g2.rect(axp,ayp,awp,ahp);g2.clip();g2.setTransform(k,0,0,k,0,0);g2.direction='ltr';
    const c={bg:'#ffffff',grid:'#e5e7eb',major:'#cbd5e1',ln:'#111827',ac:'#b45309',dim:'#475569'};
    if(o.grid){
      g2.beginPath();
      for(let x=Math.floor(L.x0);x<=L.x0+L.bw+1;x++){const p=w2s(x,0)[0];g2.moveTo(p,0);g2.lineTo(p,Hp/k)}
      for(let y=Math.floor(L.y0);y<=L.y0+L.bh+1;y++){const p=w2s(0,y)[1];g2.moveTo(0,p);g2.lineTo(Wp/k,p)}
      g2.strokeStyle=c.major;
      g2.lineWidth=.6;
      g2.stroke()
    }
    for(const pass of[0,1])shapes.forEach(s=>{if(shown(s)&&(['door','door2','win'].includes(s.t))===!!pass)drawShape(s,false,false,c)});
    g2.restore();
    g2.setTransform(1,0,0,1,0,0);
    const ink='#15324b';
    // الإطار الخارجي للورقة (يضم جدول العنوان) ثم إطار الرسم الداخلي الرفيع
    g2.strokeStyle=ink;g2.lineWidth=mm(.5);
    g2.strokeRect(mm(L.m),mm(L.m),mm(L.pw-2*L.m),mm(L.ph-2*L.m));
    g2.strokeStyle='#8a99a8';g2.lineWidth=mm(.2);g2.strokeRect(axp,ayp,awp,ahp);
    drawTitleBlock(g2,L,o,Object.assign({proj:o.title},o.meta),o.co||{});
    if(o.bar){
      const bl=L.N<=50?2:L.N<=200?5:L.N<=1000?20:100,bpx=bl*ppm,bx0=axp+mm(2),by0=ayp+ahp-mm(5);
      g2.strokeStyle=ink;g2.lineWidth=mm(.5);g2.beginPath();
      g2.moveTo(bx0,by0);g2.lineTo(bx0+bpx,by0);
      g2.moveTo(bx0,by0-mm(1.5));g2.lineTo(bx0,by0+mm(1.5));
      g2.moveTo(bx0+bpx,by0-mm(1.5));g2.lineTo(bx0+bpx,by0+mm(1.5));
      g2.stroke();
      g2.direction='ltr';g2.textAlign='left';g2.textBaseline='bottom';
      g2.font=`400 ${mm(3)}px ${FONT}`;g2.fillStyle=ink;
      g2.fillText(`${bl} m`,bx0,by0-mm(2));
    }
    return{oc,L,g2};
  }finally{ctx=sv.ctx;V=sv.V;W=sv.W;H=sv.H;dpr=sv.dpr;mkPath=sv.mkPath}
}
// PDF بسيط: صفحة واحدة بصورة JPEG مضمّنة بحجم الورقة الحقيقي
function makePDF(jpg,wpx,hpx,wmm,hmm){
  const pt=v=>(v/25.4*72).toFixed(2),W2=pt(wmm),H2=pt(hmm),enc=new TextEncoder(),parts=[],offs=[];let n0=0;
  const add=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);n0+=b.length};
  const obj=(n,body,stream)=>{offs[n]=n0;add(`${n} 0 obj\n${body}\n`);if(stream){add('stream\n');add(stream);add('\nendstream\n')}add('endobj\n')};
  add('%PDF-1.4\n');
  obj(1,'<</Type/Catalog/Pages 2 0 R>>');
  obj(2,'<</Type/Pages/Kids[3 0 R]/Count 1>>');
  obj(3,`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W2} ${H2}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
  obj(4,`<</Type/XObject/Subtype/Image/Width ${wpx}/Height ${hpx}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>`,jpg);
  const cs=`q ${W2} 0 0 ${H2} 0 0 cm /Im0 Do Q`;
  obj(5,`<</Length ${cs.length}>>`,cs);
  const xr=n0;
  add('xref\n0 6\n0000000000 65535 f \n'+[1,2,3,4,5].map(n=>String(offs[n]).padStart(10,'0')+' 00000 n \n').join(''));
  add(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`);
  return new Blob(parts,{type:'application/pdf'});
}

// PDF متجهي لصفحة التصدير (هندسة متجهية ونصوص صور عالية الدقة)؛ يعيد null إن لم يوجد رسم
async function sheetPdfBytes(o){
  const r=renderSheet(o,(w,h,L)=>new PdfRecorder(w,h,L.pw,L.ph));
  if(!r)return null;
  if(r.g2.warn.size)console.warn('PDF: عناصر لم تُكتب بدقة:',[...r.g2.warn].join(' | '));
  return r.g2.toPdf(o.title);
}

// معاينة ملف الطباعة قبل الحفظ: نعرض صورة الورقة ونفحص الحجم الفعلي أولًا.
let printPreviewUrl=null;
function closePrintPreview(){
  const el=$('#printPreview');
  if(el)el.hidden=true;
  if(printPreviewUrl){URL.revokeObjectURL(printPreviewUrl);printPreviewUrl=null}
}
function showPrintPreview(blob,previewBlob,name,kind,L){
  if(!(blob instanceof Blob)||blob.size<=0)throw new Error('ملف التصدير فارغ؛ لن نبدأ الحفظ');
  if(!(previewBlob instanceof Blob)||previewBlob.size<=0)throw new Error('تعذّر إنشاء صورة المعاينة');
  closePrintPreview();
  printPreviewUrl=URL.createObjectURL(previewBlob);
  const el=$('#printPreview'),img=$('#printPreviewImage');
  img.src=printPreviewUrl;
  $('#printPreviewTitle').textContent=kind==='pdf'?'معاينة PDF قبل الحفظ':'معاينة PNG قبل الحفظ';
  $('#printPreviewInfo').textContent=`الحجم: ${blob.size.toLocaleString('ar')} بايت · ${name}`;
  el.hidden=false;
  $('#printPreviewSave').onclick=async()=>{
    const btn=$('#printPreviewSave');btn.disabled=true;
    try{
      const result=await saveBlob(name,blob);
      if(result==='ok'){closePrintPreview();toast(`تم حفظ الملف · 1:${L.N}`)}
      else if(result==='err')toast('فشل الحفظ؛ بقيت المعاينة مفتوحة');
      else toast('تم إلغاء الحفظ');
    }catch(e){console.error('Print save failed:',e);toast(e?.message||'تعذّر حفظ الملف')}
    finally{btn.disabled=false}
  };
  $('#printPreviewCancel').onclick=()=>{closePrintPreview();toast('أُلغي الحفظ')};
}
async function canvasPng(canvas){
  return new Promise((resolve,reject)=>{
    if(!canvas){reject(new Error('لم تُنشأ لوحة المعاينة'));return}
    canvas.toBlob(b=>b&&b.size?resolve(b):reject(new Error('تعذّر إنشاء صورة المعاينة')),'image/png');
  });
}
async function doExport(kind){
  const mt=sheetMeta(),o={...EX,title:mt.proj,meta:mt,co:coGet()},L=sheetLayout(o);
  if(!L){toast('لا يوجد رسم للطباعة');return}
  if(!L.fits){toast(`لا يتسع الرسم بالمقياس 1:${L.N}، اختر مقياسًا أصغر أو ورقة أكبر`);return}
  const nm=pname().replace(/[^\\p{L}\\p{N} _.()-]+/gu,'').trim()||'مخطط';
  try{
    let fileBlob,previewBlob;
    if(kind==='png'){
      const r=renderSheet(o);
      if(!r?.oc)throw new Error('تعذّر إنشاء صورة المخطط');
      fileBlob=await canvasPng(r.oc);
      previewBlob=fileBlob;
    }else{
      let pdf=null;
      try{pdf=await sheetPdfBytes(o)}catch(e){console.error('PDF متجهي: فشل فيُستخدم PDF بصورة JPEG',e)}
      if(!pdf){
        const r=renderSheet(o);
        if(!r?.oc)throw new Error('تعذّر إنشاء صورة المخطط');
        const jb=await new Promise((resolve,reject)=>r.oc.toBlob(b=>b?resolve(b):reject(new Error('تعذّر إنشاء صورة PDF')),'image/jpeg',.92));
        const jpg=new Uint8Array(await jb.arrayBuffer());
        pdf=makePDF(jpg,r.oc.width,r.oc.height,r.L.pw,r.L.ph);
      }
      fileBlob=pdf;
      const pr=renderSheet(o);
      if(!pr?.oc)throw new Error('تعذّر إنشاء معاينة PDF');
      previewBlob=await canvasPng(pr.oc);
    }
    if(!(fileBlob instanceof Blob)||fileBlob.size<=0)throw new Error('تم إنشاء ملف بحجم صفر؛ أوقفنا الحفظ لحماية الملف');
    showPrintPreview(fileBlob,previewBlob,nm+(kind==='png'?'.png':'.pdf'),kind,L);
  }catch(e){console.error('Print preview/export failed:',e);toast(e?.message||'تعذّر تجهيز معاينة الطباعة')}
}

function exportSheet(){
  const sh=$('#sheet');
  const chips=(id,items,cur)=>`<div class="chips" id="${id}">${items.map(([v,l])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const fld=(k,l,t)=>`<label>${l}<input data-k="${k}" type="${t||'text'}" autocomplete="off"></label>`;
  sh.innerHTML='<b>طباعة</b>'+chips('xp',[['A4','A4'],['A3','A3']],EX.paper)
    +chips('xo',[['auto','اتجاه تلقائي'],['port','عمودي'],['land','أفقي']],EX.orient)
    +'<b>المقياس</b>'+chips('xn',[[0,'تلقائي'],[20,'1:20'],[50,'1:50'],[75,'1:75'],[100,'1:100'],[200,'1:200'],[500,'1:500']],EX.N)
    +'<div class="chips"><button class="chip'+(EX.grid?' on':'')+'" id="xg">إظهار الشبكة</button><button class="chip'+(EX.bar?' on':'')+'" id="xb">شريط المقياس</button></div>'
    +'<b>بيانات المشروع والمالك</b><div class="hint">تُحفظ مع هذا المشروع وتُصدَّر مع ملفه.</div>'
    +fld('proj','المشروع / نوع المبنى')+fld('loc','موقع المشروع')+fld('owner','اسم المالك')+fld('land','مساحة الأرض (م²)')+fld('built','مساحة البناء (م²)')
    +'<b>بيانات اللوحة والاعتماد</b>'
    +fld('kind','نوع اللوحة')+fld('designer','المصمم / الاستشاري')+fld('no','رقم اللوحة')+fld('date','التاريخ','date')
    +'<b>بيانات المكتب</b><div class="hint" id="xco"></div><div class="chips"><button class="chip" id="xoff">تعديل بيانات المكتب</button></div>'
    +'<div id="xi" style="color:var(--dim);font-size:12px"></div>'
    +'<div class="row" style="position:sticky;bottom:-12px;background:var(--ui);padding:6px 0"><button class="fl" id="xpng">حفظ PNG</button><button class="fl" id="xpdf">حفظ PDF</button></div><button id="ok">تم</button>';
  const cur=sheetMeta();
  sh.querySelectorAll('input[data-k]').forEach(i=>{
    const k=i.dataset.k;i.value=cur[k]==null?'':cur[k];
    i.oninput=()=>{metaSet({[k]:i.value})};   // يُحفظ فورًا مع المشروع
  });
  const co=coGet();
  $('#xco').textContent=[co.name,co.phone,co.email,co.addr].filter(Boolean).join(' · ')||'لم تُدخل بيانات المكتب بعد (تظهر فارغة في الجدول).';
  const info=()=>{
    const L=sheetLayout(EX);
    $('#xi').textContent=L?`الرسم ${f(L.bw)} × ${f(L.bh)} م · ${EX.paper} · 1:${L.N}${L.fits?'':' (لا يتسع)'}`:'لا يوجد رسم للطباعة'
  };
  const pick=(id,fn)=>sh.querySelectorAll(`#${id} .chip`).forEach(b=>{
    b.onclick=()=>{fn(b.dataset.v);sh.querySelectorAll(`#${id} .chip`).forEach(x=>x.classList.toggle('on',x===b));info()}
  });
  pick('xp',v=>{EX.paper=v});pick('xo',v=>{EX.orient=v});pick('xn',v=>{EX.N=+v});
  $('#xg').onclick=e=>{EX.grid=EX.grid?0:1;e.currentTarget.classList.toggle('on',!!EX.grid)};
  $('#xb').onclick=e=>{EX.bar=EX.bar?0:1;e.currentTarget.classList.toggle('on',!!EX.bar)};
  $('#xoff').onclick=()=>officeSheet(exportSheet);
  $('#xpng').onclick=()=>doExport('png');$('#xpdf').onclick=()=>doExport('pdf');
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  info();sh.classList.add('on');$('#ctx').style.display='none';
}

$('#shot').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');exportSheet()};

