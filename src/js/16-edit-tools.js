/* ==================================================================
 * 16-edit-tools.js
 * أدوات التعديل المتقدمة: إزاحة، انعكاس، نسخ متكرر، قص، تمديد، تدوير وشطف الزوايا (Fillet/Chamfer)،
 * تفكيك (Explode)، ربط (Join)، نقل/نسخ بنقطة أساس، شدّ (Stretch)، كسر (Break)، وتعديل رؤوس المتعدد والقوس.
 *
 * يعرّف: opSheet، offS، mirS، mirrorSel، opAction، trimAt، extendAt، dropDimLinks، explodeShape، explodeSel،
 *        joinChains، joinSel، cornerGeom، filletCalc، chamferCalc، applyCorner، cornerPick، cornerSheet،
 *        moveShapesBy، moveFlowStart، moveFlowPanel، moveFlowPoint، moveFlowPreview، moveFlowCommit،
 *        moveFlowSubmit، closeMoveFlow، reindexVertexLinks، vertexInsert، vertexDeleteActive، gripInsert، arcGripDrag،
 *        stretchShape، stretchHits، stretchAffected، stretchApply، stretchStart، stretchWindowDrag، stretchWindowDone،
 *        pathNearest، pathPoint، pathSlice، breakPieces، applyBreak، breakPick، breakStart
 * يعتمد على: 01-core.js، 02-geometry.js، 03-snap.js، 04-selection.js،
 *            05-persistence.js، 06-layers.js، 09-render.js، 10-dimensions.js،
 *            22-toolbar.js
 * ================================================================== */

// ---- أدوات التعديل المتقدمة: إزاحة، انعكاس، نسخ متكرر، قص، تمديد ----
let editAction=null;
function opSheet(title,fields,apply,extra){
  const sh=$('#sheet');
  sh.innerHTML=`<b>${title}</b>`+fields.map(x=>`<label>${x[1]}<input data-k="${x[0]}" dir="ltr" inputmode="decimal"></label>`).join('')+(extra||'')+'<div class="row"><button class="fl" id="opx">إلغاء</button><button class="fl" id="opk">تطبيق</button></div>';
  fields.forEach(x=>{sh.querySelector(`[data-k="${x[0]}"]`).value=x[2]});
  const val=k=>(k==='c'||k==='r'?num:nu)(sh.querySelector(`[data-k="${k}"]`).value);
  $('#opx').onclick=()=>{sh.classList.remove('on');upd()};
  $('#opk').onclick=()=>{apply(val,sh);sh.classList.remove('on');save();upd();draw()};
  sh.classList.add('on');$('#ctx').style.display='none';return sh;
}

function offS(s,d){
  const t=copy(s);
  if(s.t==='line'||s.t==='wall'){const L=len(s)||1,nx=-(s.b[1]-s.a[1])/L*d,ny=(s.b[0]-s.a[0])/L*d;t.a=[s.a[0]+nx,s.a[1]+ny];t.b=[s.b[0]+nx,s.b[1]+ny];return t}
  if(s.t==='rect'){const cx=s.x+s.w/2,cy=s.y+s.h/2,w=s.w+2*d,h=s.h+2*d;if(w<.05||h<.05)return null;t.w=w;t.h=h;t.x=cx-w/2;t.y=cy-h/2;return t}
  if(s.t==='circle'){const r=s.r+d;if(r<.05)return null;t.r=r;return t}
  if(s.t==='tri'){
    const[p0,p1,p2]=s.p,a=Math.hypot(p1[0]-p2[0],p1[1]-p2[1]),b=Math.hypot(p0[0]-p2[0],p0[1]-p2[1]),c=Math.hypot(p0[0]-p1[0],p0[1]-p1[1]),per=a+b+c;
    if(!per)return null;const I=[(a*p0[0]+b*p1[0]+c*p2[0])/per,(a*p0[1]+b*p1[1]+c*p2[1])/per],r=area(s)/(per/2),k=(r+d)/r;
    if(!(k>.05))return null;t.p=s.p.map(q=>[I[0]+(q[0]-I[0])*k,I[1]+(q[1]-I[1])*k]);return t;
  }
  return null;
}

function mirS(s,ax,c){
  const t=copy(s),mp=q=>ax==='v'?[2*c-q[0],q[1]]:[q[0],2*c-q[1]];
  if(s.t==='line'||s.t==='wall'||s.t==='dim'){t.a=mp(s.a);t.b=mp(s.b);if(s.t==='dim')t.off=-s.off}
  else if(s.p)t.p=s.p.map(mp);
  else if(s.t==='rect'||s.t==='furn'){const m=mp([s.x+s.w/2,s.y+s.h/2]);t.x=m[0]-s.w/2;t.y=m[1]-s.h/2;t.rot=-(s.rot||0)}
  else if(s.t==='door'||s.t==='door2'||s.t==='win'){const m=mp([s.x,s.y]);t.x=m[0];t.y=m[1];t.a=ax==='v'?Math.PI-s.a:-s.a;if(s.t==='door'||s.t==='door2')t.f=-s.f}
  else if(s.t==='arc'){const m=mp([s.x,s.y]);t.x=m[0];t.y=m[1];const fn=a=>ax==='v'?Math.PI-a:-a;t.a0=fn(s.a1);t.a1=fn(s.a0);while(t.a1<=t.a0)t.a1+=Math.PI*2}
  else{const m=mp([s.x,s.y]);t.x=m[0];t.y=m[1]}
  return t;
}

function mirrorSel(m){
  const BB=bounds(sel.map(i=>shapes[i])),x0=BB.x,x1=BB.X,y0=BB.y,y1=BB.Y;
  const ax=m==='r'?['v',x1]:m==='l'?['v',x0]:m==='b'?['h',y1]:m==='t'?['h',y0]:m==='fv'?['v',(x0+x1)/2]:['h',(y0+y1)/2];
  snap();const out=sel.map(i=>mirS(shapes[i],ax[0],ax[1]));out.forEach(d=>{if(d.t==='dim'){delete d.la;delete d.lb}});
  if(m==='fv'||m==='fh')sel.forEach((i,k)=>{shapes[i]=out[k]});
  else{shapes.push(...out);sel=out.map((_,k)=>shapes.length-out.length+k)}
}

