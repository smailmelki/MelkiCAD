/* ==================================================================
 * 18-print.js
 * الطباعة المعمارية: لوحة A4/A3 بإطار مزدوج ومسقط مركزي وجدول بيانات سفلي.
 * ================================================================== */

let EX={paper:'A4',N:0,grid:0,showDims:1,showText:1};

const printProject=()=>PJ.find(p=>p.id===pid)||{};
const printOffice=()=>ST.office||(ST.office={name:'',phone:'',email:'',address:''});
const printMeta=()=>{const p=printProject();return p.print||(p.print={type:'',location:'',owner:'',landArea:'',buildingArea:'',drawing:'مسقط أفقي',designer:''})};

function sheetLayout(o){
  let vis=shapes.filter(s=>shown(s)&&(o.showDims||s.t!=='dim')&&(o.showText||s.t!=='text'));
  if(!o.showDims)vis=vis.filter(s=>s.t!=='dim');
  if(!o.showText)vis=vis.filter(s=>s.t!=='text');
  if(!vis.length)return null;
  const BB=bounds(vis),x0=BB.x,y0=BB.y,x1=BB.X,y1=BB.Y,bw=Math.max(x1-x0,.1),bh=Math.max(y1-y0,.1);
  const dim={A4:[297,210],A3:[420,297]}[o.paper]||[297,210],land=bw>=bh,pw=land?dim[0]:dim[1],ph=land?dim[1]:dim[0];
  const dpi=180,m=9,fr=5,tb=42,aw=pw-2*(m+fr),ah=ph-2*(m+fr)-tb;
  const need=N=>bw*1000/N<=aw&&bh*1000/N<=ah;
  const N=o.N||[10,20,25,50,75,100,125,150,200,250,300,400,500,750,1000,2000,5000].find(need)||5000;
  return{x0,y0,bw,bh,pw,ph,dpi,m,fr,tb,aw,ah,N,fits:need(N),mm:v=>v/25.4*dpi};
}

function printText(g,text,x,y,size,opts={}){
  const {align='right',color='#172b3b',weight=400,dir='rtl',max=0}=opts;
  g.save();g.direction=dir;g.textAlign=align;g.textBaseline='middle';
  g.font=`${weight} ${size}px ${FONT}`;g.fillStyle=color;
  if(max)g.fillText(String(text??'—'),x,y,max);else g.fillText(String(text??'—'),x,y);g.restore();
}

