/* ==================================================================
 * 03-snap.js
 * الالتقاط (OSNAP): نهاية/منتصف/تقاطع/مركز، عمودي (Perpendicular) وأقرب نقطة (Nearest)،
 * وقيود الاتجاه (Ortho / Polar).
 *
 * يعرّف: xSS، xSC، xCC، snapAnchor، osnap، snapPt، constrain
 * يعتمد على: 01-core.js، 02-geometry.js، 06-layers.js
 * ================================================================== */

// ---- الالتقاط (OSNAP) ----
// مرجع الموازاة مؤقت أثناء جلسة الرسم ولا يُخزَّن ضمن بيانات المشروع.
let parallelRef=null,parallelGuide=null;

function pickParallelReference(p){
  let best=null,bd=20;
  for(const s of shapes){
    if(!shown(s)||['text','north','circle'].includes(s.t))continue;
    for(const e of segs(s)){
      const [a,b]=e,dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
      if(l2<1e-12)continue;
      const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,0,1);
      const q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot((q[0]-p[0])*V.s,(q[1]-p[1])*V.s);
      if(d<bd){bd=d;best={a:a.slice(),b:b.slice()}}
    }
  }
  return best;
}

function referenceWithinTolerance(a,b){
  if(!parallelRef)return false;
  const rx=parallelRef.b[0]-parallelRef.a[0],ry=parallelRef.b[1]-parallelRef.a[1];
  const dx=b[0]-a[0],dy=b[1]-a[1];
  if(Math.hypot(dx,dy)<1e-9||Math.hypot(rx,ry)<1e-9)return false;
  const cross=Math.abs(dx*ry-dy*rx),dot=Math.abs(dx*rx+dy*ry);
  // الموازاة: زاوية 0°، والتعامد مع المرجع: زاوية 90°، بهامش 10 درجات.
  const error=S.perpendicular?Math.atan2(dot,cross):Math.atan2(cross,dot);
  return error<=Math.PI/18;
}

function referencePoint(a,b){
  if(!parallelRef||!referenceWithinTolerance(a,b))return b;
  const dx=parallelRef.b[0]-parallelRef.a[0],dy=parallelRef.b[1]-parallelRef.a[1],L=Math.hypot(dx,dy);
  if(L<1e-9)return b;
  // اتجاه القيد: اتجاه المرجع للموازاة، والاتجاه العمودي عليه للتعامد.
  const ux=S.perpendicular?-dy/L:dx/L,uy=S.perpendicular?dx/L:dy/L;
  const t=(b[0]-a[0])*ux+(b[1]-a[1])*uy;
  return [a[0]+ux*t,a[1]+uy*t];
}
function xSS(a,b){const[p,q]=a,[r,t]=b,d=(q[0]-p[0])*(t[1]-r[1])-(q[1]-p[1])*(t[0]-r[0]);if(Math.abs(d)<1e-9)return[];
  const u=((r[0]-p[0])*(t[1]-r[1])-(r[1]-p[1])*(t[0]-r[0]))/d,v=((r[0]-p[0])*(q[1]-p[1])-(r[1]-p[1])*(q[0]-p[0]))/d;
  return u>=0&&u<=1&&v>=0&&v<=1?[[p[0]+u*(q[0]-p[0]),p[1]+u*(q[1]-p[1])]]:[]}

function xSC(a,c){const[p,q]=a,dx=q[0]-p[0],dy=q[1]-p[1],fx=p[0]-c.x,fy=p[1]-c.y,A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-c.r*c.r,D2=B*B-4*A*C;
  if(A<1e-12||D2<0)return[];const r=Math.sqrt(D2);return[(-B-r)/(2*A),(-B+r)/(2*A)].filter(t=>t>=0&&t<=1).map(t=>[p[0]+t*dx,p[1]+t*dy])}

function xCC(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<1e-9||d>a.r+b.r||d<Math.abs(a.r-b.r))return[];
  const l=(a.r*a.r-b.r*b.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.r*a.r-l*l)),mx=a.x+l*dx/d,my=a.y+l*dy/d;return[[mx-h*dy/d,my+h*dx/d],[mx+h*dy/d,my-h*dx/d]]}