function opAction(a){
  $$('.gm').forEach(m=>m.classList.remove('on'));
  editAction=a;upd();
  if(a==='stretch'){stretchStart();return}
  if(a==='brk1'||a==='brk2'){breakStart(a==='brk1'?'pt':'two');return}
  if(!sel.length){tool='select';upd();toast('حدّد أشكالًا أولًا ثم اختر الأداة');return}
  if(a==='offset'){
    const ts=sel.map(i=>shapes[i]).filter(s=>['line','wall','rect','circle','tri'].includes(s.t));
    if(!ts.length){toast('الإزاحة للخطوط والجدران والغرف والدوائر والمثلثات');return}
    opSheet('إزاحة',[['d','المسافة ('+uA()+')',fu(.5)]],val=>{
      const d=val('d');if(!d)return;const out=ts.map(s=>offS(s,d)).filter(Boolean);
      if(!out.length){toast('المسافة كبيرة جدًا');return}
      snap();shapes.push(...out);sel=out.map((_,k)=>shapes.length-out.length+k);
    },'<div style="color:var(--dim);font-size:12px">موجبة: للخارج (أو لليمين في الخط)، وسالبة: العكس</div>');
  }else if(a==='mirror'){
    const sh=opSheet('انعكاس',[],()=>{},'<div class="row"><button class="fl" data-m="r">نسخة لليمين</button><button class="fl" data-m="l">نسخة لليسار</button></div><div class="row"><button class="fl" data-m="b">نسخة للأسفل</button><button class="fl" data-m="t">نسخة للأعلى</button></div><div class="row"><button class="fl" data-m="fv">قلب أفقي</button><button class="fl" data-m="fh">قلب رأسي</button></div>');
    $('#opk').hidden=true;
    sh.querySelectorAll('[data-m]').forEach(b=>{b.onclick=()=>{mirrorSel(b.dataset.m);sh.classList.remove('on');save();upd();draw()}});
  }else if(a==='explode'){explodeSel();editAction=null;save();upd();draw()}
  else if(a==='join'){joinSel();editAction=null;save();upd();draw()}
  else if(a==='bmove'||a==='bcopy')moveFlowStart(a==='bmove'?'move':'copy');
  else if(a==='array'){
    const BB=bounds(sel.map(i=>shapes[i])),w=BB.X-BB.x,h=BB.Y-BB.y;
    opSheet('نسخ متكرر',[['c','عدد الأعمدة (مع الأصل)',3],['r','عدد الصفوف (مع الأصل)',1],['dx','المسافة بين الأعمدة ('+uA()+')',fu(w)],['dy','المسافة بين الصفوف ('+uA()+')',fu(h)]],val=>{
      const c=Math.max(1,Math.round(val('c'))||1),r=Math.max(1,Math.round(val('r'))||1),dx=val('dx')||0,dy=val('dy')||0;
      if(c*r>200){toast('الحد الأقصى 200 نسخة');return}
      snap();const out=[];
      for(let i=0;i<r;i++)for(let j=0;j<c;j++){if(!i&&!j)continue;{const grp=sel.map(k=>{const s=shapes[k],t=copy(s);mv(t,s,j*dx,i*dy);return t});fixLinks(sel.map(k=>shapes[k]),grp);out.push(...grp)}}
      shapes.push(...out);sel=out.map((_,k)=>shapes.length-out.length+k);
    },'<div style="color:var(--dim);font-size:12px">الصفوف تنزل للأسفل، والمسافة تُقاس من بداية كل نسخة</div>');
  }
}

function trimAt(p){
  const i=hit(p[0],p[1]),s=shapes[i];
  if(!s||(s.t!=='line'&&s.t!=='wall')){toast('القص يعمل على الخطوط والجدران فقط');return}
  const A=s.a,B=s.b,dx=B[0]-A[0],dy=B[1]-A[1],L2=dx*dx+dy*dy,w=s2w(p[0],p[1]);if(!L2)return;
  const par=q=>((q[0]-A[0])*dx+(q[1]-A[1])*dy)/L2,t0=clamp(par(w),0,1),ts=[];
  shapes.forEach((o,k)=>{if(k===i||!shown(o))return;segs(o).forEach(e=>xSS([A,B],e).forEach(q=>ts.push(par(q))));if(o.t==='circle')xSC([A,B],o).forEach(q=>ts.push(par(q)))});
  const ok=ts.filter(t=>t>1e-6&&t<1-1e-6),prev=ok.filter(t=>t<t0).sort((x,y)=>y-x)[0],next=ok.filter(t=>t>t0).sort((x,y)=>x-y)[0];
  if(prev===undefined&&next===undefined){toast('لا يوجد ما يقطع هذا الخط');return}
  const P=t=>[A[0]+dx*t,A[1]+dy*t];snap();
  if(prev!==undefined&&next!==undefined){const t=copy(s);t.a=P(next);t.b=B.slice();s.b=P(prev);shapes.push(t)}
  else if(next!==undefined)s.a=P(next);
  else s.b=P(prev);
  sel=[];save();
}

function extendAt(p){
  const i=hit(p[0],p[1]),s=shapes[i];
  if(!s||(s.t!=='line'&&s.t!=='wall')){toast('التمديد يعمل على الخطوط والجدران فقط');return}
  const w=s2w(p[0],p[1]),da=Math.hypot(w[0]-s.a[0],w[1]-s.a[1]),db=Math.hypot(w[0]-s.b[0],w[1]-s.b[1]),end=da<db?'a':'b',P0=s[end==='a'?'b':'a'],P1=s[end];
  const dx=P1[0]-P0[0],dy=P1[1]-P0[1],L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,ray=[P1,[P1[0]+ux*1e4,P1[1]+uy*1e4]];
  let best=null,bt=1e9;
  shapes.forEach((o,k)=>{
    if(k===i||!shown(o))return;const ps=[];
    segs(o).forEach(e=>xSS(ray,e).forEach(q=>ps.push(q)));if(o.t==='circle')xSC(ray,o).forEach(q=>ps.push(q));
    ps.forEach(q=>{const t=(q[0]-P1[0])*ux+(q[1]-P1[1])*uy;if(t>1e-6&&t<bt){bt=t;best=q}});
  });
  if(!best){toast('لا يوجد ما يمدّ إليه');return}
  snap();s[end]=best;save();
}

// ================================================================
// تفكيك، ربط، تدوير/شطف الزوايا، ونقل/نسخ بنقطة أساس
// ================================================================

// بعد حذف أشكال (تفكيك/ربط) نفكّ روابط الأبعاد التي كانت تشير إلى هوياتها كي لا تبقى معلّقة
function dropDimLinks(list,ids){
  if(!ids.size)return;
  list.forEach(d=>{if(d.t!=='dim')return;for(const k of['la','lb']){if(d[k]&&ids.has(d[k].id))delete d[k]}if(d.circleId&&ids.has(d.circleId))delete d.circleId});
}

