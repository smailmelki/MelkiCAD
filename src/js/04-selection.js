/* ==================================================================
 * 04-selection.js
 * التحديد: اختبار اللمس (hit)، التحديد بإطار، مقابض التعديل والتدوير، وإجراءات
 * شريط السياق (نسخ، لصق، حذف، تحديد الكل، تدوير، تحجيم).
 *
 * يعرّف: selC، grips، boxSel، gripAt، hit، transformShapeScale، transformSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            09-render.js، 10-dimensions.js، 22-toolbar.js
 * ================================================================== */

let moveArmed=0;
function selC(){const b=sel.map(i=>bx(shapes[i]));return[(Math.min(...b.map(q=>q.x))+Math.max(...b.map(q=>q.X)))/2,(Math.min(...b.map(q=>q.y))+Math.max(...b.map(q=>q.Y)))/2]}
// المقابض: نقاط التعديل + مقبض التدوير فوق التحديد
function grips(){
  if(moveArmed||tool!=='select'||!sel.length||(g&&g.k==='box'))return[];
  const r=[],s=sel.length===1?shapes[sel[0]]:null,b=sel.map(i=>bx(shapes[i])),x0=Math.min(...b.map(q=>q.x)),x1=Math.max(...b.map(q=>q.X)),y0=Math.min(...b.map(q=>q.y)),top=w2s((x0+x1)/2,y0);
  if(!sel.every(i=>shapes[i].t==='door'||shapes[i].t==='win'))r.push({id:'rot',sp:[top[0],top[1]-34],top});
  const add=(id,p)=>r.push({id,sp:w2s(...p)});
  if(s){if(s.t==='dim'){add('a',s.a);add('b',s.b);if(s.mode==='angular'){const a0=Math.atan2(s.a[1]-s.c[1],s.a[0]-s.c[0]),a1=Math.atan2(s.b[1]-s.c[1],s.b[0]-s.c[0]);let d=a1-a0;while(d<=-Math.PI)d+=Math.PI*2;while(d>Math.PI)d-=Math.PI*2;const m=a0+d/2;add('o',[s.c[0]+Math.cos(m)*(s.off||.6),s.c[1]+Math.sin(m)*(s.off||.6)])}else if(s.mode!=='radius'&&s.mode!=='diameter'){const d=dimPts(s);add('o',[(d[0][0]+d[1][0])/2,(d[0][1]+d[1][1])/2])}}else if(s.t==='line'||s.t==='wall'){add('a',s.a);add('b',s.b)}else if(s.t==='tri')s.p.forEach((q,i)=>add(i,q));else if(s.t==='rect'||s.t==='furn')rc(s).forEach((q,i)=>add(i,q));else if(s.t==='circle')add('r',[s.x+s.r,s.y])}
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
  const hitShape=s=>{
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
  for(let i=shapes.length-1;i>=0;i--){const s=shapes[i];if(!ed(s))continue;
    if(s.t==='circle'){const q=w2s(s.x,s.y);if(Math.hypot(px-q[0],py-q[1])<=s.r*V.s+8)return i}
    else if(s.t==='rect'||s.t==='furn'){const q=s2w(px,py),cx=s.x+s.w/2,cy=s.y+s.h/2,c=Math.cos(-(s.rot||0)),n=Math.sin(-(s.rot||0)),dx=q[0]-cx,dy=q[1]-cy,m=8/V.s;if(Math.abs(dx*c-dy*n)<=s.w/2+m&&Math.abs(dx*n+dy*c)<=s.h/2+m)return i}
    else if(s.t==='tri'){const q=s.p.map(r=>w2s(...r)),sg=(a,b)=>(px-b[0])*(a[1]-b[1])-(a[0]-b[0])*(py-b[1]),d=[sg(q[0],q[1]),sg(q[1],q[2]),sg(q[2],q[0])];if(!(d.some(v=>v<0)&&d.some(v=>v>0)))return i}
    else if(s.t==='text'||s.t==='north'){const n=nb(s),q=s2w(px,py),dx=q[0]-s.x,dy=q[1]-s.y,c=Math.cos(-n.rot),sn=Math.sin(-n.rot),m=8/V.s;if(Math.abs(dx*c-dy*sn)<=n.w/2+m&&Math.abs(dx*sn+dy*c)<=n.h/2+m)return i}
    else if(s.t==='dim'){
      if(s.mode==='angular'){
        const C=w2s(...s.c),A=w2s(...s.a),B=w2s(...s.b),a0=Math.atan2(A[1]-C[1],A[0]-C[0]),a1=Math.atan2(B[1]-C[1],B[0]-C[0]);
        let delta=a1-a0;while(delta<=-Math.PI)delta+=Math.PI*2;while(delta>Math.PI)delta-=Math.PI*2;
        if(dseg(px,py,C[0],C[1],A[0],A[1])<16||dseg(px,py,C[0],C[1],B[0],B[1])<16)return i;
        let prev=[C[0]+Math.cos(a0)*(s.off||.6)*V.s,C[1]+Math.sin(a0)*(s.off||.6)*V.s];
        for(let j=1;j<=32;j++){const t=a0+delta*j/32,q=[C[0]+Math.cos(t)*(s.off||.6)*V.s,C[1]+Math.sin(t)*(s.off||.6)*V.s];if(dseg(px,py,prev[0],prev[1],q[0],q[1])<16)return i;prev=q}
        const m=a0+delta/2,tx=C[0]+Math.cos(m)*(s.off||.6)*V.s,ty=C[1]+Math.sin(m)*(s.off||.6)*V.s;if(Math.hypot(px-tx,py-ty)<22)return i;
      }else{const A=w2s(...s.a),B=w2s(...s.b);if(dseg(px,py,A[0],A[1],B[0],B[1])<16||Math.hypot(px-(A[0]+B[0])/2,py-(A[1]+B[1])/2)<20)return i}
    }
    else{const q=pts(s).map(r=>w2s(...r));for(let j=1;j<q.length;j++)if(dseg(px,py,q[j-1][0],q[j-1][1],q[j][0],q[j][1])<Math.max(16,(s.th||0)*V.s/2+8))return i}}
  return -1;
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
  const r=clip.map(bx),x0=Math.min(...r.map(q=>q.x)),y0=Math.min(...r.map(q=>q.y)),x1=Math.max(...r.map(q=>q.X)),y1=Math.max(...r.map(q=>q.Y)),c=s2w(W/2,H/2);
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
  else if(['text','north','door','win'].includes(s.t)){s.x=c[0]+(o.x-c[0])*k;s.y=c[1]+(o.y-c[1])*k;s.h=o.h*k;if(o.w!==undefined)s.w=o.w*k;if(o.th!==undefined)s.th=o.th*k}
}

function transformSheet(kind){if(!sel.length)return;const sh=$('#sheet'),single=sel.length===1?shapes[sel[0]]:null;sh.innerHTML=kind==='rotate'?'<b>تدوير العناصر</b><label>زاوية الدوران (درجة)<input id="trval" type="number" step="0.1" value="90" dir="ltr"></label><p>موجب عكس عقارب الساعة، حول مركز التحديد.</p><button id="applytr">تطبيق</button><button id="ok">إلغاء</button>':'<b>تحجيم العناصر</b><label>عامل التحجيم<input id="trval" type="number" min="0.01" step="0.1" value="2" dir="ltr"></label><p>مثال: 2 تكبير للضعف، و0.5 تصغير إلى النصف. يتم التحجيم حول مركز التحديد.</p><button id="applytr">تطبيق</button><button id="ok">إلغاء</button>';$('#applytr').onclick=()=>{const v=num($('#trval').value);if(!Number.isFinite(v)||(kind==='scale'?v<=0:!Number.isFinite(v))){toast('أدخل قيمة صحيحة');return}snap();const c=selC();if(kind==='rotate'){const a=v*Math.PI/180;sel.forEach(i=>rotS(shapes[i],copy(shapes[i]),c,a))}else sel.forEach(i=>{const o=copy(shapes[i]);transformShapeScale(shapes[i],o,c,v)});save();sh.classList.remove('on');upd();draw()};$('#ok').onclick=()=>{sh.classList.remove('on');upd()};sh.classList.add('on');$('#ctx').style.display='none'}

$('#rt').onclick=()=>transformSheet('rotate');$('#scale').onclick=()=>transformSheet('scale');