// نقطة ارتكاز الالتقاط العمودي: آخر نقطة ثُبّتت في الأداة الجارية (بداية الخط أو آخر رأس أو الأساس في النقل/الشدّ)،
// أو الرأس المجاور عند سحب مقبض خط أو متعدد. بلا ارتكاز لا يُعرض التقاط «عمودي».
function snapAnchor(){
  if(g&&g.k==='draw'&&g.a&&tool!=='free')return g.a;
  if(g&&g.k==='grip'&&g.o){
    const o=g.o,id=g.gr&&g.gr.id;
    if((o.t==='line'||o.t==='wall')&&(id==='a'||id==='b'))return o[id==='a'?'b':'a'];
    if((o.t==='polyline'||o.t==='polygon')&&Array.isArray(o.p)&&o.p.length>1&&typeof id==='number'){const n=o.p.length;return o.p[id>0?id-1:(o.t==='polygon'?n-1:1)]}
  }
  if(drawFlow&&['second','next'].includes(drawFlow.stage)){const a=drawFlow.tool==='polyline'?drawFlow.points[drawFlow.points.length-1]:drawFlow.points[0];if(a)return a}
  if(polyDraft&&polyDraft.p.length)return polyDraft.p[polyDraft.p.length-1];
  if(moveFlow&&moveFlow.stage==='dest'&&moveFlow.base)return moveFlow.base;
  return null;
}