function drawTitleBlock(g,L,mm,tx,ty,tw,th){
  const office=printOffice(),meta=printMeta(),project=printProject();
  const c='#243746',light='#647789',line=mm(.28),pad=mm(2.2);
  const rightW=tw*.28,midW=tw*.44,leftW=tw-rightW-midW;
  const rightX=tx+tw-rightW,midX=tx+leftW,leftX=tx;
  g.save();g.strokeStyle=c;g.lineWidth=line;g.strokeRect(tx,ty,tw,th);
  [rightX,midX].forEach(x=>{g.beginPath();g.moveTo(x,ty);g.lineTo(x,ty+th);g.stroke()});
  // رؤوس الأقسام
  const headH=mm(6.5);
  [[rightX,rightW,'المكتب الاستشاري / الهندسي'],[midX,midW,'بيانات المشروع والمالك'],[leftX,leftW,'بيانات اللوحة والاعتماد']].forEach(([x,w,t])=>{
    g.fillStyle='#edf2f5';g.fillRect(x,ty,w,headH);g.strokeRect(x,ty,w,headH);
    printText(g,t,x+w-pad,ty+headH/2,mm(2.6),{weight:600,color:c});
  });
  // شعار هندسي مبسّط مؤقت للمكتب (يمكن استبداله بشعار المكتب عند توفيره).
  const lx=rightX+pad+mm(1),ly=ty+headH/2,z=mm(4.2);
  g.strokeStyle=c;g.lineWidth=mm(.3);g.strokeRect(lx,ly-z/2,z,z);
  g.beginPath();g.moveTo(lx+z*.16,ly);g.lineTo(lx+z*.5,ly-z*.3);g.lineTo(lx+z*.84,ly);
  g.moveTo(lx+z*.27,ly-z*.02);g.lineTo(lx+z*.27,ly+z*.3);g.lineTo(lx+z*.73,ly+z*.3);g.lineTo(lx+z*.73,ly-z*.02);
  g.moveTo(lx+z*.45,ly+z*.3);g.lineTo(lx+z*.45,ly+z*.08);g.lineTo(lx+z*.55,ly+z*.08);g.lineTo(lx+z*.55,ly+z*.3);g.stroke();
  const rowH=(th-headH)/4;
  const rows=(x,w,items)=>{
    items.forEach((it,i)=>{
      const yy=ty+headH+i*rowH;
      if(i){g.beginPath();g.moveTo(x,yy);g.lineTo(x+w,yy);g.strokeStyle='#aab7c2';g.lineWidth=mm(.16);g.stroke()}
      const label=it[0],value=it[1]||'—';
      printText(g,label,x+w-pad,yy+rowH*.34,mm(2.05),{color:light,weight:400});
      const isLatin=/^[\x00-\x7F]*$/.test(String(value));
      printText(g,value,x+w-pad,yy+rowH*.73,mm(2.75),{color:c,weight:600,dir:isLatin?'ltr':'rtl'});
    });
  };
  rows(rightX,rightW,[['اسم المكتب',office.name],['الهاتف',office.phone],['البريد الإلكتروني',office.email],['العنوان',office.address]]);
  rows(midX,midW,[['المشروع / نوع المبنى',project.name+(meta.type?' — '+meta.type:'')],['موقع المشروع',meta.location],['اسم المالك',meta.owner],['مساحة الأرض / البناء',`الأرض: ${meta.landArea||'—'} م²  |  البناء: ${meta.buildingArea||'—'} م²`]]);
  rows(leftX,leftW,[['نوع اللوحة',meta.drawing||'مسقط أفقي'],['مقياس الرسم',`1 : ${L.N}`],['المصمم / الاستشاري',meta.designer],['رقم اللوحة / التاريخ',`MC-01  |  ${new Date().toLocaleDateString('en-CA')}`]]);
  g.restore();
}

