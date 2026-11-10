/* ==================================================================
 * 10-dimensions.js
 * خطوط الأبعاد: حساب النقاط والرسم، والربط مع الأشكال (la / lb) وتحديثه عند
 * التعديل.
 *
 * يعرّف: dimPts، drawDim، sid، linkDim، syncDims، fixLinks
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            09-render.js
 * ================================================================== */

// خط الأبعاد: a,b نقطتا القياس، off إزاحة الخط بالمتر (الإشارة تحدد الجهة)
// نقاط خط القياس بحسب نوع البعد.
function dimPts(s){
  const mode=s.mode||'linear',L=len(s)||1;
  if(mode==='horizontal')return[[s.a[0],s.a[1]+s.off],[s.b[0],s.a[1]+s.off]];
  if(mode==='vertical')return[[s.a[0]+s.off,s.a[1]],[s.a[0]+s.off,s.b[1]]];
  const nx=-(s.b[1]-s.a[1])/L*s.off,ny=(s.b[0]-s.a[0])/L*s.off;
  return[[s.a[0]+nx,s.a[1]+ny],[s.b[0]+nx,s.b[1]+ny]];
}

function drawDim(s,on,prev,c){
  const mode=s.mode||'linear',col=s.col||layerOf(s).col||'#0d9488';
  ctx.save();ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=s.lw?Math.max(1,s.lw*.75):1.5;ctx.lineCap='butt';ctx.setLineDash(prev?[6,4]:[]);
  if(mode==='angular'){
    const C=w2s(...s.c),A=w2s(...s.a),B=w2s(...s.b),a0=Math.atan2(A[1]-C[1],A[0]-C[0]),a1=Math.atan2(B[1]-C[1],B[0]-C[0]);
    let delta=a1-a0;while(delta<=-Math.PI)delta+=Math.PI*2;while(delta>Math.PI)delta-=Math.PI*2;
    const r=Math.max(.25,Math.abs(s.off||.6))*V.s,mid=a0+delta/2;
    if(on){ctx.globalAlpha=.2;ctx.lineWidth+=8;ctx.beginPath();ctx.arc(C[0],C[1],r,a0,a0+delta,delta<0);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=s.lw||1.5}
    ctx.beginPath();ctx.moveTo(C[0],C[1]);ctx.lineTo(A[0],A[1]);ctx.moveTo(C[0],C[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();
    ctx.beginPath();ctx.arc(C[0],C[1],r,a0,a0+delta,delta<0);ctx.stroke();
    const x=C[0]+Math.cos(mid)*r,y=C[1]+Math.sin(mid)*r,txt=`${Math.abs(deg(delta)).toFixed(1).replace(/\\.0$/,'')}°`;
    ctx.font=`600 12px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(txt).width+10;ctx.globalAlpha=.9;ctx.fillStyle=c.bg;ctx.fillRect(x-tw/2,y-9,tw,18);ctx.globalAlpha=1;ctx.fillStyle=col;ctx.fillText(txt,x,y);
  }else if(mode==='radius'||mode==='diameter'){
    const A=w2s(...s.a),B=w2s(...s.b),M=mode==='diameter'?[(A[0]+B[0])/2,(A[1]+B[1])/2]:[(A[0]+B[0])/2,(A[1]+B[1])/2];
    if(on){ctx.globalAlpha=.2;ctx.lineWidth+=8;ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=s.lw||1.5}
    ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.stroke();
    const value=len(s),txt=`${mode==='diameter'?'Ø':'R'} ${fl(value)}`;
    ctx.font=`600 12px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(txt).width+10;ctx.globalAlpha=.9;ctx.fillStyle=c.bg;ctx.fillRect(M[0]-tw/2,M[1]-9,tw,18);ctx.globalAlpha=1;ctx.fillStyle=col;ctx.fillText(txt,M[0],M[1]);
  }else{
    const L=len(s);if(L<1e-6){ctx.restore();return}
    const d=dimPts(s),A=w2s(...s.a),B=w2s(...s.b),p=w2s(...d[0]),q=w2s(...d[1]),el=Math.hypot(q[0]-p[0],q[1]-p[1])||1,e=[(q[0]-p[0])/el,(q[1]-p[1])/el];
    let n=[p[0]-A[0],p[1]-A[1]];const nl=Math.hypot(n[0],n[1]);n=nl>1?[n[0]/nl,n[1]/nl]:[-e[1],e[0]];
    const T=(o,u,k)=>[o[0]+u[0]*k,o[1]+u[1]*k],M=(a,b)=>{ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1])},tt=(()=>{const x=e[0]+n[0],y=e[1]+n[1],l=Math.hypot(x,y)||1;return[x/l,y/l]})();
    if(on){ctx.beginPath();M(p,q);ctx.globalAlpha=.25;ctx.lineWidth+=8;ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=s.lw||1.5}
    ctx.beginPath();M(T(A,n,Math.min(4,nl)),T(p,n,8));M(T(B,n,Math.min(4,nl)),T(q,n,8));M(T(p,e,-6),T(q,e,6));M(T(p,tt,-5),T(p,tt,5));M(T(q,tt,-5),T(q,tt,5));ctx.stroke();
    let value=mode==='horizontal'?Math.abs(s.b[0]-s.a[0]):mode==='vertical'?Math.abs(s.b[1]-s.a[1]):L;
    let ang=Math.atan2(e[1],e[0]);if(ang>Math.PI/2||ang<-Math.PI/2)ang+=Math.PI;
    ctx.save();ctx.translate((p[0]+q[0])/2,(p[1]+q[1])/2);ctx.rotate(ang);ctx.font=`600 12px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
    const txt=fl(value),tw=ctx.measureText(txt).width+10;ctx.globalAlpha=.9;ctx.fillStyle=c.bg;ctx.fillRect(-tw/2,-9,tw,18);ctx.globalAlpha=1;ctx.fillStyle=col;ctx.fillText(txt,0,0);ctx.restore();
    if(prev){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];let an=Math.atan2(-dy,dx)*180/Math.PI;if(an<0)an+=360;tag(`${Math.round(an)}° · Δx ${fu(Math.abs(dx))} · Δy ${fu(Math.abs(dy))}`,B[0],B[1]+26,c)}
  }
  ctx.restore();
}
let dimMode='linear',dimDraft=[];
function nearestDimSegment(p){
  let best=null,limit=24/Math.max(V.s,1e-9);
  shapes.forEach(s=>{if(!shown(s)||s.t==='dim')return;segs(s).forEach((edge,i)=>{
    const [a,b]=edge,dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-12)return;
    const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,0,1),q=[a[0]+dx*t,a[1]+dy*t],d=Math.hypot(q[0]-p[0],q[1]-p[1]);
    if(d<limit){limit=d;best={s,i,a:a.slice(),b:b.slice(),p:q,t}}
  })});
  return best;
}
function dimensionPick(p){
  const q=snapPt(s2w(...p));
  if(dimMode==='angular'){
    dimDraft.push(q);
    if(dimDraft.length===1)toast('حدّد نقطة على الضلع الأول قرب رأس الزاوية');
    else if(dimDraft.length===2)toast('حدّد نقطة على الضلع الثاني');
    else{
      const [centerPick,firstPick,secondPick]=dimDraft;dimDraft=[];
      const e1=nearestDimSegment(firstPick),e2=nearestDimSegment(secondPick);
      if(!e1||!e2||(e1.s===e2.s&&e1.i===e2.i)){toast('يجب اختيار ضلعين حقيقيين مختلفين يلتقيان عند رأس الزاوية');return true}
      const intersections=xSS([e1.a,e1.b],[e2.a,e2.b]);
      const c=intersections.sort((a,b)=>Math.hypot(a[0]-centerPick[0],a[1]-centerPick[1])-Math.hypot(b[0]-centerPick[0],b[1]-centerPick[1]))[0];
      if(!c||Math.hypot((c[0]-centerPick[0])*V.s,(c[1]-centerPick[1])*V.s)>24){toast('النقطة الأولى يجب أن تكون عند تقاطع الضلعين الحقيقيين');return true}
      const a=e1.p,b=e2.p,la=Math.hypot(a[0]-c[0],a[1]-c[1]),lb=Math.hypot(b[0]-c[0],b[1]-c[1]);
      if(la<.1||lb<.1||Math.abs((a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0]))<1e-7){toast('اختر نقطتين متباعدتين على ضلعي الزاوية');return true}
      const s={t:'dim',mode:'angular',c,a,b,off:.6,la:{s:e1.s,i:e1.i,t:e1.t},lb:{s:e2.s,i:e2.i,t:e2.t},ly:cl,col:D.col||undefined,lw:D.lw};
      if(valid(s)){linkDim(s);snap();shapes.push(s);sel=[shapes.length-1];save();upd();draw()}else toast('تعذّر إنشاء بُعد الزاوية؛ أعد التحديد');
    }
    return true;
  }
  if(dimMode==='radius'||dimMode==='diameter'){
    const i=hit(p[0],p[1]),o=shapes[i];
    if(!o||o.t!=='circle'){toast('المس دائرة لإضافة بُعد نصف القطر أو القطر');return true}
    const r=o.r,cx=o.x,cy=o.y,angle=dimMode==='radius'?-Math.PI/4:0,ux=Math.cos(angle),uy=Math.sin(angle);
    const s=dimMode==='radius'?{t:'dim',mode:'radius',a:[cx,cy],b:[cx+r*ux,cy+r*uy],angle,circleId:sid(o)}:{t:'dim',mode:'diameter',a:[cx-r*ux,cy-r*uy],b:[cx+r*ux,cy+r*uy],angle,circleId:sid(o)};
    Object.assign(s,{ly:cl,col:D.col||undefined,lw:D.lw});
    snap();shapes.push(s);sel=[shapes.length-1];save();upd();draw();return true;
  }
  return false;
}
// أبعاد مرتبطة: البُعد يحمل la/lb = {id,i,m} (شكل معرّف بـ id، رقم الرأس أو الضلع، m=1 لمنتصف الضلع) ويتحدّث مع كل رسم
function sid(s){return s.id||(s.id=uid())}

function linkDim(d){for(const k of['la','lb']){const r=d[k];if(r&&r.s)d[k]={id:sid(r.s),i:r.i,m:r.m||0,...(r.t!==undefined?{t:r.t}:{})};else delete d[k]}}

function syncDims(){
  const ds=shapes.filter(s=>s.t==='dim'&&(s.la||s.lb||s.circleId));if(!ds.length)return;
  const by=new Map();shapes.forEach(s=>{if(s.id)by.set(s.id,s)});
  const pt=L=>{const s=by.get(L.id);if(!s)return null;const P=pts(s);if(L.t!==undefined){const A=P[L.i],B=P[L.i+1];return A&&B?[A[0]+(B[0]-A[0])*L.t,A[1]+(B[1]-A[1])*L.t]:null}if(L.m){const A=P[L.i],B=P[(L.i+1)%P.length];return A&&B?[(A[0]+B[0])/2,(A[1]+B[1])/2]:null}return P[L.i]||null};
  ds.forEach(d=>{
    if(d.circleId){const o=by.get(d.circleId);if(o&&o.t==='circle'){const a=d.angle||0,ux=Math.cos(a),uy=Math.sin(a);if(d.mode==='radius'){d.a=[o.x,o.y];d.b=[o.x+o.r*ux,o.y+o.r*uy]}else if(d.mode==='diameter'){d.a=[o.x-o.r*ux,o.y-o.r*uy];d.b=[o.x+o.r*ux,o.y+o.r*uy]}}}
    if(d.la){const p=pt(d.la);if(p)d.a=p.slice()}if(d.lb){const p=pt(d.lb);if(p)d.b=p.slice()}
  });
}

function fixLinks(src,out){
  const map=new Map();
  src.forEach((s,i)=>{if(s.id){out[i].id=uid();map.set(s.id,out[i].id)}});
  out.forEach(d=>{if(d.t==='dim'){for(const k of['la','lb']){if(d[k]){if(map.has(d[k].id))d[k]={...d[k],id:map.get(d[k].id)};else delete d[k]}}if(d.circleId){if(map.has(d.circleId))d.circleId=map.get(d.circleId);else delete d.circleId}}});
}