// ---- Explode: مستطيل/مثلث/مضلع/متعدد الخطوط ← خطوط منفصلة تحمل الطبقة واللون والسماكة ----
const EXPLODABLE=['rect','tri','polygon','polyline'];
function explodeShape(s){
  if(!EXPLODABLE.includes(s.t))return null;
  const out=[];
  for(const[p,q]of segs(s)){
    if(Math.hypot(q[0]-p[0],q[1]-p[1])<1e-9)continue;
    const l={t:'line',a:[p[0],p[1]],b:[q[0],q[1]]};
    if(s.ly!==undefined)l.ly=s.ly;if(s.col)l.col=s.col;if(s.lw)l.lw=s.lw;
    out.push(l);
  }
  return out.length?out:null;
}
function explodeSel(){
  const pick=new Set(sel),next=[],made=[],ids=new Set();let n=0;
  shapes.forEach((s,i)=>{
    const parts=pick.has(i)&&ed(s)?explodeShape(s):null;
    if(!parts){next.push(s);return}
    n++;if(s.id)ids.add(s.id);
    parts.forEach(l=>{made.push(next.length);next.push(l)});
  });
  if(!n){toast('التفكيك للمستطيل والمثلث والمضلع والمتعدد الخطوط');return false}
  snap();dropDimLinks(next,ids);shapes=next;sel=made;
  toast(`تم تفكيك ${n} شكل إلى ${made.length} خط`);return true;
}

// ---- Join: يصل الخطوط والمتعددات المفتوحة التي تتلامس أطرافها (ضمن tol) في متعدد واحد، ويغلقه إن عاد لبدايته ----
// list: مصفوفة من مصفوفات نقاط [[x,y],...]. تُرجع سلاسل {pts,members,closed}.
function joinChains(list,tol){
  const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<=tol,used=list.map(()=>false),res=[];
  for(let i=0;i<list.length;i++){
    if(used[i])continue;used[i]=true;
    let c=list[i].map(q=>[q[0],q[1]]);const mem=[i];
    for(let again=true;again;){
      again=false;
      for(let j=0;j<list.length;j++){
        if(used[j])continue;
        const p=list[j],e=c[c.length-1],b=c[0];let add=null,front=false;
        if(near(e,p[0]))add=p.slice(1);
        else if(near(e,p[p.length-1]))add=p.slice(0,-1).reverse();
        else if(near(b,p[p.length-1])){add=p.slice(0,-1);front=true}
        else if(near(b,p[0])){add=p.slice(1).reverse();front=true}
        if(!add)continue;
        used[j]=true;mem.push(j);again=true;
        const m=add.map(q=>[q[0],q[1]]);c=front?m.concat(c):c.concat(m);
      }
    }
    const closed=mem.length>1&&c.length>=4&&near(c[0],c[c.length-1]);
    if(closed)c.pop();
    res.push({pts:c,members:mem,closed});
  }
  return res;
}
function joinSel(){
  const tol=clamp(3/Math.max(V.s,1e-9),1e-4,.02),pieces=[],idx=[];
  sel.forEach(i=>{
    const s=shapes[i];if(!s||!ed(s))return;
    if(s.t==='line'){pieces.push([s.a,s.b]);idx.push(i)}
    else if(s.t==='polyline'&&s.p&&s.p.length>=2){pieces.push(s.p);idx.push(i)}
  });
  if(pieces.length<2){toast('حدّد خطين أو أكثر (خطوط أو متعددات خطوط) لربطها');return false}
  const chains=joinChains(pieces,tol).filter(c=>c.members.length>1);
  if(!chains.length){toast('لا توجد أطراف متلامسة للربط');return false}
  const gone=new Set(),at=new Map(),ids=new Set();
  chains.forEach(c=>{
    const ord=c.members.map(m=>idx[m]).sort((x,y)=>x-y),base=shapes[ord[0]];
    const n={t:c.closed?'polygon':'polyline',p:c.pts};
    if(base.ly!==undefined)n.ly=base.ly;if(base.col)n.col=base.col;if(base.lw)n.lw=base.lw;
    at.set(ord[0],n);ord.forEach(i=>{gone.add(i);if(shapes[i].id)ids.add(shapes[i].id)});
  });
  const next=[],made=[];
  shapes.forEach((s,i)=>{if(at.has(i)){made.push(next.length);next.push(at.get(i))}else if(!gone.has(i))next.push(s)});
  snap();dropDimLinks(next,ids);shapes=next;sel=made;
  toast(`تم الربط: ${chains.length} متعدد${chains.some(c=>c.closed)?' (مغلق)':''}`);return true;
}

// ---- Fillet / Chamfer للخطين، ولرؤوس الأشكال المغلقة كعنصر واحد ----
let FILLET_R=.3,CHAMFER_D1=.3,CHAMFER_D2=.3;

// حساب هندسة زاوية محددة في مسار مغلق. ندعم الزوايا المحدبة ونرفض المقعرة بوضوح.
function cornerVertexGeom(p,i){
  const n=p.length,v=p[i],a=p[(i+n-1)%n],b=p[(i+1)%n];
  const ax=a[0]-v[0],ay=a[1]-v[1],bx=b[0]-v[0],by=b[1]-v[1];
  const la=Math.hypot(ax,ay),lb=Math.hypot(bx,by);
  if(la<1e-9||lb<1e-9)return{err:'يوجد ضلع قصير جدًا عند هذه الزاوية'};
  const u=[ax/la,ay/la],w=[bx/lb,by/lb],dot=clamp(u[0]*w[0]+u[1]*w[1],-1,1),theta=Math.acos(dot);
  if(theta<1e-4||Math.PI-theta<1e-4)return{err:'هذه الزاوية مستقيمة تقريبًا'};
  let signed=0;for(let j=0;j<n;j++){const q=p[j],z=p[(j+1)%n];signed+=q[0]*z[1]-z[0]*q[1]}
  const orient=signed>=0?1:-1,cross=u[0]*w[1]-u[1]*w[0];
  if(cross*orient>=-1e-8)return{err:'تدوير الزوايا المقعرة غير مدعوم حاليًا'};
  return{v,u,w,la,lb,theta,orient};
}

