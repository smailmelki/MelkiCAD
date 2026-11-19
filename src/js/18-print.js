/* ==================================================================
 * 18-print.js
 * الطباعة (نافذة طباعة النظام) وحفظ PDF: ورقة A4/A3 بمقياس رسم وإطار مزدوج وجدول عنوان من ثلاثة أعمدة
 * (المكتب | المشروع والمالك | اللوحة والاعتماد)، مع معاينة قبل الطباعة.
 * بيانات المكتب من الإعدادات (coGet) وبيانات المشروع وإعدادات الورقة والمقياس تُحفظ مع المشروع (metaGet) وتُدخَل في لوحة الطباعة.
 *
 * يعرّف: EX، EX_DEFAULT، loadPrintSettings، savePrintSettings، todayStr، areaText، sheetMeta، sheetLayout، drawTitleBlock، renderSheet، sheetPdfBytes، makePDF، printSheetWeb، printSheet، doExport، exportSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 06-layers.js، 07-projects.js،
 *            08-project-io.js، 09-render.js، 10-dimensions.js، 18a-pdf.js، 21-settings.js، 22-toolbar.js
 * ================================================================== */

// ---- الطباعة إلى PDF بمقياس رسم على ورقة A4/A3 مع إطار وجدول عنوان ----
const EX_DEFAULT={paper:'A4',orient:'auto',N:0,grid:0,bar:0,titleBlock:1};
let EX={...EX_DEFAULT};
// إعدادات الورقة (الورقة والاتجاه والمقياس والشبكة وشريط المقياس وجدول العنوان) تُحفظ مع المشروع في meta.pr وتُصدَّر مع ملفه
function loadPrintSettings(){EX=Object.assign({},EX_DEFAULT,metaGet().pr||{})}
function savePrintSettings(){metaSet({pr:{paper:EX.paper,orient:EX.orient,N:+EX.N||0,grid:EX.grid?1:0,bar:EX.bar?1:0,titleBlock:EX.titleBlock===0?0:1}})}

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
  const dpi=o.previewDpi||150,m=10,fr=5,hh=6.5,tb=o.titleBlock===0?0:42,aw=pw-2*(m+fr),ah=ph-2*(m+fr)-tb;
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
// معاينة تدريجية: تقسم الرسم إلى دفعات قصيرة وتترك للواجهة فرصة التحديث بين الدفعات.
async function renderSheetPreview(o,onProgress=()=>{},isActive=()=>true){
  syncDims();
  const L=sheetLayout(o);if(!L)return null;
  const mm=L.mm,Wp=Math.round(mm(L.pw)),Hp=Math.round(mm(L.ph)),oc=document.createElement('canvas');
  oc.width=Wp;oc.height=Hp;
  const stage=$('#printPreview .pp-stage'),img=$('#printPreviewImage');
  if(stage){
    printPreviewCanvas=oc;oc.id='printPreviewCanvas';
    Object.assign(oc.style,{display:'block',maxWidth:'100%',maxHeight:'100%',width:'auto',height:'auto',objectFit:'contain',background:'#fff',boxShadow:'0 2px 12px #0005'});
    stage.appendChild(oc);if(img)img.hidden=true;
  }
  const g2=oc.getContext('2d'),k=1.6,ppm=L.dpi*1000/(25.4*L.N),ap=L.m+L.fr,axp=mm(ap),ayp=mm(ap),awp=mm(L.aw),ahp=mm(L.ah);
  const ox=axp+(awp-L.bw*ppm)/2-L.x0*ppm,oy=ayp+(ahp-L.bh*ppm)/2-L.y0*ppm,sv={ctx,V,W,H,dpr,mkPath};
  ctx=g2;V={x:ox/k,y:oy/k,s:ppm/k};W=Wp/k;H=Hp/k;dpr=1;sheetSwap++;
  try{
    g2.fillStyle='#ffffff';g2.fillRect(0,0,Wp,Hp);
    g2.save();g2.beginPath();g2.rect(axp,ayp,awp,ahp);g2.clip();g2.setTransform(k,0,0,k,0,0);g2.direction='ltr';
    const c={bg:'#ffffff',grid:'#e5e7eb',major:'#cbd5e1',ln:'#111827',ac:'#b45309',dim:'#475569'};
    if(o.grid){
      g2.beginPath();
      for(let x=Math.floor(L.x0);x<=L.x0+L.bw+1;x++){const p=w2s(x,0)[0];g2.moveTo(p,0);g2.lineTo(p,Hp/k)}
      for(let y=Math.floor(L.y0);y<=L.y0+L.bh+1;y++){const p=w2s(0,y)[1];g2.moveTo(0,p);g2.lineTo(Wp/k,p)}
      g2.strokeStyle=c.major;g2.lineWidth=.6;g2.stroke()
    }
    // نعالج الأشكال على دفعات مع الحفاظ على ترتيب الرسم: العناصر العادية أولًا ثم الأبواب والنوافذ.
    const total=shapes.length,chunkSize=160;
    for(let pass=0;pass<2;pass++){
      for(let start=0;start<total;start+=chunkSize){
        const end=Math.min(total,start+chunkSize);
        await new Promise(resolve=>requestAnimationFrame(resolve));
        if(!isActive())return null;
        drawShapes(new Set(),c,true,[start,end],pass);
        onProgress(Math.round(((pass*total+end)/(Math.max(1,total)*2))*100));
      }
    }
    g2.restore();
    g2.setTransform(1,0,0,1,0,0);
    const ink='#15324b';
    g2.strokeStyle=ink;g2.lineWidth=mm(.5);g2.strokeRect(mm(L.m),mm(L.m),mm(L.pw-2*L.m),mm(L.ph-2*L.m));
    g2.strokeStyle='#8a99a8';g2.lineWidth=mm(.2);g2.strokeRect(axp,ayp,awp,ahp);
    if(o.titleBlock!==0)drawTitleBlock(g2,L,o,Object.assign({proj:o.title},o.meta),o.co||{});
    if(o.bar){
      const bl=L.N<=50?2:L.N<=200?5:L.N<=1000?20:100,bpx=bl*ppm,bx0=axp+mm(2),by0=ayp+ahp-mm(5);
      g2.strokeStyle=ink;g2.lineWidth=mm(.5);g2.beginPath();
      g2.moveTo(bx0,by0);g2.lineTo(bx0+bpx,by0);
      g2.moveTo(bx0,by0-mm(1.5));g2.lineTo(bx0,by0+mm(1.5));
      g2.moveTo(bx0+bpx,by0-mm(1.5));g2.lineTo(bx0+bpx,by0+mm(1.5));
      g2.stroke();g2.direction='ltr';g2.textAlign='left';g2.textBaseline='bottom';
      g2.font=`400 ${mm(3)}px ${FONT}`;g2.fillStyle=ink;g2.fillText(`${bl} m`,bx0,by0-mm(2));
    }
    onProgress(100);
    return{oc,L,g2};
  }finally{
    ctx=sv.ctx;V=sv.V;W=sv.W;H=sv.H;dpr=sv.dpr;mkPath=sv.mkPath;
    if(!--sheetSwap&&sheetDeferred){sheetDeferred=0;resize()}   // أعد ما فاتته الشاشة أثناء المعاينة
  }
}

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
    drawShapes(new Set(),c,true); // يستخدم تجميع المسارات واستبعاد ما يقع خارج الورقة مع الحفاظ على كل تفاصيل الطباعة
    g2.restore();
    g2.setTransform(1,0,0,1,0,0);
    const ink='#15324b';
    // الإطار الخارجي للورقة (يضم جدول العنوان) ثم إطار الرسم الداخلي الرفيع
    g2.strokeStyle=ink;g2.lineWidth=mm(.5);
    g2.strokeRect(mm(L.m),mm(L.m),mm(L.pw-2*L.m),mm(L.ph-2*L.m));
    g2.strokeStyle='#8a99a8';g2.lineWidth=mm(.2);g2.strokeRect(axp,ayp,awp,ahp);
    if(o.titleBlock!==0)drawTitleBlock(g2,L,o,Object.assign({proj:o.title},o.meta),o.co||{});
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

