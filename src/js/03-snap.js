/* ==================================================================
 * 03-snap.js
 * الالتقاط (OSNAP): تقاطعات القطع والدوائر، أقرب نقطة التقاط، وقيود الاتجاه (Ortho
 * / Polar).
 *
 * يعرّف: xSS، xSC، xCC، osnap، snapPt، constrain
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

function parallelPoint(a,b){
  if(!parallelRef)return b;
  const dx=parallelRef.b[0]-parallelRef.a[0],dy=parallelRef.b[1]-parallelRef.a[1],L=Math.hypot(dx,dy);
  if(L<1e-9)return b;
  const ux=dx/L,uy=dy/L,t=(b[0]-a[0])*ux+(b[1]-a[1])*uy;
  return [a[0]+ux*t,a[1]+uy*t];
}
function xSS(a,b){const[p,q]=a,[r,t]=b,d=(q[0]-p[0])*(t[1]-r[1])-(q[1]-p[1])*(t[0]-r[0]);if(Math.abs(d)<1e-9)return[];
  const u=((r[0]-p[0])*(t[1]-r[1])-(r[1]-p[1])*(t[0]-r[0]))/d,v=((r[0]-p[0])*(q[1]-p[1])-(r[1]-p[1])*(q[0]-p[0]))/d;
  return u>=0&&u<=1&&v>=0&&v<=1?[[p[0]+u*(q[0]-p[0]),p[1]+u*(q[1]-p[1])]]:[]}

function xSC(a,c){const[p,q]=a,dx=q[0]-p[0],dy=q[1]-p[1],fx=p[0]-c.x,fy=p[1]-c.y,A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-c.r*c.r,D2=B*B-4*A*C;
  if(A<1e-12||D2<0)return[];const r=Math.sqrt(D2);return[(-B-r)/(2*A),(-B+r)/(2*A)].filter(t=>t>=0&&t<=1).map(t=>[p[0]+t*dx,p[1]+t*dy])}

function xCC(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<1e-9||d>a.r+b.r||d<Math.abs(a.r-b.r))return[];
  const l=(a.r*a.r-b.r*b.r+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.r*a.r-l*l)),mx=a.x+l*dx/d,my=a.y+l*dy/d;return[[mx-h*dy/d,my+h*dx/d],[mx+h*dy/d,my-h*dx/d]]}

function osnap(p){
  const L=[],add=(q,k,r,ref)=>{if(S[k==='qua'?'cen':k])L.push({p:q,k,r,ref})};
  // نتحقق فقط من الأشكال القريبة من الإصبع: التقاطع قرب النقطة يستلزم أن يمر الشكلان بجوارها
  const tol=22/V.s+1e-9,near=shapes.filter(s=>{if(!shown(s))return false;const b=bx(s);return p[0]>=b.x-tol&&p[0]<=b.X+tol&&p[1]>=b.y-tol&&p[1]<=b.Y+tol});
  for(const s of near){if(s.t==='text'||s.t==='north'){add([s.x,s.y],'cen',3);continue}
    if(s.t==='circle'){add([s.x,s.y],'cen',3);[[1,0],[-1,0],[0,1],[0,-1]].forEach(d=>add([s.x+d[0]*s.r,s.y+d[1]*s.r],'qua',3))}
    else if(s.t==='free'){add(s.p[0],'end',1);add(s.p[s.p.length-1],'end',1)}
    else{pts(s).forEach((q,i)=>add(q,'end',1,s.t==='dim'?undefined:{s,i}));segs(s).forEach((e,j)=>add([(e[0][0]+e[1][0])/2,(e[0][1]+e[1][1])/2],'mid',2,{s,i:j,m:1}));if(s.t==='rect')add([s.x+s.w/2,s.y+s.h/2],'cen',3)}
  }
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++){
    const A=near[i],B=near[j];
    for(const a of segs(A)){for(const b of segs(B))xSS(a,b).forEach(q=>add(q,'int',0));if(B.t==='circle')xSC(a,B).forEach(q=>add(q,'int',0))}
    if(A.t==='circle'){for(const b of segs(B))xSC(b,A).forEach(q=>add(q,'int',0));if(B.t==='circle')xCC(A,B).forEach(q=>add(q,'int',0))}
  }
  let best=null,bs=1e9;
  for(const c of L){const d=Math.hypot((c.p[0]-p[0])*V.s,(c.p[1]-p[1])*V.s);if(d<=22&&d+c.r*3<bs){bs=d+c.r*3;best=c}}
  return best;
}

function snapPt(p){const o=osnap(p);mk=o;return o?o.p.slice():S.grid?[grid(p[0]),grid(p[1])]:p}
// القيود: أفقي/رأسي (Ortho) أو زاوية كل 15° (Polar)، والالتقاط بالنقاط يتقدم عليهما
function constrain(a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  if(S.ortho)return Math.abs(dx)>=Math.abs(dy)?[b[0],a[1]]:[a[0],b[1]];
  if(S.parallel&&parallelRef)return parallelPoint(a,b);
  if(S.polar){const L=Math.hypot(dx,dy),st=Math.PI/4,t=Math.round(Math.atan2(dy,dx)/st)*st,l=S.grid?Math.round(L/step())*step():L;return[a[0]+l*Math.cos(t),a[1]+l*Math.sin(t)]}
  return b;
}