// يعيد مسارًا واحدًا متصلًا؛ القوس ممثل بنقاط ضمن بيانات الشكل نفسه، وليس عنصرًا منفصلًا.
function corneredPath(base,mods){
  const n=base.length;if(n<3)return{err:'الشكل يحتاج إلى ثلاثة رؤوس على الأقل'};
  const info=base.map((_,i)=>mods[i]?cornerVertexGeom(base,i):null),prevD=Array(n).fill(0),nextD=Array(n).fill(0);
  for(let i=0;i<n;i++){
    const m=mods[i];if(!m)continue;
    const c=info[i];if(c.err)return c;
    if(m.type==='fillet'){
      const r=Number(m.r)||0;if(r<0)return{err:'نصف القطر غير صالح'};
      const d=r/Math.tan(c.theta/2);prevD[i]=nextD[i]=d;
    }else{
      const d1=Number(m.d1)||0,d2=Number(m.d2)||0;
      if(d1<0||d2<0||(d1===0)!==(d2===0))return{err:'أدخل مسافتين موجبتين أو صفرًا لإلغاء الشطف'};
      prevD[i]=d1;nextD[i]=d2;
    }
    if(prevD[i]>=c.la-1e-8||nextD[i]>=c.lb-1e-8)return{err:'قيمة التعديل كبيرة جدًا بالنسبة لطول الضلع'};
  }
  for(let i=0;i<n;i++){
    const j=(i+1)%n,L=Math.hypot(base[j][0]-base[i][0],base[j][1]-base[i][1]);
    if(nextD[i]+prevD[j]>=L-1e-8)return{err:'تتداخل التعديلات على الزوايا المتجاورة؛ قلّل القيمة'};
  }
  const out=[];
  for(let i=0;i<n;i++){
    const m=mods[i],v=base[i];if(!m){out.push(v.slice());continue}
    const c=info[i],d1=prevD[i],d2=nextD[i],T1=[v[0]+c.u[0]*d1,v[1]+c.u[1]*d1],T2=[v[0]+c.w[0]*d2,v[1]+c.w[1]*d2];
    out.push(T1);
    if(m.type==='fillet'&&(Number(m.r)||0)>1e-9){
      const r=Number(m.r),ux=c.u[0]+c.w[0],uy=c.u[1]+c.w[1],ul=Math.hypot(ux,uy)||1,bis=[ux/ul,uy/ul],h=r/Math.sin(c.theta/2),C=[v[0]+bis[0]*h,v[1]+bis[1]*h];
      const a0=Math.atan2(T1[1]-C[1],T1[0]-C[0]),a1=Math.atan2(T2[1]-C[1],T2[0]-C[0]);
      let delta=a1-a0;if(c.orient>0){while(delta<0)delta+=Math.PI*2}else{while(delta>0)delta-=Math.PI*2}
      if(Math.abs(delta)>Math.PI+1e-5)return{err:'تعذّر إنشاء قوس التدوير لهذه الزاوية'};
      const steps=clamp(Math.ceil(Math.abs(delta)*Math.max(r,0.1)/0.025),4,48);
      for(let j=1;j<=steps;j++){const a=a0+delta*j/steps;out.push([C[0]+r*Math.cos(a),C[1]+r*Math.sin(a)])}
    }else out.push(T2);
  }
  return{p:out};
}

function applyShapeCorner(i,index,mode){
  const s=shapes[i],base=(s.cornerBase||pts(s)).map(q=>q.slice()),mods=Object.assign({},s.cornerMods||{});
  const key=String(index);
  if(mode==='fillet')mods[key]=FILLET_R>1e-9?{type:'fillet',r:FILLET_R}:undefined;
  else mods[key]=CHAMFER_D1>1e-9&&CHAMFER_D2>1e-9?{type:'chamfer',d1:CHAMFER_D1,d2:CHAMFER_D2}:undefined;
  if(!mods[key])delete mods[key];
  const result=corneredPath(base,mods);if(result.err){toast(result.err);return false}
  snap();s.cornerBase=base;s.cornerMods=mods;s.p=result.p;vtxActive=null;sel=[i];save();
  toast(mode==='fillet'?'تم تدوير زاوية الشكل':'تم شطف زاوية الشكل');return true;
}

// يحدد أقرب رأس في المستطيل أو المثلث أو المضلع؛ يبقى الشكل سجلًا واحدًا في shapes.
function cornerShapePick(i,s,p){
  const base=s.cornerBase||pts(s);let best=-1,d=Infinity;
  for(let k=0;k<base.length;k++){const q=w2s(...base[k]),v=Math.hypot(q[0]-p[0],q[1]-p[1]);if(v<d){d=v;best=k}}
  if(best<0||d>36){toast('المس زاوية الشكل بالقرب من أحد رؤوسه');return true}
  applyShapeCorner(i,best,tool);return true;
}

