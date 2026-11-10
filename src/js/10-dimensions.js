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
    const value=mode==='diameter'?2*len(s):len(s),txt=`${mode==='diameter'?'Ø':'R'} ${fl(value)}`;
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
function dimensionPick(p){
  const q=snapPt(s2w(...p));
  if(dimMode==='angular'){
    dimDraft.push(q);
    if(dimDraft.length===1)toast('حدّد نقطة على الضلع الأول');
    else if(dimDraft.length===2)toast('حدّد نقطة على الضلع الثاني');
    else{
      const [c,a,b]=dimDraft;dimDraft=[];
      const s={t:'dim',mode:'angular',c,a,b,off:.6,ly:cl,col:D.col||undefined,lw:D.lw};
      if(valid(s)){snap();shapes.push(s);sel=[shapes.length-1];save();upd();draw()}else toast('النقاط متقاربة؛ أعد تحديد الزاوية');
    }
    return true;
  }
  if(dimMode==='radius'||dimMode==='diameter'){
    const i=hit(p[0],p[1]),o=shapes[i];
    if(!o||o.t!=='circle'){toast('المس دائرة لإضافة بُعد نصف القطر أو القطر');return true}
    const r=o.r,cx=o.x,cy=o.y;
    const s=dimMode==='radius'?{t:'dim',mode:'radius',a:[cx,cy],b:[cx+r,cy]}:{t:'dim',mode:'diameter',a:[cx-r,cy],b:[cx+r,cy]};
    Object.assign(s,{ly:cl,col:D.col||undefined,lw:D.lw});
    snap();shapes.push(s);sel=[shapes.length-1];save();upd();draw();return true;
  }
  return false;
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
