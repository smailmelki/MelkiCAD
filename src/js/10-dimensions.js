/* ==================================================================
 * 10-dimensions.js
 * خطوط الأبعاد: حساب النقاط والرسم، والربط مع الأشكال (la / lb) وتحديثه عند
 * التعديل.
 *
 * يعرّف: dimPts، drawDim، sid، linkDim، syncDims، fixLinks
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            09-render.js
 * ================================================================== */

// نمط البعد النشط، يُختار من مجموعة «الأبعاد» قبل بدء الرسم.
let activeDimMode='aligned';

// خط الأبعاد: a,b نقطتا القياس، off إزاحة الخط بالمتر (الإشارة تحدد الجهة)
function dimValue(s){return s.mode==='horizontal'?Math.abs(s.b[0]-s.a[0]):s.mode==='vertical'?Math.abs(s.b[1]-s.a[1]):len(s)}
function dimText(s){const p=clamp(Math.round(Number(s.prec??2)),0,4),v=dimValue(s)*uk();return `${v.toFixed(p)} ${ul()}`}
function dimPts(s){
  if(s.mode==='horizontal'){const y=(s.a[1]+s.b[1])/2+s.off;return[[s.a[0],y],[s.b[0],y]]}
  if(s.mode==='vertical'){const x=(s.a[0]+s.b[0])/2+s.off;return[[x,s.a[1]],[x,s.b[1]]]}
  const L=len(s)||1,nx=-(s.b[1]-s.a[1])/L*s.off,ny=(s.b[0]-s.a[0])/L*s.off;
  return[[s.a[0]+nx,s.a[1]+ny],[s.b[0]+nx,s.b[1]+ny]]
}

function drawDim(s,on,prev,c){
  const L=dimValue(s);if(L<1e-6)return;
  const d=dimPts(s),A=w2s(...s.a),B=w2s(...s.b),p=w2s(...d[0]),q=w2s(...d[1]),col=s.col||layerOf(s).col||'#0d9488',lw=s.lw?Math.max(1,s.lw*.75):1.5;
  const el=Math.hypot(q[0]-p[0],q[1]-p[1])||1,e=[(q[0]-p[0])/el,(q[1]-p[1])/el];
  let n=[p[0]-A[0],p[1]-A[1]];const nl=Math.hypot(n[0],n[1]);n=nl>1?[n[0]/nl,n[1]/nl]:[-e[1],e[0]];
  const T=(o,u,k)=>[o[0]+u[0]*k,o[1]+u[1]*k],M=(a,b)=>{ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1])},tt=(()=>{const x=e[0]+n[0],y=e[1]+n[1],l=Math.hypot(x,y)||1;return[x/l,y/l]})();
  ctx.lineCap='butt';ctx.setLineDash(prev?[6,4]:[]);
  if(on){ctx.beginPath();M(p,q);ctx.strokeStyle=c.ac;ctx.globalAlpha=.3;ctx.lineWidth=lw+10;ctx.stroke();ctx.globalAlpha=1}
  ctx.beginPath();M(T(A,n,Math.min(4,nl)),T(p,n,8));M(T(B,n,Math.min(4,nl)),T(q,n,8));M(T(p,e,-6),T(q,e,6));M(T(p,tt,-5),T(p,tt,5));M(T(q,tt,-5),T(q,tt,5));
  ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=col;if(s.la){ctx.beginPath();ctx.arc(A[0],A[1],3,0,7);ctx.fill()}if(s.lb){ctx.beginPath();ctx.arc(B[0],B[1],3,0,7);ctx.fill()}
  let ang=Math.atan2(e[1],e[0]);if(ang>Math.PI/2||ang<-Math.PI/2)ang+=Math.PI;
  ctx.save();ctx.translate((p[0]+q[0])/2,(p[1]+q[1])/2);ctx.rotate(ang);ctx.font=`600 12px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
  const txt=dimText(s),tw=ctx.measureText(txt).width+10;ctx.globalAlpha=.9;ctx.fillStyle=c.bg;ctx.fillRect(-tw/2,-9,tw,18);ctx.globalAlpha=1;ctx.fillStyle=col;ctx.fillText(txt,0,0);ctx.restore();
  if(prev){const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];let an=Math.atan2(-dy,dx)*180/Math.PI;if(an<0)an+=360;tag(`${Math.round(an)}° · Δx ${fu(Math.abs(dx))} · Δy ${fu(Math.abs(dy))}`,B[0],B[1]+26,c)}
}
// أبعاد مرتبطة: البُعد يحمل la/lb = {id,i,m} (شكل معرّف بـ id، رقم الرأس أو الضلع، m=1 لمنتصف الضلع) ويتحدّث مع كل رسم
function sid(s){return s.id||(s.id=uid())}

function linkDim(d){for(const k of['la','lb']){const r=d[k];if(r&&r.s)d[k]={id:sid(r.s),i:r.i,m:r.m||0};else delete d[k]}}

function syncDims(){
  const ds=shapes.filter(s=>s.t==='dim'&&(s.la||s.lb));if(!ds.length)return;
  const by=new Map();shapes.forEach(s=>{if(s.id)by.set(s.id,s)});
  const pt=L=>{const s=by.get(L.id);if(!s)return null;const P=pts(s);if(L.m){const A=P[L.i],B=P[(L.i+1)%P.length];return A&&B?[(A[0]+B[0])/2,(A[1]+B[1])/2]:null}return P[L.i]||null};
  ds.forEach(d=>{if(d.la){const p=pt(d.la);if(p)d.a=p.slice()}if(d.lb){const p=pt(d.lb);if(p)d.b=p.slice()}});
}

function fixLinks(src,out){
  const map=new Map();
  src.forEach((s,i)=>{if(s.id){out[i].id=uid();map.set(s.id,out[i].id)}});
  out.forEach(d=>{if(d.t==='dim')for(const k of['la','lb']){if(d[k]){if(map.has(d[k].id))d[k]={...d[k],id:map.get(d[k].id)};else delete d[k]}}});
}
