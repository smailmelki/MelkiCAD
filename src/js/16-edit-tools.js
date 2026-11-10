/* ==================================================================
 * 16-edit-tools.js
 * أدوات التعديل المتقدمة: إزاحة، انعكاس، نسخ متكرر، قص، تمديد.
 *
 * يعرّف: opSheet، offS، mirS، mirrorSel، opAction، trimAt، extendAt
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
  else if(s.t==='door'||s.t==='win'){const m=mp([s.x,s.y]);t.x=m[0];t.y=m[1];t.a=ax==='v'?Math.PI-s.a:-s.a;if(s.t==='door')t.f=-s.f}
  else if(s.t==='arc'){const m=mp([s.x,s.y]);t.x=m[0];t.y=m[1];const fn=a=>ax==='v'?Math.PI-a:-a;t.a0=fn(s.a1);t.a1=fn(s.a0);while(t.a1<=t.a0)t.a1+=Math.PI*2}
  else{const m=mp([s.x,s.y]);t.x=m[0];t.y=m[1]}
  return t;
}

function mirrorSel(m){
  const R=sel.map(i=>bx(shapes[i])),x0=Math.min(...R.map(q=>q.x)),x1=Math.max(...R.map(q=>q.X)),y0=Math.min(...R.map(q=>q.y)),y1=Math.max(...R.map(q=>q.Y));
  const ax=m==='r'?['v',x1]:m==='l'?['v',x0]:m==='b'?['h',y1]:m==='t'?['h',y0]:m==='fv'?['v',(x0+x1)/2]:['h',(y0+y1)/2];
  snap();const out=sel.map(i=>mirS(shapes[i],ax[0],ax[1]));out.forEach(d=>{if(d.t==='dim'){delete d.la;delete d.lb}});
  if(m==='fv'||m==='fh')sel.forEach((i,k)=>{shapes[i]=out[k]});
  else{shapes.push(...out);sel=out.map((_,k)=>shapes.length-out.length+k)}
}

function opAction(a){
  $$('.gm').forEach(m=>m.classList.remove('on'));
  if(!sel.length){tool='select';editAction=null;upd();toast('حدّد أشكالًا أولًا ثم اختر الأداة');return}
  editAction=a;upd();
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
  }else if(a==='array'){
    const R=sel.map(i=>bx(shapes[i])),w=Math.max(...R.map(q=>q.X))-Math.min(...R.map(q=>q.x)),h=Math.max(...R.map(q=>q.Y))-Math.min(...R.map(q=>q.y));
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