// يحدد نقطة التقاء امتدادي الخطين X، والطرف الذي يبقى من كل خط.
function cornerGeom(A,B,pa,pb){
  const d1=[A.b[0]-A.a[0],A.b[1]-A.a[1]],d2=[B.b[0]-B.a[0],B.b[1]-B.a[1]],L1=Math.hypot(d1[0],d1[1]),L2=Math.hypot(d2[0],d2[1]);
  if(L1<1e-9||L2<1e-9)return{err:'أحد الخطين بلا طول'};
  const cr=d1[0]*d2[1]-d1[1]*d2[0];if(Math.abs(cr)<1e-9*L1*L2)return{err:'الخطان متوازيان فلا يلتقيان'};
  const w=[B.a[0]-A.a[0],B.a[1]-A.a[1]],t1=(w[0]*d2[1]-w[1]*d2[0])/cr,t2=(w[0]*d1[1]-w[1]*d1[0])/cr,X=[A.a[0]+d1[0]*t1,A.a[1]+d1[1]*t1];
  const tp1=((pa[0]-A.a[0])*d1[0]+(pa[1]-A.a[1])*d1[1])/(L1*L1),tp2=((pb[0]-B.a[0])*d2[0]+(pb[1]-B.a[1])*d2[1])/(L2*L2),far1=tp1<t1?'a':'b',far2=tp2<t2?'a':'b',F1=A[far1],F2=B[far2],n1=Math.hypot(F1[0]-X[0],F1[1]-X[1]),n2=Math.hypot(F2[0]-X[0],F2[1]);
  if(n1<1e-9||n2<1e-9)return{err:'لا يبقى من أحد الخطين جزء؛ المس الجهة الأخرى منه'};
  return{X,n1,n2,v1:[(F1[0]-X[0])/n1,(F1[1]-X[1])/n1],v2:[(F2[0]-X[0])/n2,(F2[1]-X[1])/n2],near1:far1==='a'?'b':'a',near2:far2==='a'?'b':'a'};
}
function filletCalc(A,B,pa,pb,r){
  const c=cornerGeom(A,B,pa,pb);if(c.err)return c;const{X,v1,v2,n1,n2}=c,end=(e,pt)=>({end:e,pt});
  if(!(r>1e-9))return{a1:end(c.near1,X),a2:end(c.near2,X)};
  const th=Math.acos(clamp(v1[0]*v2[0]+v1[1]*v2[1],-1,1));if(th<1e-4||Math.PI-th<1e-4)return{err:'الخطان على استقامة واحدة'};
  const d=r/Math.tan(th/2);if(d>n1-1e-6||d>n2-1e-6)return{err:'نصف القطر كبير جدًا لهذين الخطين'};
  const T1=[X[0]+v1[0]*d,X[1]+v1[1]*d],T2=[X[0]+v2[0]*d,X[1]+v2[1]*d],ux=v1[0]+v2[0],uy=v1[1]+v2[1],ul_=Math.hypot(ux,uy);let bx=ux/ul_,by=uy/ul_;const C=[X[0]+bx*r/Math.sin(th/2),X[1]+by*r/Math.sin(th/2)],al1=Math.atan2(T1[1]-C[1],T1[0]-C[0]),al2=Math.atan2(T2[1]-C[1],T2[0]-C[0]);let dl=al2-al1;while(dl>Math.PI)dl-=Math.PI*2;while(dl<=-Math.PI)dl+=Math.PI*2;
  return{a1:end(c.near1,T1),a2:end(c.near2,T2),arc:{t:'arc',x:C[0],y:C[1],r,a0:dl>=0?al1:al2,a1:dl>=0?al1+dl:al2-dl}};
}
function chamferCalc(A,B,pa,pb,d1,d2){
  const c=cornerGeom(A,B,pa,pb);if(c.err)return c;const{X,v1,v2,n1,n2}=c,end=(e,pt)=>({end:e,pt}),z1=!(d1>1e-9),z2=!(d2>1e-9);
  if(z1&&z2)return{a1:end(c.near1,X),a2:end(c.near2,X)};if(z1||z2)return{err:'المسافتان إما صفر معًا أو أكبر من صفر معًا'};
  if(d1>n1-1e-6||d2>n2-1e-6)return{err:'المسافة كبيرة جدًا لهذين الخطين'};
  const T1=[X[0]+v1[0]*d1,X[1]+v1[1]*d1],T2=[X[0]+v2[0]*d2,X[1]+v2[1]*d2];return{a1:end(c.near1,T1),a2:end(c.near2,T2),line:{t:'line',a:T1.slice(),b:T2.slice()}};
}
function applyCorner(i,j,res){
  const A=shapes[i],B=shapes[j];snap();A[res.a1.end]=res.a1.pt.slice();B[res.a2.end]=res.a2.pt.slice();const n=res.arc||res.line;
  if(n){const o=Object.assign({},n);if(A.ly!==undefined)o.ly=A.ly;if(A.col)o.col=A.col;if(A.lw)o.lw=A.lw;shapes.push(o)}
  sel=[i,j].concat(n?[shapes.length-1]:[]);save();
}
function cornerPick(p){
  const i=hit(p[0],p[1]),s=shapes[i],w=s2w(p[0],p[1]);
  if(!s){toast('المس زاوية أو خطًا');return}
  if(['rect','tri','polygon'].includes(s.t)) {cornerShapePick(i,s,p);return}
  if(s.t!=='line'&&s.t!=='wall'){toast('الأداة تعمل على رؤوس المستطيل والمثلث والمضلع أو على خطين');return}
  if(!cornerFirst||!shapes[cornerFirst.i]){cornerFirst={i,w};sel=[i];toast('المس الخط الثاني');return}
  if(cornerFirst.i===i){toast('اختر خطًا آخر');return}
  const f=cornerFirst,A=shapes[f.i],res=tool==='fillet'?filletCalc(A,s,f.w,w,FILLET_R):chamferCalc(A,s,f.w,w,CHAMFER_D1,CHAMFER_D2);
  if(res.err){toast(res.err);return}
  if((res.arc||res.line)&&(A.t==='wall'||s.t==='wall')){toast('الجدران تُوصل بزاوية حادة فقط: اجعل القيمة صفرًا');return}
  applyCorner(f.i,i,res);cornerFirst=null;toast(tool==='fillet'?(res.arc?'تم تدوير الزاوية':'تم وصل الخطين'):(res.line?'تم شطف الزاوية':'تم وصل الخطين'));
}
function cornerSheet(){
  if(tool==='fillet')opSheet('تدوير زاوية (Fillet)',[['rad','نصف القطر ('+uA()+')',fu(FILLET_R)]],val=>{const v=val('rad');if(!(v>=0)){toast('أدخل صفرًا أو قيمة أكبر');return}FILLET_R=v;toast('المس رأس الزاوية في الشكل أو الخطين');},'<div style="color:var(--dim);font-size:12px">اختر رأسًا من المستطيل أو المثلث أو المضلع. الصفر يلغي التدوير السابق لهذه الزاوية.</div>');
  else opSheet('شطف زاوية (Chamfer)',[['d1','المسافة الأولى ('+uA()+')',fu(CHAMFER_D1)],['d2','المسافة الثانية ('+uA()+')',fu(CHAMFER_D2)]],val=>{const a=val('d1'),b=val('d2');if(!(a>=0&&b>=0)||((a===0)!==(b===0))){toast('أدخل مسافتين موجبتين أو صفرًا لإلغاء الشطف');return}CHAMFER_D1=a;CHAMFER_D2=b;toast('المس رأس الزاوية في الشكل أو الخطين')},'<div style="color:var(--dim);font-size:12px">اختر رأسًا من المستطيل أو المثلث أو المضلع. الصفر يلغي الشطف السابق لهذه الزاوية.</div>');
}

