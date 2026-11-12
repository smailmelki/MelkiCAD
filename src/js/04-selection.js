/* ==================================================================
 * 04-selection.js
 * التحديد: اختبار اللمس (hit)، التحديد بإطار، مقابض التعديل والتدوير، وإجراءات
 * شريط السياق (نسخ، لصق، حذف، تحديد الكل، تدوير، تحجيم).
 *
 * يعرّف: vtxSel، vertexGrips، selC، grips، boxSel، gripAt، hit، transformShapeScale، transformSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            09-render.js، 10-dimensions.js، 22-toolbar.js
 * ================================================================== */

let moveArmed=0;
// رأس المتعدد/المضلع النشط (لمسة قصيرة على مقبضه): يُحذف بزر «حذف رأس» أو بمفتاح Delete. يُتحقق منه دائمًا بالمرجع فلا يبقى معلّقًا بعد تغيّر التحديد.
function vtxSel(){const v=vtxActive;if(!v||sel.length!==1)return null;const s=shapes[sel[0]];return s&&s===v.s&&Array.isArray(s.p)&&v.k>=0&&v.k<s.p.length&&(s.t==='polyline'||s.t==='polygon')?v:null}
// مقابض رؤوس المتعدد/المضلع: مربع لكل رأس (سحبه يحرّكه)، ودائرة صغيرة عند منتصف كل ضلع طويل (سحبها يضيف رأسًا).
// في الأشكال الكبيرة (أكثر من 300 رأس) تُعرض المقابض الظاهرة على الشاشة فقط وبسقف، فلا يثقل الرسم ولا اختبار اللمس.
function vertexGrips(s,r){
  const n=s.p.length,big=n>300,act=vtxSel(),vis=q=>q[0]>=-30&&q[0]<=W+30&&q[1]>=-30&&q[1]<=H+30;let c=0;
  for(let i=0;i<n&&c<600;i++){const q=w2s(s.p[i][0],s.p[i][1]);if(big&&!vis(q))continue;r.push({id:i,sp:q,kind:'v',on:!!act&&act.s===s&&act.k===i});c++}
  const m=s.t==='polygon'?n:n-1;
  for(let i=0;i<m&&c<900;i++){
    const A=s.p[i],B=s.p[(i+1)%n],a=w2s(A[0],A[1]),b=w2s(B[0],B[1]);
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<50)continue;   // ضلع قصير: دائرة المنتصف ستلتصق بالرأسين
    const q=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(big&&!vis(q))continue;
    r.push({id:'m'+i,sp:q,kind:'m',ins:i+1,at:[(A[0]+B[0])/2,(A[1]+B[1])/2]});c++;
  }
}
function selC(){const b=bounds(sel.map(i=>shapes[i]));return[(b.x+b.X)/2,(b.y+b.Y)/2]}
// المقابض: نقاط التعديل + مقبض التدوير فوق التحديد
function grips(){
  if(moveArmed||tool!=='select'||!sel.length||(g&&g.k==='box'))return[];
  const r=[],s=sel.length===1?shapes[sel[0]]:null,bb=bounds(sel.map(i=>shapes[i])),x0=bb.x,x1=bb.X,y0=bb.y,top=w2s((x0+x1)/2,y0);
  if(!sel.every(i=>['door','door2','win'].includes(shapes[i].t)))r.push({id:'rot',sp:[top[0],top[1]-34],top});
  const add=(id,p)=>r.push({id,sp:w2s(...p)});
  if(s){if(s.t==='dim'){add('a',s.a);add('b',s.b);if(s.mode==='angular'){const a0=Math.atan2(s.a[1]-s.c[1],s.a[0]-s.c[0]),a1=Math.atan2(s.b[1]-s.c[1],s.b[0]-s.c[0]);let d=a1-a0;while(d<=-Math.PI)d+=Math.PI*2;while(d>Math.PI)d-=Math.PI*2;const m=a0+d/2;add('o',[s.c[0]+Math.cos(m)*(s.off||.6),s.c[1]+Math.sin(m)*(s.off||.6)])}else if(s.mode!=='radius'&&s.mode!=='diameter'){const d=dimPts(s);add('o',[(d[0][0]+d[1][0])/2,(d[0][1]+d[1][1])/2])}}else if(s.t==='line'||s.t==='wall'){add('a',s.a);add('b',s.b)}else if(s.t==='tri')s.p.forEach((q,i)=>add(i,q));else if(s.t==='polyline'||s.t==='polygon')vertexGrips(s,r);else if(s.t==='arc'){const pa=a=>[s.x+s.r*Math.cos(a),s.y+s.r*Math.sin(a)];add('a0',pa(s.a0));add('a1',pa(s.a1));add('ar',pa((s.a0+s.a1)/2))}else if(s.t==='rect'||s.t==='furn')rc(s).forEach((q,i)=>add(i,q));else if(s.t==='circle')add('r',[s.x+s.r,s.y])}
  return r;
}
// تحديد بإطار: من اليسار لليمين = داخلي (الأشكال داخل الإطار بالكامل)، من اليمين لليسار = بالتقاطع (كل ما يلمسه الإطار)
function boxSel(){
  if(!box)return[];
  const a=s2w(box.x0,box.y0),b=s2w(box.x1,box.y1),x=Math.min(a[0],b[0]),X=Math.max(a[0],b[0]),y=Math.min(a[1],b[1]),Y=Math.max(a[1],b[1]),cross=box.x1<box.x0;
  const inside=p=>p[0]>=x&&p[0]<=X&&p[1]>=y&&p[1]<=Y;
  const corners=[[x,y],[X,y],[X,Y],[x,Y]];
  const orient=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const segHit=(p,q,r,s)=>{const a1=orient(p,q,r),a2=orient(p,q,s),b1=orient(r,s,p),b2=orient(r,s,q);return a1*a2<=1e-10&&b1*b2<=1e-10&&Math.max(Math.min(p[0],q[0]),Math.min(r[0],s[0]))<=Math.min(Math.max(p[0],q[0]),Math.max(r[0],s[0]))+1e-9&&Math.max(Math.min(p[1],q[1]),Math.min(r[1],s[1]))<=Math.min(Math.max(p[1],q[1]),Math.max(r[1],s[1]))+1e-9};
  const inPoly=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const u=poly[i],v=poly[j];if((u[1]>p[1])!==(v[1]>p[1])&&p[0]<(v[0]-u[0])*(p[1]-u[1])/(v[1]-u[1])+u[0])hit=!hit}return hit};
  const geometry=s=>s.t==='circle'?Array.from({length:96},(_,i)=>[s.x+s.r*Math.cos(i*Math.PI/48),s.y+s.r*Math.sin(i*Math.PI/48)]):s.t==='dim'?dimPts(s):pts(s);
  const closed=s=>['circle','ellipse','rect','furn','tri','polygon','text','north'].includes(s.t);
  const qb=[0,0,0,0];
  const hitShape=s=>{
    // رفض سريع بصندوق الحدود قبل أي هندسة مكلفة (يتكرر مع كل حركة أثناء سحب الإطار)
    const kb=cullBox(s,qb);
    if(kb){
      if(qb[2]<x||qb[0]>X||qb[3]<y||qb[1]>Y)return false;
      if(!cross&&kb===1&&(qb[0]<x||qb[2]>X||qb[1]<y||qb[3]>Y))return false;
      if(qb[0]>=x&&qb[2]<=X&&qb[1]>=y&&qb[3]<=Y)return true;   // الصندوق (ولو أكبر من الشكل) داخل الإطار: الشكل داخله حتمًا
    }
    if(s.t==='circle'){
      if(!cross)return s.x-s.r>=x&&s.x+s.r<=X&&s.y-s.r>=y&&s.y+s.r<=Y;
      const qx=clamp(s.x,x,X),qy=clamp(s.y,y,Y);return Math.hypot(qx-s.x,qy-s.y)<=s.r+1e-9;
    }
    const p=geometry(s);if(!p.length)return false;
    if(!cross)return p.every(inside);
    if(p.some(inside))return true;
    const edges=[];for(let i=1;i<p.length;i++)edges.push([p[i-1],p[i]]);
    if(closed(s)&&p.length>2)edges.push([p[p.length-1],p[0]]);
    const rectEdges=[[corners[0],corners[1]],[corners[1],corners[2]],[corners[2],corners[3]],[corners[3],corners[0]]];
    if(edges.some(e=>rectEdges.some(r=>segHit(e[0],e[1],r[0],r[1]))))return true;
    return closed(s)&&p.length>2&&corners.some(q=>inPoly(q,p));
  };
  return shapes.map((_,i)=>i).filter(i=>ed(shapes[i])&&hitShape(shapes[i]));
}