// طباعة حقيقية بأدوات النظام. على أندرويد (الغلاف): نافذة الطباعة الأصلية بملف PDF المتجهي (window.printPdfNative من android-bridge.js).
// في المتصفح: تُرسم الورقة صورة عالية الدقة داخل iframe مخفي بحجم الورقة (@page) ثم window.print()، فتظهر نافذة طباعة المتصفح.
// تُرجع 'ok' عند فتح نافذة الطباعة (لا يُعرف إن أتمّ المستخدم الطباعة) و'err' عند الفشل.
async function printSheetWeb(o){
  const L0=sheetLayout(o);if(!L0)throw new Error('لا يوجد رسم للطباعة');
  // 300 نقطة/بوصة كحد أقصى، مع سقف ≈12 مليون بكسل حتى لا يفشل Canvas على الجوال (A3 ≈ 249)
  const dpi=Math.max(96,Math.min(300,Math.floor(Math.sqrt(12e6/(L0.pw*L0.ph))*25.4)));
  const r=renderSheet({...o,previewDpi:dpi});
  if(!r?.oc)throw new Error('تعذّر تجهيز صورة الطباعة');
  const blob=await new Promise((res,rej)=>r.oc.toBlob(b=>b&&b.size?res(b):rej(new Error('تعذّر تجهيز صورة الطباعة')),'image/png'));
  const url=URL.createObjectURL(blob),fr=document.createElement('iframe');
  let done=false;
  const cleanup=()=>{if(done)return;done=true;URL.revokeObjectURL(url);fr.remove()};
  fr.setAttribute('aria-hidden','true');fr.tabIndex=-1;
  fr.style.cssText=`position:fixed;left:-10000px;top:0;width:${L0.pw}mm;height:${L0.ph}mm;border:0`;
  fr.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${L0.pw}mm ${L0.ph}mm;margin:0}`
    +`html,body{margin:0;padding:0;background:#fff}img{display:block;width:${L0.pw}mm;height:${L0.ph}mm}</style></head><body><img alt="" src="${url}"></body></html>`;
  await new Promise((resolve,reject)=>{
    fr.onload=()=>{
      try{
        const w=fr.contentWindow;w.onafterprint=cleanup;w.focus();w.print();
        setTimeout(cleanup,5*60*1000);resolve();
      }catch(e){cleanup();reject(e)}
    };
    fr.onerror=()=>{cleanup();reject(new Error('تعذّر تجهيز صفحة الطباعة'))};
    document.body.appendChild(fr);
  });
  return 'ok';
}
async function printSheet(o,pdfBlob,name){
  const L=sheetLayout(o);if(!L)throw new Error('لا يوجد رسم للطباعة');
  if(typeof window.printPdfNative==='function')return window.printPdfNative(name,pdfBlob,{paper:o.paper,landscape:L.pw>L.ph});
  return printSheetWeb(o);
}