// ---- نقل / نسخ بنقطة أساس: نقطة الأساس ثم نقطة الوصول (أو إزاحة تُكتب)، والنسخ يتكرر حتى الإنهاء ----
const MOVE_GHOST_MAX=300;
// تحريك أشكال بإزاحة (dx,dy) من نسخ أصلية orig: روابط الأبعاد تتحدّث مع الأشكال، والأبواب والنوافذ تلتصق بأقرب جدار
function moveShapesBy(items,orig,dx,dy){
  items.forEach((s,n)=>mv(s,orig[n],dx,dy));
  items.forEach((s,n)=>{const o=orig[n];if(s.t==='dim'&&s.circleId)delete s.circleId;if(s.t==='dim'&&(s.la||s.lb)){s.a=o.a.slice();s.b=o.b.slice();const L=len(o)||1;s.off=o.off+(dx*(-(o.b[1]-o.a[1]))+dy*(o.b[0]-o.a[0]))/L}});
  items.forEach(s=>{if(s.t==='door'||s.t==='door2'||s.t==='win'){const q=wallAt([s.x,s.y],28/V.s);if(q){s.x=q.q[0];s.y=q.q[1];s.a=q.a;s.th=q.th}}});
}
function closeMoveFlow(){
  if(!moveFlow)return;
  moveFlow=null;if(editAction==='bmove'||editAction==='bcopy'||editAction==='stretch')editAction=null;
  $('#drawInput').classList.remove('on');upd();
}
function moveFlowPanel(){
  const F=moveFlow;if(!F)return;
  const L=` (${ul()})`,base=F.stage==='base',win=F.stage==='window';
  $('#diTitle').textContent=`${{move:'نقل',copy:'نسخ',stretch:'شدّ'}[F.mode]} · ${win?'اسحب إطارًا حول الرؤوس المراد شدّها':base?'حدّد نقطة الأساس':F.mode==='copy'&&F.n?`حدّد نقطة وصول أخرى (${F.n} نسخة)`:'حدّد نقطة الوصول أو اكتب الإزاحة'}`;
  $('#diFinish').style.display=F.mode==='copy'&&F.n?'':'none';
  $('#diCoords').style.display=win?'none':'flex';$('#diExtra').style.display='none';$('#diExtra').innerHTML='';
  $('#diX').placeholder=(base?'X':'ΔX')+L;$('#diY').placeholder=(base?'Y':'ΔY')+L;$('#diX').value='';$('#diY').value='';
  $('#drawInput').classList.add('on');diSetOpen(diOpen,diAutoFocus());
}
function moveFlowStart(mode){
  if(polyDraft)finishPolyline();
  closeDrawFlow();closeMoveFlow();cornerFirst=null;tool='select';setMoveMode(false);
  const items=sel.map(i=>shapes[i]).filter(s=>s&&ed(s));
  if(!items.length){toast('العناصر المحددة مقفلة أو مخفية');upd();return}
  editAction=mode==='move'?'bmove':'bcopy';
  moveFlow={mode,stage:'base',items,base:null,at:null,n:0,ghost:null,bb:bounds(items)};
  toast(mode==='move'?'المس نقطة الأساس ثم نقطة الوصول':'المس نقطة الأساس ثم نقطة (أو عدة نقاط) للنسخ');
  moveFlowPanel();upd();draw();
}
// نقطة أساس أو وصول: w بإحداثيات عالمية، وexact=true إن أُدخلت رقميًا فلا التقاط ولا قيد
function moveFlowPoint(w,exact){
  const F=moveFlow;if(!F)return;
  let pt=exact?w.slice():snapPt(w);
  if(F.stage==='base'){F.base=pt;F.at=pt;F.stage='dest';moveFlowPanel();return}
  if(!exact&&!mk&&(S.ortho||S.polar))pt=constrain(F.base,pt);
  moveFlowCommit(pt[0]-F.base[0],pt[1]-F.base[1]);
}
function moveFlowPreview(w){
  const F=moveFlow;if(!F||F.stage!=='dest')return;
  let d=snapPt(w);if(!mk&&(S.ortho||S.polar))d=constrain(F.base,d);
  F.at=d;const dx=d[0]-F.base[0],dy=d[1]-F.base[1];
  if(F.mode==='stretch'){const aff=stretchAffected(F.win);F.ghost=aff.length<=MOVE_GHOST_MAX?aff.map(s=>{const t=copy(s);stretchShape(t,F.win,dx,dy);return t}):null;return}
  F.ghost=F.items.length<=MOVE_GHOST_MAX?F.items.map(s=>{const t=copy(s);mv(t,s,dx,dy);return t}):null;
}
function moveFlowCommit(dx,dy){
  const F=moveFlow;if(!F)return;
  if(F.mode==='stretch'){
    if(!F.win)return;
    if(!(Math.abs(dx)>1e-9||Math.abs(dy)>1e-9)){toast('الإزاحة صفر');return}
    if(!stretchAffected(F.win).length){closeMoveFlow();toast('لم يعد في الإطار ما يُشدّ');draw();return}
    snap();const aff=stretchApply(F.win,dx,dy),ix=new Map(shapes.map((s,i)=>[s,i]));
    sel=aff.map(s=>ix.get(s));closeMoveFlow();toast(`تم شدّ ${aff.length} شكل`);save();upd();draw();return;
  }
  const have=new Set(shapes),items=F.items.filter(s=>have.has(s));
  if(!items.length){closeMoveFlow();toast('العناصر المحددة لم تعد موجودة');draw();return}
  if(!(Math.abs(dx)>1e-9||Math.abs(dy)>1e-9)){toast('الإزاحة صفر');return}
  snap();
  if(F.mode==='move'){
    moveShapesBy(items,items.map(copy),dx,dy);
    const ix=new Map(shapes.map((s,i)=>[s,i]));sel=items.map(s=>ix.get(s));
    closeMoveFlow();toast(`تم نقل ${items.length} عنصر`);
  }else{
    const out=items.map(copy);fixLinks(items,out);moveShapesBy(out,items,dx,dy);
    for(const s of out)shapes.push(s);
    F.n++;F.ghost=null;F.at=F.base;toast(`تمت النسخة ${F.n}`);moveFlowPanel();
  }
  save();upd();draw();
}
// ✓ في الشريط: نقطة الأساس (X,Y مطلقتان) ثم الإزاحة (ΔX,ΔY). Y للأعلى كما في شريط الإحداثيات.
function moveFlowSubmit(){
  const F=moveFlow;if(!F)return;
  if(F.stage==='window'){toast('ارسم الإطار أولًا بالسحب على اللوحة');return}
  const xs=$('#diX').value.trim(),ys=$('#diY').value.trim();
  if(F.stage==='base'){
    if(xs===''||ys===''){toast('أدخل إحداثيي نقطة الأساس X وY');return}
    const x=nu(xs),y=nu(ys);if(!Number.isFinite(x)||!Number.isFinite(y)){toast('أدخل رقمين صحيحين');return}
    moveFlowPoint([x,-y],true);return;
  }
  if(xs===''&&ys===''){toast('أدخل الإزاحة ΔX وΔY');return}
  const x=xs===''?0:nu(xs),y=ys===''?0:nu(ys);
  if(!Number.isFinite(x)||!Number.isFinite(y)){toast('أدخل رقمين صحيحين');return}
  moveFlowCommit(x,-y);
}

// ================================================================
// رؤوس المتعدد/المضلع والقوس، شدّ (Stretch)، وكسر (Break)
// ================================================================

// ---- رؤوس المتعدد/المضلع: الإضافة والحذف تعيد ترقيم روابط الأبعاد كي لا يقفز بُعد إلى رأس آخر ----
// k = رقم الرأس المضاف (delta=+1) أو المحذوف (delta=-1)، وn = عدد الرؤوس قبل التغيير.
// رابط رأس: i = رقم الرأس. رابط ضلع (m أو t): i = رقم الضلع (من الرأس i إلى i+1). الأبعاد الزاوية تُفكّ روابطها لأن i فيها رقم ضلع بلا علامة.
function reindexVertexLinks(s,k,delta,n){
  if(!s.id)return;
  const closed=s.t==='polygon';
  shapes.forEach(d=>{
    if(d.t!=='dim')return;
    for(const key of['la','lb']){
      const L=d[key];if(!L||L.id!==s.id)continue;
      if(d.mode==='angular'){delete d[key];continue}
      const edge=!!L.m||L.t!==undefined;
      if(delta>0){
        if(L.i>=k)L.i++;
        else if(edge&&L.i===k-1)delete d[key];          // الضلع انقسم إلى ضلعين
      }else if(!edge){
        if(L.i===k)delete d[key];else if(L.i>k)L.i--;
      }else{
        const prev=closed?(k-1+n)%n:k-1;                 // ضلعا الرأس المحذوف يندمجان فيسقط رابطاهما
        if(L.i===k||L.i===prev)delete d[key];else if(L.i>k)L.i--;
      }
    }
  });
}
function vertexInsert(s,k,pt){reindexVertexLinks(s,k,1,s.p.length);s.p.splice(k,0,[pt[0],pt[1]])}
// حذف الرأس النشط (زر «حذف رأس» أو Delete): المضلع لا ينزل عن 3 رؤوس ولا المتعدد عن رأسين
function vertexDeleteActive(){
  const v=vtxSel();if(!v){toast('المس مقبض رأس على متعدد خطوط أو مضلع أولًا');return false}
  const s=v.s,min=s.t==='polygon'?3:2;
  if(s.p.length<=min){toast(s.t==='polygon'?'المضلع يحتاج 3 رؤوس على الأقل':'المتعدد يحتاج رأسين على الأقل');return false}
  snap();reindexVertexLinks(s,v.k,-1,s.p.length);s.p.splice(v.k,1);vtxActive=null;
  toast('تم حذف الرأس');save();upd();draw();return true;
}
$('#vdel').onclick=vertexDeleteActive;
// سحب مقبض منتصف ضلع: عند أول حركة يُضاف الرأس الجديد عند المنتصف ثم يُسحب كأي رأس
function gripInsert(g,s){const k=g.gr.ins;vertexInsert(s,k,g.gr.at);g.o=copy(s);g.gr={id:k,kind:'v'};g.ins=1}
// سحب مقبض قوس: a0/a1 يغيّران زاوية البداية/النهاية (الطرف الآخر ثابت)، وar يغيّر نصف القطر
function arcGripDrag(s,o,id,q){
  const TAU=Math.PI*2,th=Math.atan2(q[1]-o.y,q[0]-o.x),mod=v=>((v%TAU)+TAU)%TAU;
  if(id==='ar')s.r=Math.max(.05,Math.hypot(q[0]-o.x,q[1]-o.y));
  else if(id==='a0'){let sw=mod(o.a1-th);if(sw<1e-6)sw=TAU;s.a0=o.a1-sw;s.a1=o.a1}
  else if(id==='a1'){let sw=mod(th-o.a0);if(sw<1e-6)sw=TAU;s.a1=o.a0+sw;s.a0=o.a0}
}