const gripAt=p=>grips().find(q=>Math.hypot(q.sp[0]-p[0],q.sp[1]-p[1])<=22);

function hit(px,py){
  // قياس المسافة إلى حدود العنصر، لا الاكتفاء بترتيب إنشائه.
  // هذا يسمح باختيار العنصر الداخلي عند لمس منطقة مشتركة مع عنصر مغلق أكبر.
  const insidePoly=(p,poly)=>{
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  };
  let best=-1,bestDistance=Infinity;
  for(let i=0;i<shapes.length;i++){
    const s=shapes[i];if(!ed(s))continue;
    let q;
    if(s.t==='circle'){
      const c=w2s(s.x,s.y),r=s.r*V.s;
      q=Array.from({length:96},(_,j)=>[c[0]+r*Math.cos(j*Math.PI/48),c[1]+r*Math.sin(j*Math.PI/48)]);
    }else if(s.t==='dim'){
      if(s.mode==='angular'){
        const C=w2s(...s.c),A=w2s(...s.a),B=w2s(...s.b),a0=Math.atan2(A[1]-C[1],A[0]-C[0]),a1=Math.atan2(B[1]-C[1],B[0]-C[0]);
        let delta=a1-a0;while(delta<=-Math.PI)delta+=Math.PI*2;while(delta>Math.PI)delta-=Math.PI*2;
        q=[C,A,B];let prev=[C[0]+Math.cos(a0)*(s.off||.6)*V.s,C[1]+Math.sin(a0)*(s.off||.6)*V.s];
        for(let j=1;j<=48;j++){const a=a0+delta*j/48,next=[C[0]+Math.cos(a)*(s.off||.6)*V.s,C[1]+Math.sin(a)*(s.off||.6)*V.s];q.push(prev,next);prev=next}
      }else q=[w2s(...s.a),w2s(...s.b)];
    }else q=pts(s).map(p=>w2s(...p));
    if(!q||q.length<2)continue;
    const closed=['circle','ellipse','rect','furn','tri','polygon','text','north'].includes(s.t);
    const inside=closed&&insidePoly([px,py],q);
    let distance=Infinity;
    const count=closed?q.length:q.length-1;
    for(let j=0;j<count;j++){
      const a=q[j],b=q[(j+1)%q.length];
      distance=Math.min(distance,dseg(px,py,a[0],a[1],b[0],b[1]));
    }
    const tolerance=s.t==='dim'?18:Math.max(16,(s.th||0)*V.s/2+8);
    if(!inside&&distance>tolerance)continue;
    // عند وجود أكثر من مرشح، اختر الحد الأقرب إلى موضع اللمس.
    // داخل الأشكال المغلقة تكون حدود الشكل الداخلي أقرب عادةً من حدود الحاوية.
    if(distance<bestDistance-0.01||(Math.abs(distance-bestDistance)<=0.01&&i>best)){
      best=i;bestDistance=distance;
    }
  }
  return best;
}
function setMoveMode(on){
  moveArmed=on?1:0;
  const b=$('#mv');
  if(b){b.classList.toggle('active',!!moveArmed);b.setAttribute('aria-pressed',moveArmed?'true':'false');b.textContent=moveArmed?'إلغاء التحريك':'تحريك'}
  ['op','cp','ps','rt','scale','del','all'].forEach(id=>{const el=$('#'+id);if(el)el.disabled=!!moveArmed});
}
$('#mv').onclick=()=>{if(!sel.length)return;setMoveMode(!moveArmed);toast(moveArmed?'وضع التحريك مفعّل':'تم إلغاء وضع التحريك')};

