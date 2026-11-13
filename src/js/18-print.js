/* ==================================================================
 * 18-print.js
 * الطباعة والتصدير: ورقة A4/A3 بمقياس رسم وإطار وجدول عنوان، وحفظ PNG أو PDF.
 *
 * يعرّف: EX، sheetLayout، renderSheet، sheetPdfBytes، makePDF، doExport، exportSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 06-layers.js، 07-projects.js،
 *            08-project-io.js، 09-render.js، 10-dimensions.js، 18a-pdf.js، 22-toolbar.js
 * ================================================================== */

// ---- التصدير: PNG أو PDF بمقياس رسم على ورقة A4/A3 مع إطار وجدول عنوان ----
let EX={paper:'A4',N:0,grid:0};

function sheetLayout(o){
  const vis=shapes.filter(s=>shown(s));if(!vis.length)return null;
  const BB=bounds(vis),x0=BB.x,y0=BB.y,x1=BB.X,y1=BB.Y,bw=Math.max(x1-x0,.1),bh=Math.max(y1-y0,.1);
  const dim={A4:[297,210],A3:[420,297]}[o.paper],land=bw>=bh,pw=land?dim[0]:dim[1],ph=land?dim[1]:dim[0];
  const dpi=150,m=10,fr=5,tb=26,aw=pw-2*(m+fr),ah=ph-2*(m+fr)-tb;
  const need=N=>bw*1000/N<=aw&&bh*1000/N<=ah;
  const N=o.N||[10,20,25,50,75,100,125,150,200,250,300,400,500,750,1000,2000,5000].find(need)||5000;
  return{x0,y0,bw,bh,pw,ph,dpi,m,fr,tb,aw,ah,N,fits:need(N),mm:v=>v/25.4*dpi};
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
    g2.setTransform(1,0,0,1,0,0);g2.strokeStyle='#111827';g2.lineWidth=mm(.5);
    g2.strokeRect(mm(L.m),mm(L.m),mm(L.pw-2*L.m),mm(L.ph-2*L.m));
    const tx=mm(L.m),ty=mm(L.ph-L.m-L.tb),tw=mm(L.pw-2*L.m),th=mm(L.tb);
    g2.strokeRect(tx,ty,tw,th);
    let x=tx+tw;
    [[.5,'المشروع',o.title],[.2,'المقياس',`1 : ${L.N}`],[.3,'التاريخ',new Date().toISOString().slice(0,10)]].forEach(([fq,lab,val])=>{
      const cw=tw*fq;x-=cw;
      if(x>tx+1){g2.beginPath();g2.moveTo(x,ty);g2.lineTo(x,ty+th);g2.lineWidth=mm(.3);g2.stroke()}
      g2.textAlign='right';
      g2.textBaseline='top';
      g2.direction='rtl';
      g2.font=`400 ${mm(3)}px ${FONT}`;
      g2.fillStyle='#475569';
      g2.fillText(lab,x+cw-mm(2),ty+mm(2));
      g2.direction=/[\u0600-\u06FF]/.test(val)?'rtl':'ltr';
      g2.font=`600 ${mm(7)}px ${FONT}`;
      g2.fillStyle='#111827';
      g2.fillText(val,x+cw-mm(2),ty+mm(9),cw-mm(4));
    });
    const bl=L.N<=50?2:L.N<=200?5:L.N<=1000?20:100,bpx=bl*ppm,bx0=axp+mm(2),by0=ayp+ahp-mm(5);
    g2.strokeStyle='#111827';
    g2.lineWidth=mm(.5);
    g2.beginPath();
    g2.moveTo(bx0,by0);
    g2.lineTo(bx0+bpx,by0);
    g2.moveTo(bx0,by0-mm(1.5));
    g2.lineTo(bx0,by0+mm(1.5));
    g2.moveTo(bx0+bpx,by0-mm(1.5));
    g2.lineTo(bx0+bpx,by0+mm(1.5));
    g2.stroke();
    g2.direction='ltr';
    g2.textAlign='left';
    g2.textBaseline='bottom';
    g2.font=`400 ${mm(3)}px ${FONT}`;
    g2.fillStyle='#111827';
    g2.fillText(`${bl} m`,bx0,by0-mm(2));
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

async function doExport(kind,title){
  const o={...EX,title:(title||'').trim()||pname()},L=sheetLayout(o);
  if(!L){toast('لا يوجد رسم للطباعة');return}
  if(!L.fits){toast(`لا يتسع الرسم بالمقياس 1:${L.N}، اختر مقياسًا أصغر أو ورقة أكبر`);return}
  const nm=pname().replace(/[^\p{L}\p{N} _.()-]+/gu,'').trim()||'مخطط';let res;
  if(kind==='png'){
    const r=renderSheet(o),b=await new Promise(rs=>r.oc.toBlob(rs,'image/png'));res=await saveBlob(nm+'.png',b);
    if(res==='err'){$('#ov img').src=URL.createObjectURL(b);$('#ov').hidden=false;return}
  }else{
    let pdf=null;
    try{const z=await sheetPdfBytes(o);if(z)pdf=new Blob([z],{type:'application/pdf'})}
    catch(e){console.error('PDF متجهي: فشل فيُحفظ بدله PDF بصورة JPEG',e)}
    if(!pdf){
      const r=renderSheet(o),jb=await new Promise(rs=>r.oc.toBlob(rs,'image/jpeg',.92)),jpg=new Uint8Array(await jb.arrayBuffer());
      pdf=makePDF(jpg,r.oc.width,r.oc.height,r.L.pw,r.L.ph);
    }
    res=await saveBlob(nm+'.pdf',pdf);
  }
  if(res==='ok')toast(`تم الحفظ · 1:${L.N}`);else if(res==='err')toast('الحفظ غير متاح هنا');
}

function exportSheet(){
  const sh=$('#sheet');
  const chips=(id,items,cur)=>`<div class="chips" id="${id}">${items.map(([v,l])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  sh.innerHTML='<b>طباعة</b><label>عنوان اللوحة<input data-k="ttl" type="text"></label><b>الورقة</b>'+chips('xp',[['A4','A4'],['A3','A3']],EX.paper)
    +'<b>المقياس</b>'+chips('xn',[[0,'تلقائي'],[20,'1:20'],[50,'1:50'],[100,'1:100'],[200,'1:200'],[500,'1:500']],EX.N)
    +'<div class="chips"><button class="chip'+(EX.grid?' on':'')+'" id="xg">إظهار الشبكة</button></div><div id="xi" style="color:var(--dim);font-size:12px"></div>'
    +'<div class="row"><button class="fl" id="xpng">حفظ PNG</button><button class="fl" id="xpdf">حفظ PDF</button></div><button id="ok">تم</button>';
  const ttl=sh.querySelector('[data-k="ttl"]');ttl.value=pname();
  const info=()=>{
    const L=sheetLayout(EX);
    $('#xi').textContent=L?`الرسم ${f(L.bw)} × ${f(L.bh)} م · ${EX.paper} · 1:${L.N}${L.fits?'':' (لا يتسع)'}`:'لا يوجد رسم للطباعة'
  };
  const pick=(id,fn)=>sh.querySelectorAll(`#${id} .chip`).forEach(b=>{
    b.onclick=()=>{fn(b.dataset.v);sh.querySelectorAll(`#${id} .chip`).forEach(x=>x.classList.toggle('on',x===b));info()}
  });
  pick('xp',v=>{EX.paper=v});pick('xn',v=>{EX.N=+v});
  $('#xg').onclick=e=>{EX.grid=EX.grid?0:1;e.currentTarget.classList.toggle('on',!!EX.grid)};
  $('#xpng').onclick=()=>doExport('png',ttl.value);$('#xpdf').onclick=()=>doExport('pdf',ttl.value);
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  info();sh.classList.add('on');$('#ctx').style.display='none';
}

$('#shot').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');exportSheet()};

