/* ==================================================================
 * 12-openings.js
 * الأبواب والنوافذ: رسم الفتحات، وإيجاد أقرب جدار لوضعها عليه (wallAt).
 *
 * يعرّف: drawOpen، wallAt
 * يعتمد على: 01-core.js، 02-geometry.js، 06-layers.js، 09-render.js
 * ================================================================== */

// باب (door)، باب مزدوج (door2: w1,w2 عرض كل ضلفة)، ونافذة (win).
function drawOpen(s,on,c){
  const q=w2s(s.x,s.y),w=(s.t==='door2'?s.w1+s.w2:s.w)*V.s,co=Math.cos(s.a),si=Math.sin(s.a),col=s.col||layerOf(s).col||c.ln,lw=s.lw||2;
  const T=(u,v)=>[q[0]+co*u-si*v,q[1]+si*u+co*v],L=(a,b)=>{ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1])};
  ctx.lineCap='butt';ctx.setLineDash([]);
  ctx.beginPath();L(T(-w/2,0),T(w/2,0));ctx.strokeStyle=c.bg;ctx.lineWidth=Math.max(12,(s.th||0)*V.s+3);ctx.stroke();
  if(on){ctx.beginPath();L(T(-w/2,0),T(w/2,0));ctx.strokeStyle=c.ac;ctx.globalAlpha=.3;ctx.lineWidth=lw+14;ctx.stroke();ctx.globalAlpha=1}
  ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.beginPath();
  if(s.t==='win'){ctx.lineWidth=Math.max(1.2,lw*.75);const hf=Math.max(4,(s.th||0)*V.s/2);[-hf,0,hf].forEach(v=>L(T(-w/2,v),T(w/2,v)));L(T(-w/2,-hf),T(-w/2,hf));L(T(w/2,-hf),T(w/2,hf));ctx.stroke()}
  else if(s.t==='door2'){
    const f=s.f||1,of=(s.th||0)*V.s/2*f,reach=Math.PI/2-(Number.isFinite(s.oa)?clamp(s.oa,0,180):90)*Math.PI/180,leaf=(hx,span,dir)=>{const z=span*V.s,H=T(hx*V.s,of),E=T((hx+dir*span*Math.cos(reach))*V.s,of+f*span*Math.sin(reach)*V.s),C=T((hx+dir*span)*V.s,of);ctx.beginPath();L(H,E);ctx.stroke();const aE=Math.atan2(E[1]-H[1],E[0]-H[0]),aC=Math.atan2(C[1]-H[1],C[0]-H[0]);let d=aC-aE;d=Math.atan2(Math.sin(d),Math.cos(d));ctx.beginPath();ctx.lineWidth=Math.max(1,lw*.6);ctx.globalAlpha=.7;ctx.arc(H[0],H[1],z,aE,aE+d,d<0);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=lw};
    leaf(-s.w1/2-s.w2/2,s.w1,1);leaf((s.w1+s.w2)/2,s.w2,-1);
  }
  else{
    const hinge=s.h===-1?-1:1,hu=-hinge*w/2,of=(s.th||0)*V.s/2*(s.f||1),reach=Math.PI/2-(Number.isFinite(s.oa)?clamp(s.oa,0,180):90)*Math.PI/180,H=T(hu,of),E=T(hu+hinge*w*Math.cos(reach),of+(s.f||1)*w*Math.sin(reach)),C=T(hu+hinge*w,of);L(H,E);ctx.stroke();
    const aE=Math.atan2(E[1]-H[1],E[0]-H[0]),aC=Math.atan2(C[1]-H[1],C[0]-H[0]);let d=aC-aE;d=Math.atan2(Math.sin(d),Math.cos(d));
    ctx.beginPath();ctx.lineWidth=Math.max(1,lw*.6);ctx.globalAlpha=.7;ctx.arc(H[0],H[1],w,aE,aE+d,d<0);ctx.stroke();ctx.globalAlpha=1;
  }
  if(on&&ST.showDims){if(s.t==='door2'){const a=T(-s.w2/2,-22),b=T(s.w1/2,-22);tag(fl(s.w1),a[0],a[1],c);tag(fl(s.w2),b[0],b[1],c)}else{const m=T(0,-22);tag(fl(s.w),m[0],m[1],c)}}
}
// أقرب نقطة على جدار (خط أو ضلع غرفة/مثلث) ضمن نصف قطر r بالمتر
function wallAt(p,r){let best=null,bd=r;for(const s of shapes)if(shown(s))for(const e of segs(s)){const a=e[0],b=e[1],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;if(!l)continue;const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l,0,1),q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<bd){bd=d;best={q,a:Math.atan2(dy,dx),th:s.t==='wall'?s.th:0}}}return best}