$('#cp').onclick=()=>{clip=sel.map(i=>JSON.parse(JSON.stringify(shapes[i])));upd()};

$('#ps').onclick=()=>{
  if(!clip.length)return;snap();
  const bb=bounds(clip),x0=bb.x,y0=bb.y,x1=bb.X,y1=bb.Y,c=s2w(W/2,H/2);
  const dx=grid(c[0]-(x0+x1)/2),dy=grid(c[1]-(y0+y1)/2),n=clip.map(s=>{const t=copy(s);mv(t,s,dx,dy);return t});fixLinks(clip,n);
  sel=n.map((_,i)=>shapes.length+i);shapes.push(...n);save();upd();draw();
};

$('#del').onclick=()=>{if(sel.length){snap();shapes=shapes.filter((_,i)=>!sel.includes(i));sel=[];save();upd();draw()}};

$('#all').onclick=()=>{sel=shapes.map((_,i)=>i).filter(i=>ed(shapes[i]));upd();draw()};

function transformShapeScale(s,o,c,k){
  const sc=q=>[c[0]+(q[0]-c[0])*k,c[1]+(q[1]-c[1])*k];
  if(['line','wall','dim'].includes(s.t)){s.a=sc(o.a);s.b=sc(o.b);if(s.t==='dim')s.off=o.off*k;if(s.t==='wall'&&o.th)s.th=o.th*k}
  else if(Array.isArray(o.p))s.p=o.p.map(sc);
  else if(s.t==='circle'||s.t==='arc'){s.x=c[0]+(o.x-c[0])*k;s.y=c[1]+(o.y-c[1])*k;s.r=o.r*k}
  else if(s.t==='ellipse'){s.x=c[0]+(o.x-c[0])*k;s.y=c[1]+(o.y-c[1])*k;s.rx=o.rx*k;s.ry=o.ry*k}
  else if(s.t==='rect'||s.t==='furn'){const m=sc([o.x+o.w/2,o.y+o.h/2]);s.w=o.w*k;s.h=o.h*k;s.x=m[0]-s.w/2;s.y=m[1]-s.h/2}
  else if(['text','north','door','door2','win'].includes(s.t)){s.x=c[0]+(o.x-c[0])*k;s.y=c[1]+(o.y-c[1])*k;s.h=o.h*k;if(o.w!==undefined)s.w=o.w*k;if(o.w1!==undefined)s.w1=o.w1*k;if(o.w2!==undefined)s.w2=o.w2*k;if(o.th!==undefined)s.th=o.th*k}
}

