/* ==================================================================
 * 14-pointer.js
 * اللمس والفأرة: التحريك والتكبير (إصبعان وعجلة الفأرة)، الرسم والسحب والتدوير
 * وتعديل المقابض، وبناء POLYLINE.
 *
 * يعرّف: finishPolyline، endPtr
 * يعتمد على: 01-core.js، 02-geometry.js، 03-snap.js، 04-selection.js،
 *            05-persistence.js، 09-render.js، 10-dimensions.js، 11-furniture.js،
 *            12-openings.js، 13-draw-input.js، 15-properties.js،
 *            16-edit-tools.js، 22-toolbar.js
 * ================================================================== */

// ---- اللمس ----
// أصغر مقياس عرض يسمح بوصول سلم 1-2-5 إلى 10,000 م، ويمنع التصغير بعده.
const MIN_VIEW_SCALE=48/5001;

function finishPolyline(){if(polyDraft&&polyDraft.p.length>=2&&valid(polyDraft)){snap();shapes.push(polyDraft);sel=[shapes.length-1];if(shapes.length===1&&W<=700)fitView([shapes[0]]);polyDraft=null;$('#polybar').style.display='none';save();upd();draw();showDyn(shapes[sel[0]])}else{polyDraft=null;$('#polybar').style.display='none';draw()}}

$('#polyfinish').onclick=finishPolyline;$('#polycancel').onclick=()=>{polyDraft=null;$('#polybar').style.display='none';draw()};

cv.addEventListener('dblclick',e=>{if(tool==='polyline'&&polyDraft){e.preventDefault();finishPolyline()}});

cv.addEventListener('pointerdown',e=>{
  cv.setPointerCapture(e.pointerId);P.set(e.pointerId,pos(e));
  if(P.size===2){
    const[a,b]=[...P.values()],m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    g={k:'pinch',d:Math.hypot(a[0]-b[0],a[1]-b[1])||1,s:V.s,w:s2w(...m)};cur=null;box=null;mk=null;draw();return;
  }
  if(P.size>2)return;
  const p=pos(e);cpos=s2w(...p);
  // عند تفعيل الموازاة، تكون النقرة الأولى لاختيار الخط المرجعي.
  if(S.parallel&&!parallelRef&&(!drawFlow||(drawFlow.stage==='first'&&drawFlow.points.length===0))){
    parallelRef=pickParallelReference(s2w(...p));
    toast(parallelRef?'تم تحديد الخط المرجعي للموازاة':'لم يتم العثور على خط قريب؛ المس خطًا أو ضلعًا واضحًا');
    g=null;draw();return;
  }
  if(drawFlow){addDrawPoint(cpos,false);draw();return}$('#sheet').classList.remove('on');$('#smenu').classList.remove('on');hideDyn();$$('.gm').forEach(m=>m.classList.remove('on'));
  if(tool==='polyline'){const q=snapPt(s2w(...p));if(!polyDraft){polyDraft={t:'polyline',p:[q],ly:cl,col:D.col||undefined,lw:D.lw};toast('أضف الرؤوس، ثم اضغط إنهاء POLYLINE')}else{let q=snapPt(s2w(...p));const first=polyDraft.p[0];if(polyDraft.p.length>=3&&Math.hypot((q[0]-first[0])*V.s,(q[1]-first[1])*V.s)<14){polyDraft.t='polygon';finishPolyline();return}const last=polyDraft.p[polyDraft.p.length-1];if(!mk&&(S.ortho||S.parallel&&parallelRef))q=constrain(last,q);if(Math.hypot(q[0]-last[0],q[1]-last[1])>.01)polyDraft.p.push(q)}$('#polybar').style.display='flex';mk=null;draw();return}
  if(tool==='pan')g={k:'pan',px:p[0],py:p[1],vx:V.x,vy:V.y};
  else if(tool==='select'){
    const gr=gripAt(p);
    if(gr){
      const before=snapStr();
      if(gr.id==='rot'){const c=selC(),w=s2w(...p);g={k:'rot',c,a0:Math.atan2(w[1]-c[1],w[0]-c[0]),o:sel.map(j=>copy(shapes[j])),before}}
      else g={k:'grip',gr,i:sel[0],o:copy(shapes[sel[0]]),before};
      upd();draw();return;
    }
    const i=hit(...p);
    if(i>=0){
      if(!sel.includes(i)){sel=[i];setMoveMode(false);g=null}
      else if(moveArmed)g={k:'move',w0:s2w(...p),o:sel.map(j=>copy(shapes[j])),before:snapStr()};
      else g=null;
    }else{sel=[];setMoveMode(false);g={k:'box',a:p}}
  }else if(tool==='furn'){
    const a=snapPt(s2w(...p)),d=SYM[furnKind],s={t:'furn',k:furnKind,x:a[0]-d.w/2,y:a[1]-d.h/2,w:d.w,h:d.h,rot:0,ly:cl,col:D.col||undefined};
    snap();shapes.push(s);sel=[shapes.length-1];g={k:'move',w0:s2w(...p),o:[copy(s)],moved:1,numericPlace:1};mk=null;
  }else if(tool==='trim'||tool==='extend'){
    (tool==='trim'?trimAt:extendAt)(p);g=null;mk=null;upd();draw();return;
  }else if(tool==='text'||tool==='north'){
    const a=snapPt(s2w(...p)),s={t:tool,x:a[0],y:a[1],h:tool==='text'?.35:1,a:0,ly:cl,col:D.col||undefined};
    if(tool==='text')s.txt='نص';
    snap();shapes.push(s);sel=[shapes.length-1];g=null;mk=null;upd();draw();
    showDyn(s);if(tool==='text'){opts();setTimeout(()=>{const t=$('#sheet [data-k="txt"]');if(t){t.focus();t.select()}},60)}
    return;
  }else if(tool==='door'||tool==='win'){
    const w=wallAt(s2w(...p),28/V.s);sel=[];
    if(w){const s={t:tool,x:w.q[0],y:w.q[1],a:w.a,th:w.th,w:tool==='door'?.9:1.2,f:1,h:1,ly:cl,col:D.col||undefined,lw:D.lw};
      snap();shapes.push(s);sel=[shapes.length-1];g={k:'move',w0:s2w(...p),o:[copy(s)],moved:1,numericPlace:1}}
  }else{
    sel=[];const a=tool==='free'?s2w(...p):snapPt(s2w(...p));if(tool==='free')mk=null;
    g={k:'draw',a,la:mk&&mk.ref,before:snapStr()};if(tool==='free')cur={t:'free',p:[a],ly:cl,col:D.col||undefined,lw:D.lw};
  }
  upd();draw();
});