// ---- Stretch (شدّ): الرؤوس داخل إطار التقاطع تتحرك فقط، وما عداها يبقى ثابتًا ----
const stWinOf=(a,b)=>({x0:Math.min(a[0],b[0]),y0:Math.min(a[1],b[1]),x1:Math.max(a[0],b[0]),y1:Math.max(a[1],b[1])});
const stIn=(w,q)=>q[0]>=w.x0-1e-9&&q[0]<=w.x1+1e-9&&q[1]>=w.y0-1e-9&&q[1]<=w.y1+1e-9;
const ST_ANCHOR=['circle','arc','ellipse','text','north','door','door2','win'];
// هل في الشكل ما سيتحرك؟ (بلا نسخ ولا تعديل: يُستدعى مع كل حركة إصبع)
function stretchHits(s,w){
  const t=s.t;
  if(t==='line'||t==='wall')return stIn(w,s.a)||stIn(w,s.b);
  if(t==='dim')return stIn(w,s.a)&&stIn(w,s.b);
  if(t==='polyline'||t==='polygon'||t==='tri'||t==='free'){if(!Array.isArray(s.p))return false;for(let i=0;i<s.p.length;i++)if(stIn(w,s.p[i]))return true;return false}
  if(t==='rect')return rc(s).some(q=>stIn(w,q));
  if(t==='furn')return stIn(w,[s.x+s.w/2,s.y+s.h/2]);
  if(ST_ANCHOR.includes(t))return stIn(w,[s.x,s.y]);
  return false;
}
// يشدّ الشكل s في مكانه (قد يتحول مستطيل إلى مضلع) ويُرجع true إن تغيّر
function stretchShape(s,w,dx,dy){
  const t=s.t;
  if(!stretchHits(s,w))return false;
  if(t==='line'||t==='wall'){if(stIn(w,s.a))s.a=[s.a[0]+dx,s.a[1]+dy];if(stIn(w,s.b))s.b=[s.b[0]+dx,s.b[1]+dy];return true}
  if(t==='polyline'||t==='polygon'||t==='tri'||t==='free'){s.p=s.p.map(q=>stIn(w,q)?[q[0]+dx,q[1]+dy]:[q[0],q[1]]);return true}
  if(t==='rect'){
    const c=rc(s),f=c.map(q=>stIn(w,q));
    if(f.every(Boolean)){mv(s,Object.assign({},s),dx,dy);return true}
    const nc=c.map((q,i)=>f[i]?[q[0]+dx,q[1]+dy]:q);
    // هل بقيت أضلاعه موازية لمحوري المستطيل الأصلي (مع حفظ الدوران)؟ عندها يبقى مستطيلًا بأبعاد جديدة
    const rot=s.rot||0,co=Math.cos(-rot),si=Math.sin(-rot),cx=s.x+s.w/2,cy=s.y+s.h/2,e=1e-9;
    const L=nc.map(q=>{const X=q[0]-cx,Y=q[1]-cy;return[X*co-Y*si,X*si+Y*co]});
    const w2=Math.abs(L[1][0]-L[0][0]),h2=Math.abs(L[3][1]-L[0][1]);
    if(Math.abs(L[0][0]-L[3][0])<e&&Math.abs(L[1][0]-L[2][0])<e&&Math.abs(L[0][1]-L[1][1])<e&&Math.abs(L[3][1]-L[2][1])<e&&w2>1e-6&&h2>1e-6){
      const mx=(L[0][0]+L[1][0])/2,my=(L[0][1]+L[3][1])/2,cr=Math.cos(rot),sr=Math.sin(rot),X=cx+mx*cr-my*sr,Y=cy+mx*sr+my*cr;
      s.w=w2;s.h=h2;s.x=X-w2/2;s.y=Y-h2/2;return true;
    }
    // صار شكلًا حرًّا: يتحول إلى مضلع من أربعة رؤوس (كما في أوتوكاد حيث المستطيل متعدد خطوط)
    delete s.x;delete s.y;delete s.w;delete s.h;delete s.rot;s.t='polygon';s.p=nc.map(q=>[q[0],q[1]]);return true;
  }
  if(t==='dim'||t==='furn'||ST_ANCHOR.includes(t)){mv(s,copy(s),dx,dy);return true}
  return false;
}
// الأشكال الظاهرة والقابلة للتعديل التي فيها ما يقع داخل الإطار
function stretchAffected(w){
  const out=[],qb=[0,0,0,0];
  for(let i=0;i<shapes.length;i++){
    const s=shapes[i];if(!shown(s)||!ed(s))continue;
    const kb=cullBox(s,qb);if(kb&&(qb[2]<w.x0||qb[0]>w.x1||qb[3]<w.y0||qb[1]>w.y1))continue;   // رفض سريع بصندوق الحدود
    if(stretchHits(s,w))out.push(s);
  }
  return out;
}
function stretchApply(w,dx,dy){
  const aff=stretchAffected(w),openings=[];
  aff.forEach(s=>{const o=s.t==='door'||s.t==='door2'||s.t==='win';if(stretchShape(s,w,dx,dy)&&o)openings.push(s)});
  // الأبواب والنوافذ التي تحركت تلتصق بأقرب جدار بعد الشدّ (كما في النقل)
  openings.forEach(s=>{const q=wallAt([s.x,s.y],28/V.s);if(q){s.x=q.q[0];s.y=q.q[1];s.a=q.a;s.th=q.th}});
  return aff;
}
function stretchStart(){
  if(polyDraft)finishPolyline();
  closeDrawFlow();closeMoveFlow();cornerFirst=null;breakFirst=null;tool='select';setMoveMode(false);
  editAction='stretch';sel=[];
  moveFlow={mode:'stretch',stage:'window',items:[],base:null,at:null,n:0,ghost:null,bb:null,win:null,hits:0};
  toast('اسحب إطارًا حول الرؤوس التي تريد شدّها');
  moveFlowPanel();upd();draw();
}
function stretchWindowDrag(a,b){const F=moveFlow;if(!F||F.stage!=='window')return;F.win=stWinOf(a,b);F.hits=stretchAffected(F.win).length}
function stretchWindowDone(a,b,distPx){
  const F=moveFlow;if(!F||F.stage!=='window')return;
  if(distPx<FLOW_TAP_PX){F.win=null;toast('اسحب لرسم الإطار');draw();return}
  F.win=stWinOf(a,b);F.hits=stretchAffected(F.win).length;
  if(!F.hits){F.win=null;toast('لا يوجد في الإطار شيء يُشدّ؛ ارسم إطارًا آخر');draw();return}
  F.stage='base';toast('المس نقطة الأساس ثم نقطة الوصول');moveFlowPanel();draw();
}