function transformSheet(kind){if(!sel.length)return;const sh=$('#sheet'),single=sel.length===1?shapes[sel[0]]:null;sh.innerHTML=kind==='rotate'?'<b>تدوير العناصر</b><label>زاوية الدوران (درجة)<input id="trval" type="number" step="0.1" value="90" dir="ltr"></label><p>موجب عكس عقارب الساعة، حول مركز التحديد.</p><button id="applytr">تطبيق</button><button id="ok">إلغاء</button>':'<b>تحجيم العناصر</b><label>عامل التحجيم<input id="trval" type="number" min="0.01" step="0.1" value="2" dir="ltr"></label><p>مثال: 2 تكبير للضعف، و0.5 تصغير إلى النصف. يتم التحجيم حول مركز التحديد.</p><button id="applytr">تطبيق</button><button id="ok">إلغاء</button>';$('#applytr').onclick=()=>{const v=num($('#trval').value);if(!Number.isFinite(v)||(kind==='scale'?v<=0:!Number.isFinite(v))){toast('أدخل قيمة صحيحة');return}snap();const c=selC();if(kind==='rotate'){const a=v*Math.PI/180;sel.forEach(i=>rotS(shapes[i],copy(shapes[i]),c,a))}else sel.forEach(i=>{const o=copy(shapes[i]);transformShapeScale(shapes[i],o,c,v)});save();sh.classList.remove('on');upd();draw()};$('#ok').onclick=()=>{sh.classList.remove('on');upd()};sh.classList.add('on');$('#ctx').style.display='none'}

$('#rt').onclick=()=>transformSheet('rotate');$('#scale').onclick=()=>transformSheet('scale');