function renderSheet(o){
  syncDims();const L=sheetLayout(o);if(!L)return null;
  const mm=L.mm,Wp=Math.round(mm(L.pw)),Hp=Math.round(mm(L.ph)),oc=document.createElement('canvas');oc.width=Wp;oc.height=Hp;
  const g2=oc.getContext('2d'),k=1.6,ppm=L.dpi*1000/(25.4*L.N),ap=L.m+L.fr,axp=mm(ap),ayp=mm(ap),awp=mm(L.aw),ahp=mm(L.ah);
  const ox=axp+(awp-L.bw*ppm)/2-L.x0*ppm,oy=ayp+(ahp-L.bh*ppm)/2-L.y0*ppm,sv={ctx,V,W,H,dpr};
  ctx=g2;V={x:ox/k,y:oy/k,s:ppm/k};W=Wp/k;H=Hp/k;dpr=1;
  try{
    g2.fillStyle='#fff';g2.fillRect(0,0,Wp,Hp);
    // منطقة الرسم
    g2.save();g2.beginPath();g2.rect(axp,ayp,awp,ahp);g2.clip();g2.setTransform(k,0,0,k,0,0);g2.direction='ltr';
    const c={bg:'#fff',grid:'#e5eaf0',major:'#cbd5df',ln:'#172b3b',ac:'#a66a24',dim:'#425466'};
    if(o.grid){g2.beginPath();for(let x=Math.floor(L.x0);x<=L.x0+L.bw+1;x++){const p=w2s(x,0)[0];g2.moveTo(p,0);g2.lineTo(p,Hp/k)}for(let y=Math.floor(L.y0);y<=L.y0+L.bh+1;y++){const p=w2s(0,y)[1];g2.moveTo(0,p);g2.lineTo(Wp/k,p)}g2.strokeStyle=c.major;g2.lineWidth=.55;g2.stroke()}
    for(const pass of[0,1])shapes.forEach(s=>{if(!shown(s)||(!o.showDims&&s.t==='dim')||(!o.showText&&s.t==='text'))return;if((['door','door2','win'].includes(s.t))===!!pass)drawShape(s,false,false,c)});
    g2.restore();
    // إطار مزدوج وهوامش
    g2.setTransform(1,0,0,1,0,0);g2.strokeStyle='#172b3b';g2.lineWidth=mm(.42);
    g2.strokeRect(mm(L.m),mm(L.m),mm(L.pw-2*L.m),mm(L.ph-2*L.m));
    // الإطار الداخلي يحدد مساحة المسقط فقط، ولا يمتد إلى جدول البيانات السفلي.
    g2.lineWidth=mm(.18);g2.strokeRect(axp,ayp,awp,ahp);
    const tx=mm(L.m),ty=mm(L.ph-L.m-L.tb),tw=mm(L.pw-2*L.m),th=mm(L.tb);
    drawTitleBlock(g2,L,mm,tx,ty,tw,th);
    return{oc,L};
  }finally{ctx=sv.ctx;V=sv.V;W=sv.W;H=sv.H;dpr=sv.dpr}
}