// ---- Break (كسر): تقسيم خط أو جدار أو متعدد مفتوح عند نقطة، أو حذف ما بين نقطتين ----
// المسار: P = مصفوفة نقاط، وموضع النقطة عليه τ = رقم الضلع + الجزء الكسري منه (من 0 إلى عدد الأضلاع).
function pathNearest(P,q){
  let best=null;
  for(let i=0;i<P.length-1;i++){
    const a=P[i],b=P[i+1],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-18)continue;
    const t=clamp(((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2,0,1),pt=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(pt[0]-q[0],pt[1]-q[1]);
    if(!best||d<best.d)best={tau:i+t,pt,d};
  }
  return best;
}
function pathPoint(P,tau){const n=P.length-1,i=clamp(Math.floor(tau+1e-12),0,n-1),t=tau-i,a=P[i],b=P[i+1];return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}
function pathSlice(P,t0,t1){
  const out=[pathPoint(P,t0)],eps=1e-9;
  for(let j=Math.floor(t0+eps)+1;j<t1-eps;j++)out.push([P[j][0],P[j][1]]);
  out.push(pathPoint(P,t1));return out;
}
// القطع الباقية: من البداية إلى tA، ومن tB إلى النهاية (القطعة الأقصر من 1e-7 تُهمل)
function breakPieces(P,tA,tB){
  const n=P.length-1,eps=1e-7,out=[];
  if(tA>eps)out.push({r:[0,tA],pts:pathSlice(P,0,tA)});
  if(tB<n-eps)out.push({r:[tB,n],pts:pathSlice(P,tB,n)});
  return out;
}
// تنقل روابط الأبعاد من الشكل القديم إلى القطعة التي تحوي موضع الرابط؛ وما وقع في الجزء المحذوف يُفك
function relinkBreak(oldId,made){
  const eps=1e-7;
  shapes.forEach(d=>{
    if(d.t!=='dim')return;
    for(const key of['la','lb']){
      const L=d[key];if(!L||L.id!==oldId)continue;
      if(d.mode==='angular'){delete d[key];continue}
      const tau=L.t!==undefined?L.i+L.t:L.m?L.i+.5:L.i,pc=made.find(p=>tau>=p.r[0]-eps&&tau<=p.r[1]+eps);
      if(!pc){delete d[key];continue}
      const a=pc.r[0],b=pc.r[1],knots=[a];
      for(let j=Math.floor(a+eps)+1;j<b-eps;j++)knots.push(j);
      knots.push(b);
      let k=0;while(k<knots.length-2&&tau>knots[k+1]+eps)k++;
      const lt=k+(tau-knots[k])/(knots[k+1]-knots[k]),r=Math.round(lt),id=sid(pc.s);
      if(Math.abs(lt-r)<eps)d[key]={id,i:r,m:0};else{const i=Math.floor(lt);d[key]={id,i,m:0,t:lt-i}}
    }
  });
}
function applyBreak(i,tA,tB){
  const s=shapes[i];if(!s)return false;
  const line=s.t==='line'||s.t==='wall',P=line?[s.a,s.b]:s.p,pc=breakPieces(P,tA,tB);
  if(!pc.length){toast('الكسر يحذف الشكل كله؛ اختر نقطتين داخل الخط');return false}
  if(tA===tB&&pc.length<2){toast('نقطة الكسر على طرف الخط؛ اختر نقطة داخله');return false}
  snap();
  const oldId=s.id,made=pc.map((p,k)=>{
    const t=k===0?s:copy(s);
    if(line){t.a=p.pts[0].slice();t.b=p.pts[p.pts.length-1].slice()}else t.p=p.pts.map(q=>q.slice());
    return{r:p.r,s:t};
  }),extra=made.slice(1).map(m=>m.s);
  if(oldId)relinkBreak(oldId,made);
  shapes.splice(i+1,0,...extra);
  sel=[i].concat(extra.map((_,k)=>i+1+k));
  return true;
}
function breakStart(mode){
  if(polyDraft)finishPolyline();
  closeDrawFlow();closeMoveFlow();cornerFirst=null;breakFirst=null;
  tool='break';breakMode=mode;editAction=mode==='pt'?'brk1':'brk2';sel=[];setMoveMode(false);
  $('#sheet').classList.remove('on');
  toast(mode==='pt'?'المس الخط أو الجدار عند نقطة الكسر':'المس نقطة البداية ثم نقطة النهاية على الخط');
  upd();draw();
}
// لمسة بالأداة: الموضع يلتقط أولًا ثم يُسقط على أقرب نقطة من الشكل الملموس (فيُكسر الخط عند التقاطع أو النهاية القريبة بدقة)
function breakPick(p){
  const i=hit(p[0],p[1]),s=shapes[i];
  if(!s||!(s.t==='line'||s.t==='wall'||(s.t==='polyline'&&Array.isArray(s.p)&&s.p.length>=2))){toast('الكسر للخطوط والجدران والمتعددات المفتوحة');return}
  const loc=pathNearest(s.t==='polyline'?s.p:[s.a,s.b],snapPt(s2w(p[0],p[1])));if(!loc)return;
  if(breakMode==='pt'){if(applyBreak(i,loc.tau,loc.tau))toast('تم الكسر');return}
  if(!breakFirst||breakFirst.s!==s){breakFirst={s,tau:loc.tau};sel=[i];toast('المس النقطة الثانية على الشكل نفسه');return}
  const a=Math.min(breakFirst.tau,loc.tau),b=Math.max(breakFirst.tau,loc.tau);
  if(b-a<1e-6){toast('النقطتان متطابقتان؛ اختر نقطة أخرى');return}
  if(applyBreak(i,a,b)){breakFirst=null;toast('تم حذف الجزء بين النقطتين')}
}