// معاينة ملف الطباعة؛ تظهر الصورة أولًا بدقة مناسبة للشاشة، ثم يُجهّز PDF في الخلفية.
let printPreviewUrl=null,printPreviewCanvas=null,printBusy=false,printPreviewGeneration=0;
function closePrintPreview(){
  printPreviewGeneration++;
  const el=$('#printPreview');
  if(el)el.hidden=true;
  if(printPreviewCanvas){printPreviewCanvas.remove();printPreviewCanvas=null}
  const img=$('#printPreviewImage');if(img)img.hidden=false;
  if(printPreviewUrl){URL.revokeObjectURL(printPreviewUrl);printPreviewUrl=null}
}
function showPrintPreviewProgress(name){
  closePrintPreview();
  const el=$('#printPreview'),img=$('#printPreviewImage'),btn=$('#printPreviewPrint');
  img.removeAttribute('src');
  $('#printPreviewTitle').textContent='معاينة قبل الطباعة';
  $('#printPreviewInfo').textContent='بدء تجهيز المعاينة…';
  btn.disabled=true;btn.onclick=null;
  el.hidden=false;
  $('#printPreviewCancel').onclick=()=>{closePrintPreview();toast('أُغلقت المعاينة')};
  return printPreviewGeneration;
}
function showPrintPreview(previewBlob,name){
  if(!(previewBlob instanceof Blob)||previewBlob.size<=0)throw new Error('تعذّر إنشاء صورة المعاينة');
  closePrintPreview();
  printPreviewUrl=URL.createObjectURL(previewBlob);
  const el=$('#printPreview'),img=$('#printPreviewImage'),btn=$('#printPreviewPrint');
  img.hidden=false;img.src=printPreviewUrl;
  $('#printPreviewTitle').textContent='معاينة قبل الطباعة';
  $('#printPreviewInfo').textContent='تجهيز الملف للطباعة…';
  btn.disabled=true;
  btn.onclick=null;
  el.hidden=false;
  $('#printPreviewCancel').onclick=()=>{closePrintPreview();toast('أُغلقت المعاينة')};
  return printPreviewUrl;
}
function enablePrintPreviewPrint(blob,name,L,url,o,note){
  const el=$('#printPreview'),btn=$('#printPreviewPrint');
  if(printPreviewUrl!==url||el.hidden)return;
  if(!(blob instanceof Blob)||blob.size<=0)throw new Error('ملف الطباعة فارغ؛ لن نبدأ الطباعة');
  $('#printPreviewInfo').textContent=`${o.paper} · 1:${L.N} · ${name} · ${blob.size.toLocaleString('ar')} بايت`+(note?`\n⚠ ${note}`:'');
  const lock=on=>{btn.disabled=on};
  const unlock=()=>{if(printPreviewUrl===url&&!el.hidden)lock(false)};
  lock(false);
  // طباعة حقيقية بنافذة النظام؛ تبقى المعاينة مفتوحة كي يعيد المستخدم المحاولة إن ألغى
  btn.onclick=async()=>{
    lock(true);
    try{
      const result=await printSheet(o,blob,name);
      if(result==='ok')toast('فُتحت نافذة الطباعة');
      else toast('تعذّرت الطباعة؛ بقيت المعاينة مفتوحة');
    }catch(e){console.error('Print failed:',e);toast(e?.message||'تعذّرت الطباعة')}
    finally{unlock()}
  };
}
async function doExport(){
  if(printBusy)return;
  printBusy=true;
  const trigger=$('#xpdf');if(trigger)trigger.disabled=true;
  try{
    ensureMetaDate();
    const mt=sheetMeta(),o={...EX,title:mt.proj,meta:mt,co:coGet()},L=sheetLayout(o);
    if(!L){toast('لا يوجد رسم للطباعة');return}
    if(!L.fits){toast(`لا يتسع الرسم بالمقياس 1:${L.N}، اختر مقياسًا أصغر أو ورقة أكبر`);return}
    const nm=pname().replace(/[^\\p{L}\\p{N} _.()-]+/gu,'').trim()||'مخطط';

    // أظهر شاشة المعاينة فورًا، ثم ارسم المخطط على دفعات كي لا تتجمّد الواجهة.
    const previewToken=showPrintPreviewProgress(nm+'.pdf');
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
    if(previewToken!==printPreviewGeneration)return;
    const preview=await renderSheetPreview({...o,previewDpi:96},p=>{
      const info=$('#printPreviewInfo');
      if(info&&!$('#printPreview').hidden)info.textContent=`إعداد المعاينة… ${p}%`;
    },()=>previewToken===printPreviewGeneration);
    if(previewToken!==printPreviewGeneration)return;
    if(!preview?.oc)throw new Error('تعذّر إنشاء معاينة PDF');
    const previewBlob=await new Promise((resolve,reject)=>preview.oc.toBlob(b=>b&&b.size?resolve(b):reject(new Error('تعذّر إنشاء صورة المعاينة')),'image/jpeg',.82));
    if(previewToken!==printPreviewGeneration)return;
    const previewUrl=showPrintPreview(previewBlob,nm+'.pdf');
    await new Promise(resolve=>requestAnimationFrame(()=>resolve()));

    let pdf=null,note='';
    try{pdf=await sheetPdfBytes(o)}catch(e){console.error('PDF متجهي: فشل فيُستخدم PDF بصورة JPEG',e)}
    if(!pdf){
      // لا نُخفي الرجوع إلى المسار الأقل جودة: يُعلَم المستخدم قبل أن يطبع أو يحفظ
      note='تعذّر إنشاء PDF متجهي، فاستُخدمت نسخة صورة (150 نقطة/بوصة)، وقد تظهر الخطوط أقل حدّة عند التكبير أو الطباعة الكبيرة.';
      toast('تعذّر PDF المتجهي؛ استُخدمت نسخة صورة بجودة أقل');
      const r=renderSheet(o);
      if(!r?.oc)throw new Error('تعذّر إنشاء صورة المخطط');
      const jb=await new Promise((resolve,reject)=>r.oc.toBlob(b=>b?resolve(b):reject(new Error('تعذّر إنشاء صورة PDF')),'image/jpeg',.92));
      const jpg=new Uint8Array(await jb.arrayBuffer());
      pdf=makePDF(jpg,r.oc.width,r.oc.height,r.L.pw,r.L.ph);
    }
    const fileBlob=pdf instanceof Blob?pdf:new Blob([pdf],{type:'application/pdf'});
    if(!(fileBlob instanceof Blob)||fileBlob.size<=0)throw new Error('تم إنشاء ملف بحجم صفر؛ أوقفنا الطباعة');
    const head=new Uint8Array(await fileBlob.slice(0,8).arrayBuffer());
    const tail=new TextDecoder().decode(await fileBlob.slice(Math.max(0,fileBlob.size-1024)).arrayBuffer());
    if(new TextDecoder().decode(head.slice(0,5))!=='%PDF-'||!tail.includes('%%EOF'))throw new Error('ملف PDF الناتج غير مكتمل أو تالف؛ أوقفنا الطباعة');
    enablePrintPreviewPrint(fileBlob,nm+'.pdf',L,previewUrl,o,note);
  }catch(e){console.error('Print preview/export failed:',e);toast(e?.message||'تعذّر تجهيز معاينة الطباعة')}
  finally{printBusy=false;if(trigger)trigger.disabled=false}
}

