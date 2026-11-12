/* ==================================================================
 * 09-render.js
 * الرسم على اللوحة: ألوان الثيم، رسم الأشكال والتعبئة والنصوص، إطار الرسم الكامل
 * draw، تغيير الحجم، ملاءمة العرض، ولقطة الشاشة.
 *
 * يعرّف: colors، tag، fillShape، drawNote، drawShape، marker، OPEN_FAST، drawShapes، drawStretchWindow، drawMoveGhost، draw، redraw، resize، quickShot
 * يعتمد على: 01-core.js، 02-geometry.js، 04-selection.js، 05-persistence.js،
 *            06-layers.js، 10-dimensions.js، 11-furniture.js، 12-openings.js
 * ================================================================== */

// ---- الرسم ----
const colors=()=>{const s=getComputedStyle(document.documentElement),v=n=>s.getPropertyValue(n).trim();return{bg:v('--cv'),grid:v('--grid'),major:v('--major'),ln:v('--ln'),ac:v('--ac'),dim:v('--dim')}};

function tag(t,x,y,c,big){
  ctx.font=`${big?600:400} ${big?15:12}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
  const w=ctx.measureText(t).width+10;ctx.globalAlpha=.8;ctx.fillStyle=c.bg;ctx.fillRect(x-w/2,y-9,w,18);ctx.globalAlpha=1;
  ctx.fillStyle=big?c.ln:c.dim;ctx.fillText(t,x,y);
}
// تعبئة الغرف: s.fk = solid/tile/wood/hatch/dots و s.fc = لون التعبئة (افتراضيًا لون الخط)
function fillShape(s,Q,col){
  const fc=s.fc||col,k=s.fk;
  ctx.globalAlpha=k==='solid'?.4:.08;ctx.fillStyle=k==='solid'?fc:col;ctx.fill(Q);ctx.globalAlpha=1;
  if(!k||k==='solid')return;
  const b=bx(s),sp={tile:.4,wood:.14,hatch:.2,dots:.3}[k];
  if(!sp||sp*V.s<4)return;
  const x0=b.x,x1=b.X,y0=b.y,y1=b.Y;
  if((x1-x0+y1-y0)/sp>700||(k==='dots'&&(x1-x0)*(y1-y0)/(sp*sp)>2500))return;
  const X=x=>V.x+x*V.s,Y=y=>V.y+y*V.s;
  ctx.save();ctx.clip(Q);ctx.strokeStyle=fc;ctx.globalAlpha=.55;ctx.lineWidth=1;ctx.setLineDash([]);ctx.beginPath();
  if(k==='tile'){for(let x=Math.floor(x0/sp)*sp;x<=x1;x+=sp){ctx.moveTo(X(x),Y(y0));ctx.lineTo(X(x),Y(y1))}for(let y=Math.floor(y0/sp)*sp;y<=y1;y+=sp){ctx.moveTo(X(x0),Y(y));ctx.lineTo(X(x1),Y(y))}}
  else if(k==='wood'){const L=sp*7;let r=0;for(let y=Math.floor(y0/sp)*sp;y<=y1;y+=sp,r++){ctx.moveTo(X(x0),Y(y));ctx.lineTo(X(x1),Y(y));for(let x=Math.floor(x0/L)*L+(r%3)*L/3;x<=x1;x+=L){ctx.moveTo(X(x),Y(y));ctx.lineTo(X(x),Y(y+sp))}}}
  else if(k==='hatch'){const h=y1-y0;for(let d=x0-h;d<=x1;d+=sp){ctx.moveTo(X(d),Y(y1));ctx.lineTo(X(d+h),Y(y0))}}
  else{for(let x=Math.floor(x0/sp)*sp;x<=x1;x+=sp)for(let y=Math.floor(y0/sp)*sp;y<=y1;y+=sp){ctx.moveTo(X(x)+1.3,Y(y));ctx.arc(X(x),Y(y),1.3,0,7)}}
  ctx.stroke();ctx.restore();
}

function drawNote(s,on,c){
  const q=w2s(s.x,s.y),col=s.col||layerOf(s).col||c.ln,n=on?nb(s):null,px=Math.max(6,s.h*V.s);
  ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(s.a||0);ctx.setLineDash([]);
  if(s.t==='text'){
    const txt=s.txt||'';ctx.direction=/[\u0600-\u06FF]/.test(txt)?'rtl':'ltr';
    ctx.font=`600 ${px}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineJoin='round';ctx.lineWidth=px*.3;ctx.strokeStyle=c.bg;ctx.strokeText(txt,0,0);ctx.fillStyle=col;ctx.fillText(txt,0,0);
  }else{
    const r=Math.max(14,s.h*V.s/2);
    ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-r*.9);ctx.lineTo(r*.35,r*.6);ctx.lineTo(0,r*.25);ctx.lineTo(-r*.35,r*.6);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-r*.9);ctx.lineTo(0,r*.25);ctx.lineTo(-r*.35,r*.6);ctx.closePath();ctx.fill();
    ctx.font=`700 ${Math.max(11,r*.6)}px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction='ltr';ctx.fillText('N',0,-r-Math.max(8,r*.4));
  }
  if(on){const bw=n.w*V.s,bh=n.h*V.s;ctx.strokeStyle=c.ac;ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.strokeRect(-bw/2-4,-bh/2-4,bw+8,bh+8)}
  ctx.restore();
}

function drawShape(s,on,prev,c){
  if(s.t==='dim')return drawDim(s,on,prev,c);
  if(s.t==='furn')return drawFurn(s,on,c);
  if(s.t==='text'||s.t==='north')return drawNote(s,on,c);
  if(s.t==='door'||s.t==='door2'||s.t==='win')return drawOpen(s,on,c);
  const Q=new Path2D(),col=s.col||layerOf(s).col||c.ln,lw=s.t==='wall'?Math.max(2,s.th*V.s):s.lw||2,closed=['rect','tri','polygon','circle','ellipse'].includes(s.t);
  if(s.t==='circle'){const r=w2s(s.x,s.y);Q.arc(r[0],r[1],s.r*V.s,0,7)}
  else if(s.t==='ellipse'){pts(s).forEach((q,i)=>{const r=w2s(...q);i?Q.lineTo(r[0],r[1]):Q.moveTo(r[0],r[1])});Q.closePath()}
  else{pts(s).forEach((q,i)=>{const r=w2s(...q);i?Q.lineTo(r[0],r[1]):Q.moveTo(r[0],r[1])});if(closed)Q.closePath()}
  ctx.lineJoin='round';ctx.lineCap=s.t==='wall'?'square':'round';
  if(on){ctx.lineWidth=lw+8;ctx.strokeStyle=c.ac;ctx.globalAlpha=.3;ctx.stroke(Q);ctx.globalAlpha=1}
  if(closed)fillShape(s,Q,col);
  ctx.lineWidth=lw;ctx.strokeStyle=prev?c.ac:col;ctx.setLineDash(prev?[8,6]:[]);ctx.stroke(Q);ctx.setLineDash([]);
  const b=bx(s),a0=w2s(b.x,b.y),a1=w2s(b.X,b.Y),cx=(a0[0]+a1[0])/2,cy=(a0[1]+a1[1])/2;
  if((s.t==='line'||s.t==='wall')&&ST.showDims){const a=w2s(...s.a),e=w2s(...s.b);tag(`${fl(len(s))}${(on||prev)&&s.t==='wall'?` · ${f(s.th*100)} cm`:''}`,(a[0]+e[0])/2,(a[1]+e[1])/2-14-(s.th||0)*V.s/2,c)}
  else if(['free','polyline','arc'].includes(s.t)){if(ST.showDims&&(on||prev)){const q=w2s(...pts(s).at(-1));tag(s.t==='arc'?fl(s.r*(s.a1-s.a0)):fl(plen(s.p)),q[0],q[1]-16,c)}}
  else{
    const A=area(s),L=[];if(s.name)L.push([s.name,1]);
    if(ST.showDims){if(s.t==='circle')L.push([`R ${fl(s.r)}`,0]);else if(s.t==='rect')L.push([`${fu(s.w)} × ${fl(s.h)}`,0]);}
    if(ST.showAreas)L.push([`${f(A)} m²`,1]);
    const pw=a1[0]-a0[0],ph=a1[1]-a0[1];
    if(L.length&&pw>96&&ph>L.length*22+10)L.forEach((l,i)=>tag(l[0],cx,cy+(i-(L.length-1)/2)*20,c,l[1]));else if(ST.showAreas&&pw>44&&ph>26)tag(`${f(A)} m²`,cx,cy,c,1);
    if(ST.showDims&&(on||prev)){
      if(s.t==='rect'){const k=rc(s).map(q=>w2s(...q));tag(fu(s.w),(k[0][0]+k[1][0])/2,(k[0][1]+k[1][1])/2-14,c);tag(fu(s.h),(k[1][0]+k[2][0])/2+22,(k[1][1]+k[2][1])/2,c)}
      else if(s.t==='tri')s.p.forEach((q,i)=>{const n=s.p[(i+1)%3],u=w2s(...q),e=w2s(...n);tag(fu(Math.hypot(q[0]-n[0],q[1]-n[1])),(u[0]+e[0])/2,(u[1]+e[1])/2,c)});
      else if(s.t==='circle'){ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(a1[0],cy);ctx.strokeStyle=c.ac;ctx.lineWidth=1.5;ctx.stroke();tag(fu(s.r),(cx+a1[0])/2,cy-14,c)}
      else if(s.t==='ellipse'){tag(`RX ${fu(s.rx)}`,cx,cy-14,c);tag(`RY ${fu(s.ry)}`,cx,cy+14,c)}
    }
  }
}

function marker(c){
  const q=w2s(...mk.p),x=q[0],y=q[1];ctx.strokeStyle=c.ac;ctx.lineWidth=2.5;ctx.beginPath();
  if(mk.k==='end')ctx.rect(x-7,y-7,14,14);
  else if(mk.k==='mid'){ctx.moveTo(x,y-8);ctx.lineTo(x+8,y+6);ctx.lineTo(x-8,y+6);ctx.closePath()}
  else if(mk.k==='int'){ctx.moveTo(x-7,y-7);ctx.lineTo(x+7,y+7);ctx.moveTo(x+7,y-7);ctx.lineTo(x-7,y+7)}
  else if(mk.k==='cen')ctx.arc(x,y,7,0,7);
  else if(mk.k==='per'){ctx.moveTo(x-7,y-7);ctx.lineTo(x-7,y+7);ctx.lineTo(x+7,y+7);ctx.moveTo(x-7,y+1);ctx.lineTo(x-1,y+1);ctx.lineTo(x-1,y+7)}
  else if(mk.k==='nea'){ctx.moveTo(x-7,y-7);ctx.lineTo(x+7,y-7);ctx.lineTo(x-7,y+7);ctx.lineTo(x+7,y+7);ctx.closePath()}
  else{ctx.moveTo(x,y-8);ctx.lineTo(x+8,y);ctx.lineTo(x,y+8);ctx.lineTo(x-8,y);ctx.closePath()}
  ctx.stroke();tag(NM[mk.k],x,y-22,c);
}

// اختيار سلم شبكي تلقائي ضمن الحدود المطلوبة (من 1 سم إلى 10,000 م).
function autoGridScale(){
  const raw=clamp(48/Math.max(V.s,1e-12),.01,10000);
  const power=10**Math.floor(Math.log10(raw));
  const ratio=raw/power;
  const nice=ratio<=1?1:ratio<=2?2:ratio<=5?5:10;
  return clamp(nice*power,.01,10000);
}

// الأنواع المفتوحة البسيطة التي تُجمَّع في ضربة رسم واحدة لكل (لون، سماكة)
const OPEN_FAST=new Set(['line','polyline','free','arc']);

// رسم الأشكال بترتيبها. الملفات الكبيرة كانت بطيئة لثلاثة أسباب:
//  1) رسم كل شكل حتى خارج الشاشة  → نستبعده بصندوق الحدود السريع.
//  2) ضربة stroke منفصلة وPath2D جديد لكل خط → نجمع الخطوط البسيطة المتجاورة في ضربة واحدة لكل نمط
//     (الجمع داخل مقطع متجاور فقط، فلا يتغير ترتيب الرسم بالنسبة للتعبئات والأشكال المركّبة والتحديد).
//  3) مئات الشظايا الأصغر من بكسل ونصوص بحجم لا يُقرأ → في الملفات الكبيرة (> 1500 شكل) لا تُرسم.
function drawShapes(picked,c){
  const lm=new Map();for(const l of LY)lm.set(l.id,l);
  const L0=LY[0]||{vis:1,lock:0},lay=s=>lm.get(s.ly)||L0;
  const vs=Math.max(V.s,1e-9),vx0=-V.x/vs,vy0=-V.y/vs,vx1=(W-V.x)/vs,vy1=(H-V.y)/vs;
  const heavy=shapes.length>1500,o=[0,0,0,0],groups=new Map();
  // tiny=true: الشكل أصغر من بضعة بكسلات في ملف كبير، فيكفي مقطع مستقيم بين طرفيه (لا يُرى فرق)
  const trace=(s,tiny)=>{
    const X=V.x,Y=V.y,k=V.s;
    if(s.t==='line'){ctx.moveTo(X+s.a[0]*k,Y+s.a[1]*k);ctx.lineTo(X+s.b[0]*k,Y+s.b[1]*k);return}
    if(s.t==='circle'){const cx=X+s.x*k,cy=Y+s.y*k,r=s.r*k;ctx.moveTo(cx+r,cy);ctx.arc(cx,cy,r,0,7);return}
    if(s.t==='rect'){ctx.rect(X+s.x*k,Y+s.y*k,s.w*k,s.h*k);return}
    if(tiny){
      if(s.t==='arc'){ctx.moveTo(X+(s.x+s.r*Math.cos(s.a0))*k,Y+(s.y+s.r*Math.sin(s.a0))*k);ctx.lineTo(X+(s.x+s.r*Math.cos(s.a1))*k,Y+(s.y+s.r*Math.sin(s.a1))*k);return}
      const p0=s.p&&s.p[0],p1=s.p&&s.p[s.p.length-1];
      if(p0&&p1){ctx.moveTo(X+p0[0]*k,Y+p0[1]*k);ctx.lineTo(X+p1[0]*k,Y+p1[1]*k)}
      return;
    }
    const P=s.t==='arc'?arcPtsShape(s):s.p;if(!P||!P.length)return;
    let lx=X+P[0][0]*k,ly=Y+P[0][1]*k;ctx.moveTo(lx,ly);
    const n=P.length,eps=heavy?1:.5;
    // نقاط أقرب من eps بكسل لا تغيّر شيئًا في الشاشة؛ نتخطاها ونبقي الأخيرة دائمًا
    for(let i=1;i<n;i++){const x=X+P[i][0]*k,y=Y+P[i][1]*k;if(i===n-1||Math.abs(x-lx)+Math.abs(y-ly)>=eps){ctx.lineTo(x,y);lx=x;ly=y}}
    if(n===1)ctx.lineTo(lx,ly);
  };
  // دفعات صغيرة (64 شكلًا لكل ضربة): تقلّل عدد استدعاءات stroke بدرجة كبيرة دون مسار ضخم واحد
  // (القياس أظهر أن المسار الضخم الواحد أبطأ في التنعيم من دفعات صغيرة).
  const CH=64;
  const flush=()=>{
    if(!groups.size)return;
    ctx.lineJoin='round';ctx.lineCap='round';ctx.setLineDash([]);ctx.globalAlpha=1;
    for(const G of groups.values()){
      ctx.lineWidth=G.lw;ctx.strokeStyle=G.col;
      for(let i=0;i<G.list.length;i+=CH){
        ctx.beginPath();
        for(let j=i,e=Math.min(G.list.length,i+CH);j<e;j++)trace(G.list[j],G.tiny[j]);
        ctx.stroke();
      }
    }
    groups.clear();
  };
  for(const pass of[0,1]){
    for(let i=0;i<shapes.length;i++){
      const s=shapes[i],l=lay(s);
      if(l.vis===0)continue;
      if((s.t==='door'||s.t==='door2'||s.t==='win')!==!!pass)continue;
      const on=picked.has(i);
      if(cullBox(s,o)){
        // هامش بالبكسل لسماكة الخط والتظليل وبطاقات القياس، ولسماكة الجدار الحقيقية
        const m=(14+(s.t==='wall'?(s.th||0)*vs/2:0))/vs;
        if(o[2]<vx0-m||o[0]>vx1+m||o[3]<vy0-m||o[1]>vy1+m)continue;
        if(heavy&&!on&&s.t!=='text'&&(o[2]-o[0])*vs<.7&&(o[3]-o[1])*vs<.7)continue;
      }
      // في الملفات الكبيرة: الدوائر والمستطيلات الصغيرة جدًا (بلا تعبئة ولا اسم ولا قياسات) تدخل الدفعة أيضًا
      const small=heavy&&!on&&!ST.showDims&&!ST.showAreas&&!s.fk&&!s.name&&(o[2]-o[0])*vs<8&&(o[3]-o[1])*vs<8;
      if(!on&&!ST.showDims&&(OPEN_FAST.has(s.t)||(small&&(s.t==='circle'||(s.t==='rect'&&!s.rot))))){
        const col=s.col||l.col||c.ln,lw=s.lw||2,key=col+'|'+lw;
        let G=groups.get(key);if(!G){G={col,lw,list:[],tiny:[]};groups.set(key,G)}
        G.list.push(s);G.tiny.push(heavy&&(s.t==='polyline'||s.t==='free'||s.t==='arc')&&(o[2]-o[0])*vs<6&&(o[3]-o[1])*vs<6);continue;
      }
      flush();
      if(heavy&&s.t==='text'&&!on&&s.h*vs<4)continue;
      drawShape(s,on,false,c);
    }
    flush();
  }
}

// معاينة النقل/النسخ بنقطة أساس: ظل الأشكال في موضعها الجديد (أو إطار حدودها للتحديدات الكبيرة) وخط من نقطة الأساس مع المسافة والزاوية
// إطار الشدّ (Stretch): أخضر متقطع كإطار التحديد بالتقاطع، ويبقى ظاهرًا حتى نقطة الوصول
function drawStretchWindow(c){
  const F=moveFlow;if(!F||F.mode!=='stretch'||!F.win)return;
  const a=w2s(F.win.x0,F.win.y0),b=w2s(F.win.x1,F.win.y1);
  ctx.save();ctx.setLineDash([7,4]);ctx.lineWidth=1.5;ctx.strokeStyle=ctx.fillStyle='#16a34a';ctx.globalAlpha=.12;ctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.globalAlpha=1;ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.restore();
  tag(`شدّ: ${F.hits||0} شكل`,(a[0]+b[0])/2,Math.min(a[1],b[1])-14,c);
}
function drawMoveGhost(c){
  const F=moveFlow;drawStretchWindow(c);
  if(!F||F.stage!=='dest'||!F.base||!F.at)return;
  const dx=F.at[0]-F.base[0],dy=F.at[1]-F.base[1];
  if(F.ghost)F.ghost.forEach(s=>drawShape(s,false,true,c));
  else if(F.bb){const a=w2s(F.bb.x+dx,F.bb.y+dy),b=w2s(F.bb.X+dx,F.bb.Y+dy);ctx.save();ctx.strokeStyle=c.ac;ctx.lineWidth=1.5;ctx.setLineDash([8,6]);ctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);ctx.restore()}
  const p0=w2s(F.base[0],F.base[1]),p1=w2s(F.at[0],F.at[1]);
  ctx.save();ctx.strokeStyle=c.ac;ctx.fillStyle=c.ac;ctx.lineWidth=1.5;ctx.setLineDash([4,5]);
  ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke();
  ctx.setLineDash([]);ctx.beginPath();ctx.arc(p0[0],p0[1],4,0,7);ctx.fill();ctx.restore();
  const dist=Math.hypot(dx,dy);
  if(dist>1e-9)tag(`${fl(dist)} · ${Math.round(Math.atan2(-dy,dx)*1800/Math.PI)/10}°`,(p0[0]+p1[0])/2,(p0[1]+p1[1])/2-14,c);
}

function draw(){
  const c=colors();syncDims();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.direction='ltr';
  ctx.fillStyle=c.bg;ctx.fillRect(0,0,W,H);
  const gs=autoGridScale(),L=gs*V.s;
  if(ST.grid){
    const x0=Math.floor(-V.x/V.s/gs)*gs,x1=(W-V.x)/V.s,y0=Math.floor(-V.y/V.s/gs)*gs,y1=(H-V.y)/V.s;
    for(const major of[false,true]){
      ctx.beginPath();
      for(let x=x0;x<=x1;x+=gs){if((Math.round(x/gs)%5===0)!==major)continue;const p=Math.round(V.x+x*V.s)+.5;ctx.moveTo(p,0);ctx.lineTo(p,H)}
      for(let y=y0;y<=y1;y+=gs){if((Math.round(y/gs)%5===0)!==major)continue;const p=Math.round(V.y+y*V.s)+.5;ctx.moveTo(0,p);ctx.lineTo(W,p)}
      ctx.strokeStyle=major?c.major:c.grid;ctx.lineWidth=1;ctx.stroke();
    }
  }
  drawShapes(new Set(sel),c);
  // أثناء الرسم الموازي: إبراز ضلع المرجع ورسم دليل متقطع ممتد عبر مساحة اللوحة.
  if(parallelGuide&&parallelRef&&parallelGuide.target&&referenceWithinTolerance(parallelGuide.origin,parallelGuide.target)){
    const rx=parallelRef.b[0]-parallelRef.a[0],ry=parallelRef.b[1]-parallelRef.a[1],len=Math.hypot(rx,ry),dx=S.perpendicular?-ry:rx,dy=S.perpendicular?rx:ry;
    if(len>1e-9){
      const ux=dx/len,uy=dy/len,origin=parallelGuide.origin||parallelGuide.a;
      const corners=[[0,0],[W,0],[0,H],[W,H]].map(q=>s2w(...q));
      const ts=corners.map(q=>(q[0]-origin[0])*ux+(q[1]-origin[1])*uy),lo=Math.min(...ts)-2/Math.max(V.s,1e-9),hi=Math.max(...ts)+2/Math.max(V.s,1e-9);
      const p0=w2s(origin[0]+ux*lo,origin[1]+uy*lo),p1=w2s(origin[0]+ux*hi,origin[1]+uy*hi);
      ctx.save();ctx.strokeStyle='#06b6d4';ctx.globalAlpha=.95;ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(p0[0],p0[1]);ctx.lineTo(p1[0],p1[1]);ctx.stroke();ctx.setLineDash([]);
      const r0=w2s(...parallelRef.a),r1=w2s(...parallelRef.b);
      ctx.globalAlpha=.28;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(r0[0],r0[1]);ctx.lineTo(r1[0],r1[1]);ctx.stroke();
      ctx.globalAlpha=1;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(r0[0],r0[1]);ctx.lineTo(r1[0],r1[1]);ctx.stroke();
      ctx.restore();tag(S.perpendicular?'خط التعامد المرجعي':'الخط المرجعي',(r0[0]+r1[0])/2,(r0[1]+r1[1])/2-15,c);
    }
  }
  if(cur)drawShape(cur,false,true,c);
  if(polyDraft)drawShape(polyDraft,false,true,c);
  drawMoveGhost(c);
  if(box){
    const cr=box.x1<box.x0,k=cr?'#16a34a':'#2563eb',bw=box.x1-box.x0,bh=box.y1-box.y0;
    ctx.setLineDash(cr?[7,4]:[]);ctx.lineWidth=1.5;ctx.strokeStyle=k;ctx.fillStyle=k;ctx.globalAlpha=.12;ctx.fillRect(box.x0,box.y0,bw,bh);ctx.globalAlpha=1;ctx.strokeRect(box.x0,box.y0,bw,bh);ctx.setLineDash([]);
    tag(`${cr?'تحديد بالتقاطع':'تحديد داخلي'} (${sel.length})`,(box.x0+box.x1)/2,Math.min(box.y0,box.y1)-14,c);
  }else if(tool==='select'&&!sel.length&&shapes.length){ctx.font=`400 12px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c.dim;ctx.fillText('إطار من اليسار: داخلي · من اليمين: بالتقاطع',W/2,16)}
  if(g&&g.k==='rot'&&g.moved){const q=w2s(...g.c);tag(`${Math.round(g.deg)}°`,q[0],q[1],c,1)}
  else grips().forEach(q=>{
    if(q.id==='rot'){ctx.strokeStyle=c.ac;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(q.top[0],q.top[1]);ctx.lineTo(q.sp[0],q.sp[1]);ctx.stroke();ctx.fillStyle=c.ac;ctx.beginPath();ctx.arc(q.sp[0],q.sp[1],11,0,7);ctx.fill();ctx.fillStyle=c.bg;ctx.font=`600 15px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↻',q.sp[0],q.sp[1]+1)}
    else if(q.kind==='m'){ctx.fillStyle=c.bg;ctx.strokeStyle=c.ac;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(q.sp[0],q.sp[1],5,0,7);ctx.fill();ctx.stroke()}
    else{ctx.fillStyle=q.on?c.ac:c.bg;ctx.strokeStyle=c.ac;ctx.lineWidth=2;ctx.fillRect(q.sp[0]-6,q.sp[1]-6,12,12);ctx.strokeRect(q.sp[0]-6,q.sp[1]-6,12,12)}
  });
  if(ST.axes){
    const o=w2s(0,0),at=o[0]>12&&o[0]<W-40&&o[1]>44&&o[1]<H-12,b0=at?o:[34,H-58],n2=34;
    ctx.lineWidth=2;ctx.lineCap='round';ctx.font=`600 11px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.strokeStyle=ctx.fillStyle='#dc2626';ctx.beginPath();ctx.moveTo(b0[0],b0[1]);ctx.lineTo(b0[0]+n2,b0[1]);ctx.moveTo(b0[0]+n2-6,b0[1]-4);ctx.lineTo(b0[0]+n2,b0[1]);ctx.lineTo(b0[0]+n2-6,b0[1]+4);ctx.stroke();ctx.fillText('X',b0[0]+n2+9,b0[1]);
    ctx.strokeStyle=ctx.fillStyle='#16a34a';ctx.beginPath();ctx.moveTo(b0[0],b0[1]);ctx.lineTo(b0[0],b0[1]-n2);ctx.moveTo(b0[0]-4,b0[1]-n2+6);ctx.lineTo(b0[0],b0[1]-n2);ctx.lineTo(b0[0]+4,b0[1]-n2+6);ctx.stroke();ctx.fillText('Y',b0[0],b0[1]-n2-9);
    if(at){ctx.strokeStyle=c.dim;ctx.lineWidth=1.5;ctx.strokeRect(b0[0]-4,b0[1]-4,8,8);ctx.fillStyle=c.dim;ctx.textAlign='left';ctx.font=`400 10px ${FONT}`;ctx.fillText('0,0',b0[0]+7,b0[1]+13)}
  }
  if(ST.coord&&(mk||cpos)){const q=mk?mk.p:cpos;ctx.font=`400 11px ${FONT}`;ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle=c.dim;ctx.fillText(`X ${fu(q[0])}   Y ${fu(-q[1])}  ${ul()}`,W-10,H-14)}
  if(mk)marker(c);
  if(tool==='polyline'){ctx.font=`400 13px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c.dim;ctx.fillText('انقر لإضافة الرؤوس ثم اضغط إنهاء POLYLINE',W/2,20)}
  if(tool==='door'||tool==='door2'||tool==='win'){ctx.font=`400 13px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=c.dim;ctx.fillText(`المس جدارًا لوضع ${tool==='door2'?'الباب المزدوج':tool==='door'?'الباب':'النافذة'} ثم اسحب لتحريكه`,W/2,20)}
  if(!shapes.length&&!cur&&!polyDraft){ctx.font=`400 15px ${FONT}`;ctx.textAlign='center';ctx.fillStyle=c.dim;ctx.fillText('اختر شكلًا من الأسفل ثم اسحب على اللوحة',W/2,H/2)}
  ctx.strokeStyle=c.dim;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(12,H-14);ctx.lineTo(12+L,H-14);ctx.stroke();
  ctx.font=`400 11px ${FONT}`;ctx.textAlign='left';ctx.fillStyle=c.dim;ctx.fillText(fl(gs),12,H-26);
}

// رسم مؤجَّل: يدمج طلبات الرسم المتتالية (حركة المؤشر والعجلة) في إطار واحد لكل تحديث للشاشة.
// draw() يبقى متزامنًا للأماكن التي تحتاج النتيجة فورًا (لقطة الشاشة، التصدير).
let drawQueued=0;
function redraw(){if(drawQueued)return;drawQueued=requestAnimationFrame(()=>{drawQueued=0;draw()})}

function resize(){dpr=devicePixelRatio||1;const r=$('main').getBoundingClientRect();W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;draw()}

// ملاءمة العناصر لمساحة العرض مع الحفاظ على الأبعاد الحقيقية.
function fitView(items=shapes){
  if(!items.length){V={x:24,y:24,s:40};return}
  const B=bounds(items),x0=B.x,y0=B.y,x1=B.X,y1=B.Y;
  const pad=Math.max(18,Math.min(36,Math.min(W,H)*.08));
  const aw=Math.max(1,W-pad*2),ah=Math.max(1,H-pad*2);
  // الحد الأدنى الصغير يسمح بعرض عناصر بطول مئات أو آلاف الأمتار.
  V.s=clamp(Math.min(aw/Math.max(x1-x0,.1),ah/Math.max(y1-y0,.1)),.0001,1200);
  V.x=(W-(x1-x0)*V.s)/2-x0*V.s;
  V.y=(H-(y1-y0)*V.s)/2-y0*V.s;
}

$('#fit').onclick=()=>{fitView();save();draw()};

const quickShot=()=>{
  const s0=sel;sel=[];draw();const u=cv.toDataURL('image/png');sel=s0;draw();
  $('#ov img').src=u;$('#ov').hidden=false;
};

$('#ovx').onclick=()=>{$('#ov').hidden=true};