function osnap(p){
  // لا التقاط بالنقاط مفعّل: لا داعي لمسح الأشكال (الشبكة تُطبَّق في snapPt)
  if(!(S.end||S.mid||S.int||S.cen||S.per||S.nea))return null;
  const L=[],add=(q,k,r,ref)=>{if(S[k==='qua'?'cen':k])L.push({p:q,k,r,ref})};
  // نتحقق فقط من الأشكال القريبة من الإصبع: التقاطع قرب النقطة يستلزم أن يمر الشكلان بجوارها.
  // صندوق الحدود السريع (cullBox) لا يُنشئ مصفوفات، فالمسح يبقى خفيفًا مع عشرات الآلاف من الأشكال.
  const tol=22/V.s+1e-9,near=[],bb=[],o=[0,0,0,0];
  for(let i=0;i<shapes.length;i++){
    const s=shapes[i];if(!shown(s))continue;
    let x0,y0,x1,y1;
    if(cullBox(s,o)){x0=o[0];y0=o[1];x1=o[2];y1=o[3]}else{const b=bx(s);x0=b.x;y0=b.y;x1=b.X;y1=b.Y}
    if(p[0]>=x0-tol&&p[0]<=x1+tol&&p[1]>=y0-tol&&p[1]<=y1+tol){near.push(s);bb.push([x0,y0,x1,y1])}
  }
  for(const s of near){if(s.t==='text'||s.t==='north'){add([s.x,s.y],'cen',3);continue}
    if(s.t==='circle'){add([s.x,s.y],'cen',3);[[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>add([s.x+d[0]*s.r,s.y+d[1]*s.r],'qua',3))}
    else if(s.t==='free'){add(s.p[0],'end',1);add(s.p[s.p.length-1],'end',1)}
    else{pts(s).forEach((q,i)=>add(q,'end',1,s.t==='dim'?undefined:{s,i}));segs(s).forEach((e,j)=>add([(e[0][0]+e[1][0])/2,(e[0][1]+e[1][1])/2],'mid',2,{s,i:j,m:1}));if(s.t==='rect')add([s.x+s.w/2,s.y+s.h/2],'cen',3)}
  }
  // عمودي: قدم العمود من نقطة الارتكاز على كل ضلع (ضمن الضلع) وعلى الدوائر؛ أقرب نقطة: أقرب نقطة على الشكل من المؤشر.
  // لا نضيف إلا ما يقع ضمن مدى اللمس (22 بكسل)، وأقرب نقطة تُحسب مرة واحدة لأقرب ضلع فلا تتضخم القائمة مع المتعددات الطويلة.
  if(S.per||S.nea){
    const A=S.per?snapAnchor():null,pxr=q=>Math.hypot((q[0]-p[0])*V.s,(q[1]-p[1])*V.s)<=22;let nb=null,nd=Infinity;
    const perAdd=q=>{if(A&&Math.hypot(q[0]-A[0],q[1]-A[1])<1e-9)return;if(pxr(q))add(q,'per',1)};
    const neaTry=q=>{const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<nd){nd=d;nb=q}};
    for(const s of near){
      if(s.t==='text'||s.t==='north')continue;
      if(s.t==='circle'){
        if(A){const dx=A[0]-s.x,dy=A[1]-s.y,d=Math.hypot(dx,dy);if(d>1e-9){const ux=dx/d,uy=dy/d;perAdd([s.x+ux*s.r,s.y+uy*s.r]);perAdd([s.x-ux*s.r,s.y-uy*s.r])}}
        if(S.nea){const dx=p[0]-s.x,dy=p[1]-s.y,d=Math.hypot(dx,dy);if(d>1e-9)neaTry([s.x+dx/d*s.r,s.y+dy/d*s.r])}
        continue;
      }
      for(const e of segs(s)){
        const a=e[0],b=e[1],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-18)continue;
        if(A){const t=((A[0]-a[0])*dx+(A[1]-a[1])*dy)/l2;if(t>=0&&t<=1)perAdd([a[0]+t*dx,a[1]+t*dy])}
        if(S.nea){const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,0,1);neaTry([a[0]+t*dx,a[1]+t*dy])}
      }
    }
    // وزن «أقرب نقطة» كبير (12) كي لا تتقدّم أبدًا على نقطة التقاط حقيقية في مدى اللمس
    if(nb&&pxr(nb))add(nb,'nea',12);
  }
  if(S.int){
    // التقاطعات بين أقرب 40 شكلًا فقط (في المخططات الكثيفة يتضخم k²)، مع رفض سريع بصناديق الحدود
    let idx=near.map((_,i)=>i);
    if(idx.length>40){
      const d=idx.map(i=>{const b=bb[i],dx=Math.max(b[0]-p[0],0,p[0]-b[2]),dy=Math.max(b[1]-p[1],0,p[1]-b[3]);return dx*dx+dy*dy});
      idx.sort((a,c)=>d[a]-d[c]);idx=idx.slice(0,40);
    }
    const sgc=new Map(),sg=i=>{let v=sgc.get(i);if(!v){v=segs(near[i]);sgc.set(i,v)}return v};
    for(let u=0;u<idx.length;u++)for(let w=u+1;w<idx.length;w++){
      const ia=idx[u],ib=idx[w],A=near[ia],B=near[ib],a0=bb[ia],b0=bb[ib];
      if(a0[0]>b0[2]+tol||b0[0]>a0[2]+tol||a0[1]>b0[3]+tol||b0[1]>a0[3]+tol)continue;
      const SA=sg(ia),SB=sg(ib);
      for(const a of SA){for(const b of SB)xSS(a,b).forEach(q=>add(q,'int',0));if(B.t==='circle')xSC(a,B).forEach(q=>add(q,'int',0))}
      if(A.t==='circle'){for(const b of SB)xSC(b,A).forEach(q=>add(q,'int',0));if(B.t==='circle')xCC(A,B).forEach(q=>add(q,'int',0))}
    }
  }
  let best=null,bs=1e9;
  for(const c of L){const d=Math.hypot((c.p[0]-p[0])*V.s,(c.p[1]-p[1])*V.s);if(d<=22&&d+c.r*3<bs){bs=d+c.r*3;best=c}}
  return best;
}

function snapPt(p){const o=osnap(p);mk=o;return o?o.p.slice():S.grid?[grid(p[0]),grid(p[1])]:p}
// القيود: أفقي/رأسي (Ortho) أو زاوية كل 15° (Polar)، والالتقاط بالنقاط يتقدم عليهما
function constrain(a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  // عند تفعيل الموازاة واختيار مرجع، تتقدم على التعامد لأن القيدين متعارضان هندسيًا.
  if((S.parallel||S.perpendicular)&&parallelRef&&referenceWithinTolerance(a,b))return referencePoint(a,b);
  if(S.ortho)return Math.abs(dx)>=Math.abs(dy)?[b[0],a[1]]:[a[0],b[1]];
  if(S.polar){const L=Math.hypot(dx,dy),st=Math.PI/4,t=Math.round(Math.atan2(dy,dx)/st)*st,l=S.grid?Math.round(L/step())*step():L;return[a[0]+l*Math.cos(t),a[1]+l*Math.sin(t)]}
  return b;
}