function exportSheet(){
  const sh=$('#sheet');
  const chips=(id,items,cur)=>`<div class="chips" id="${id}">${items.map(([v,l])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const fld=(k,l,t)=>`<label>${l}<input data-k="${k}" type="${t||'text'}" autocomplete="off"></label>`;
  sh.innerHTML='<b>طباعة</b>'+chips('xp',[['A4','A4'],['A3','A3']],EX.paper)
    +chips('xo',[['auto','اتجاه تلقائي'],['port','عمودي'],['land','أفقي']],EX.orient)
    +'<b>المقياس</b>'+chips('xn',[[0,'تلقائي'],[20,'1:20'],[50,'1:50'],[75,'1:75'],[100,'1:100'],[200,'1:200'],[500,'1:500']],EX.N)
    +'<div class="chips"><button class="chip'+(EX.grid?' on':'')+'" id="xg">إظهار الشبكة</button><button class="chip'+(EX.bar?' on':'')+'" id="xb">شريط المقياس</button></div>'
    +'<b>جدول المعلومات</b><div class="chips"><button class="chip'+(EX.titleBlock!==0?' on':'')+'" id="xtb">'+(EX.titleBlock===0?'إظهار جدول المعلومات':'إخفاء جدول المعلومات')+'</button></div>'
    +(EX.titleBlock===0?'<div class="hint">سيُطبع المخطط وحده دون جدول المعلومات. يمكنك إضافة أي كتابة مباشرة إلى الرسم باستخدام أداة النص.</div>':'<div id="titleFields"><b>بيانات المشروع والمالك</b><div class="hint">تُحفظ مع هذا المشروع وتُصدَّر مع ملفه، ومعها الورقة والاتجاه والمقياس.</div>'
      +fld('proj','المشروع / نوع المبنى')+fld('loc','موقع المشروع')+fld('owner','اسم المالك')+fld('land','مساحة الأرض (م²)')+fld('built','مساحة البناء (م²)')
      +'<b>بيانات اللوحة والاعتماد</b>'+fld('kind','نوع اللوحة')+fld('designer','المصمم / الاستشاري')+fld('no','رقم اللوحة')+fld('date','التاريخ','date')
      +'<b>بيانات المكتب</b><div class="hint" id="xco"></div><div class="chips"><button class="chip" id="xoff">تعديل بيانات المكتب</button></div></div>')
    +'<div id="xi" style="color:var(--dim);font-size:12px"></div>'
    +'<div class="row" style="position:sticky;bottom:-12px;background:var(--ui);padding:6px 0"><button class="fl" id="xpdf"><svg viewBox="0 0 24 24" aria-hidden="true" style="width:19px;height:19px;vertical-align:middle;margin-inline-end:6px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/><path d="M18 12h.01"/></svg>طباعة</button></div><button id="ok">تم</button>';
  const cur=sheetMeta();
  sh.querySelectorAll('input[data-k]').forEach(i=>{
    const k=i.dataset.k;i.value=cur[k]==null?'':cur[k];
    i.oninput=()=>{metaSet({[k]:i.value})};   // يُحفظ فورًا مع المشروع
  });
  const co=coGet();
  if($('#xco'))$('#xco').textContent=[co.name,co.phone,co.email,co.addr].filter(Boolean).join(' · ')||'لم تُدخل بيانات المكتب بعد (تظهر فارغة في الجدول).';
  const info=()=>{
    const L=sheetLayout(EX);
    $('#xi').textContent=L?`الرسم ${f(L.bw)} × ${f(L.bh)} م · ${EX.paper} · 1:${L.N}${L.fits?'':' (لا يتسع)'}`:'لا يوجد رسم للطباعة'
  };
  const pick=(id,fn)=>sh.querySelectorAll(`#${id} .chip`).forEach(b=>{
    b.onclick=()=>{fn(b.dataset.v);savePrintSettings();sh.querySelectorAll(`#${id} .chip`).forEach(x=>x.classList.toggle('on',x===b));info()}
  });
  pick('xp',v=>{EX.paper=v});pick('xo',v=>{EX.orient=v});pick('xn',v=>{EX.N=+v});
  $('#xg').onclick=e=>{EX.grid=EX.grid?0:1;savePrintSettings();e.currentTarget.classList.toggle('on',!!EX.grid)};
  $('#xb').onclick=e=>{EX.bar=EX.bar?0:1;savePrintSettings();e.currentTarget.classList.toggle('on',!!EX.bar)};
  $('#xtb').onclick=()=>{EX.titleBlock=EX.titleBlock===0?1:0;savePrintSettings();exportSheet()};
  if($('#xoff'))$('#xoff').onclick=()=>officeSheet(exportSheet);
  $('#xpdf').onclick=()=>doExport();
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  info();sh.classList.add('on');$('#ctx').style.display='none';
}

$('#shot').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');ensureMetaDate();loadPrintSettings();exportSheet()};