function makePDF(jpg,wpx,hpx,wmm,hmm){
  const pt=v=>(v/25.4*72).toFixed(2),W2=pt(wmm),H2=pt(hmm),enc=new TextEncoder(),parts=[],offs=[];let n0=0;
  const add=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);n0+=b.length};
  const obj=(n,body,stream)=>{offs[n]=n0;add(`${n} 0 obj\n${body}\n`);if(stream){add('stream\n');add(stream);add('\nendstream\n')}add('endobj\n')};
  add('%PDF-1.4\n');obj(1,'<</Type/Catalog/Pages 2 0 R>>');obj(2,'<</Type/Pages/Kids[3 0 R]/Count 1>>');
  obj(3,`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${W2} ${H2}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
  obj(4,`<</Type/XObject/Subtype/Image/Width ${wpx}/Height ${hpx}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>`,jpg);
  const cs=`q ${W2} 0 0 ${H2} 0 0 cm /Im0 Do Q`;obj(5,`<</Length ${cs.length}>>`,cs);
  const xr=n0;add('xref\n0 6\n0000000000 65535 f \n'+[1,2,3,4,5].map(n=>String(offs[n]).padStart(10,'0')+' 00000 n \n').join(''));
  add(`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`);return new Blob(parts,{type:'application/pdf'});
}

async function doExport(kind){
  const r=renderSheet(EX);if(!r){toast('لا يوجد رسم للطباعة');return}
  if(!r.L.fits){toast(`لا يتسع الرسم بالمقياس 1:${r.L.N}، اختر مقياسًا أصغر أو ورقة أكبر`);return}
  const nm=(pname().replace(/[^\p{L}\p{N} _.()-]+/gu,'').trim()||'مخطط');
  let res;
  if(kind==='png'){
    const b=await new Promise(rs=>r.oc.toBlob(rs,'image/png'));res=await saveBlob(nm+'.png',b);
    if(res==='err'){$('#ov img').src=URL.createObjectURL(b);$('#ov').hidden=false;return}
  }else{
    const jb=await new Promise(rs=>r.oc.toBlob(rs,'image/jpeg',.94)),jpg=new Uint8Array(await jb.arrayBuffer());
    res=await saveBlob(nm+'.pdf',makePDF(jpg,r.oc.width,r.oc.height,r.L.pw,r.L.ph));
  }
  if(res==='ok')toast(`تم حفظ اللوحة المعمارية · 1:${r.L.N}`);else if(res==='err')toast('الحفظ غير متاح هنا');
}

function exportSheet(){
  const sh=$('#sheet'),office=printOffice(),meta=printMeta(),project=printProject();
  const field=(label,key,value,scope='meta')=>`<label>${label}<input data-print="${scope}.${key}" value="${esc(value||'')}" type="text"></label>`;
  const chips=(id,items,cur)=>`<div class="chips" id="${id}">${items.map(([v,l])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  sh.innerHTML='<b>إعدادات اللوحة المعمارية</b>'
    +'<b>حجم الورقة</b>'+chips('xp',[['A4','A4'],['A3','A3']],EX.paper)
    +'<b>مقياس الرسم</b>'+chips('xn',[[0,'تلقائي'],[20,'1:20'],[50,'1:50'],[100,'1:100'],[200,'1:200'],[500,'1:500']],EX.N)
    +'<b>بيانات المكتب الهندسي — تحفظ في إعدادات البرنامج</b>'
    +field('اسم المكتب','name',office.name,'office')+field('رقم الهاتف','phone',office.phone,'office')+field('البريد الإلكتروني','email',office.email,'office')+field('عنوان المكتب','address',office.address,'office')
    +'<b>بيانات المشروع والمالك</b>'
    +field('نوع المبنى','type',meta.type)+field('موقع المشروع','location',meta.location)+field('اسم المالك','owner',meta.owner)+field('مساحة الأرض م²','landArea',meta.landArea)+field('مساحة البناء م²','buildingArea',meta.buildingArea)
    +'<b>بيانات اللوحة والاعتماد</b>'
    +field('نوع اللوحة / المسقط','drawing',meta.drawing)+field('اسم المصمم / الاستشاري','designer',meta.designer)
    +'<b>محتوى اللوحة</b><div class="chips"><button class="chip" id="xg">إظهار الشبكة</button><button class="chip" id="xd">إظهار الأبعاد</button><button class="chip" id="xt">إظهار النصوص والمسميات</button></div>'
    +'<div id="xi" class="hint"></div><div class="row"><button class="fl" id="xpng">حفظ PNG</button><button class="fl" id="xpdf">حفظ PDF</button></div><button id="ok">تم</button>';
  const bind=()=>sh.querySelectorAll('[data-print]').forEach(el=>{el.onchange=()=>{const [scope,key]=el.dataset.print.split('.');if(scope==='office')office[key]=el.value;else meta[key]=el.value;save()}});bind();
  const info=()=>{const L=sheetLayout(EX);$('#xi').textContent=L?`المخطط ${f(L.bw)} × ${f(L.bh)} م · ${EX.paper} · 1:${L.N}${L.fits?'':' — لا يتسع بالمقياس المختار'}`:'لا توجد عناصر ظاهرة للطباعة'};
  const pick=(id,fn)=>sh.querySelectorAll(`#${id} .chip`).forEach(b=>{b.onclick=()=>{fn(b.dataset.v);sh.querySelectorAll(`#${id} .chip`).forEach(x=>x.classList.toggle('on',x===b));info()}});
  pick('xp',v=>EX.paper=v);pick('xn',v=>EX.N=+v);
  const toggle=(id,key)=>{const b=$('#'+id);b.classList.toggle('on',!!EX[key]);b.onclick=()=>{EX[key]=EX[key]?0:1;b.classList.toggle('on',!!EX[key]);info()}};
  toggle('xg','grid');toggle('xd','showDims');toggle('xt','showText');
  $('#xpng').onclick=()=>doExport('png');$('#xpdf').onclick=()=>doExport('pdf');
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};info();sh.classList.add('on');$('#ctx').style.display='none';
}

$('#shot').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');exportSheet()};