cv.addEventListener('pointermove',e=>{
  const p=pos(e);
  if(!P.has(e.pointerId)){
    if(e.pointerType!=='mouse')return;
    cpos=s2w(...p);mk=tool==='select'||tool==='pan'||tool==='trim'||tool==='extend'?null:osnap(cpos);draw();return;
  }
  P.set(e.pointerId,p);cpos=s2w(...p);
  if(!g){if(e.pointerType==='mouse'){mk=tool==='select'||tool==='pan'||tool==='trim'||tool==='extend'?null:osnap(cpos);draw()}return;}
  if(g.k==='pinch'){
    const[a,b]=[...P.values()];if(!b)return;
    const d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    V.s=clamp(g.s*d/g.d,MIN_VIEW_SCALE,1200);V.x=m[0]-g.w[0]*V.s;V.y=m[1]-g.w[1]*V.s;
  }else if(g.k==='pan'){V.x=g.vx+p[0]-g.px;V.y=g.vy+p[1]-g.py}
  else if(g.k==='move'){
    const w=s2w(...p),dx=grid(w[0]-g.w0[0]),dy=grid(w[1]-g.w0[1]);
    if(!g.moved&&(dx||dy)){g.moved=1;hist.push(g.before)}
    sel.forEach((j,n)=>mv(shapes[j],g.o[n],dx,dy));
    sel.forEach((j,n)=>{const s=shapes[j],o=g.o[n];if(s.t==='dim'&&(s.la||s.lb)){s.a=o.a;s.b=o.b;const L=len(o)||1;s.off=o.off+(dx*(-(o.b[1]-o.a[1]))+dy*(o.b[0]-o.a[0]))/L}});
    sel.forEach(j=>{const s=shapes[j];if(s.t==='door'||s.t==='win'){const q=wallAt([s.x,s.y],28/V.s);if(q){s.x=q.q[0];s.y=q.q[1];s.a=q.a;s.th=q.th}}});
  }else if(g.k==='rot'){
    const w=s2w(...p);let d=Math.atan2(w[1]-g.c[1],w[0]-g.c[0])-g.a0;if(S.grid)d=Math.round(d/(Math.PI/12))*Math.PI/12;
    if(!g.moved&&d){g.moved=1;hist.push(g.before)}
    g.deg=d*180/Math.PI;sel.forEach((j,n)=>rotS(shapes[j],g.o[n],g.c,d));
  }else if(g.k==='grip'){
    const s=shapes[g.i],o=g.o,id=g.gr.id,keep=shapes.splice(g.i,1)[0],q=snapPt(s2w(...p));shapes.splice(g.i,0,keep);
    if(!g.moved){g.moved=1;hist.push(g.before)}
    if(s.t==='dim'){if(id==='o'){const L=len(s)||1,nx=-(s.b[1]-s.a[1])/L,ny=(s.b[0]-s.a[0])/L;s.off=(q[0]-s.a[0])*nx+(q[1]-s.a[1])*ny}else{s[id]=q;const L2=mk&&mk.ref&&mk.ref.s!==s?{id:sid(mk.ref.s),i:mk.ref.i,m:mk.ref.m||0}:undefined;if(id==='a')s.la=L2;else s.lb=L2}}else if(s.t==='line'||s.t==='wall'){const oth=s[id==='a'?'b':'a'];s[id]=mk?q:constrain(oth,q)}
    else if(s.t==='tri')s.p=o.p.map((r,i)=>i===id?q:r);
    else if(s.t==='circle')s.r=Math.max(.05,Math.hypot(q[0]-s.x,q[1]-s.y));
    else if(s.t==='rect'||s.t==='furn'){const opp=rc(o)[(id+2)%4],rt=-(o.rot||0),c=Math.cos(rt),n=Math.sin(rt),dx=q[0]-opp[0],dy=q[1]-opp[1],w=Math.max(.05,Math.abs(dx*c-dy*n)),h=Math.max(.05,Math.abs(dx*n+dy*c));s.w=w;s.h=h;s.x=(q[0]+opp[0])/2-w/2;s.y=(q[1]+opp[1])/2-h/2}
  }else if(g.k==='box'){if(Math.hypot(p[0]-g.a[0],p[1]-g.a[1])>6){box={x0:g.a[0],y0:g.a[1],x1:p[0],y1:p[1]};sel=boxSel()}}
  else if(g.k==='draw'){
    let b=tool==='free'?s2w(...p):snapPt(s2w(...p));if(!mk&&(tool==='line'||tool==='wall'||tool==='dim'))b=constrain(g.a,b);
    if(tool==='free'){if(cur){const l=cur.p[cur.p.length-1];if(Math.hypot(b[0]-l[0],b[1]-l[1])*V.s>=4)cur.p.push(b)}}
    else{if(!mk&&(tool==='line'||tool==='wall'||tool==='dim')&&(S.ortho||S.parallel&&parallelRef))b=constrain(g.a,b);parallelGuide=S.parallel&&parallelRef&&(tool==='line'||tool==='wall')?{a:g.a,b}:null;cur=build(g.a,b);if(tool==='dim'){cur.la=g.la||undefined;cur.lb=(mk&&mk.ref)||undefined}}
  }
  draw();
});

function endPtr(e){
  if(!P.has(e.pointerId))return;P.delete(e.pointerId);
  if(g&&e.type==='pointerup'){
    if(g.k==='draw'&&cur&&valid(cur)){hist.push(g.before);if(cur.t==='dim')linkDim(cur);shapes.push(cur);sel=[shapes.length-1];if(shapes.length===1&&W<=700)fitView([cur]);showDyn(cur)}
    else if(g.k==='move'&&g.numericPlace&&sel.length){showDyn(shapes[sel[0]])}
    else if(g.k==='box'&&box){
      sel=boxSel();
    }
  }
  cur=null;g=null;box=null;mk=null;parallelGuide=null;save();upd();draw();
}

cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!P.has(e.pointerId)){mk=null;draw()}});

cv.addEventListener('wheel',e=>{
  e.preventDefault();const p=pos(e),w=s2w(...p);
  V.s=clamp(V.s*(e.deltaY<0?1.1:.9),MIN_VIEW_SCALE,1200);V.x=p[0]-w[0]*V.s;V.y=p[1]-w[1]*V.s;draw();
},{passive:false});
