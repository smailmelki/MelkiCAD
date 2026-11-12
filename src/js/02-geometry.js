/* ==================================================================
 * 02-geometry.js
 * هندسة الأشكال: نقاط كل شكل وحدوده ومساحته وأضلاعه، التدوير والتحريك والنسخ،
 * التحقق من صلاحية الشكل، وإنشاء الشكل من نقطتين (build).
 *
 * يعرّف: arcPtsShape، ellipsePts، pts، mcx، nb، rc، rp، rotS، plen، area، bx، valid،
 *        segs، mv، copy، dseg، build، bounds، cullBox
 * يعتمد على: 01-core.js، 05-persistence.js
 * ================================================================== */

const arcPtsShape=s=>{const n=Math.max(2,Math.min(144,Math.ceil(Math.abs(s.a1-s.a0)/(Math.PI/36))));return Array.from({length:n+1},(_,i)=>{const a=s.a0+(s.a1-s.a0)*i/n;return[s.x+s.r*Math.cos(a),s.y+s.r*Math.sin(a)]})};

const ellipsePts=s=>Array.from({length:72},(_,i)=>{const a=i*Math.PI/36,c=Math.cos(s.rot||0),n=Math.sin(s.rot||0),x=s.rx*Math.cos(a),y=s.ry*Math.sin(a);return[s.x+x*c-y*n,s.y+x*n+y*c]});

const pts=s=>s.t==='ellipse'?ellipsePts(s):s.t==='arc'?arcPtsShape(s):s.t==='line'||s.t==='wall'||s.t==='dim'?[s.a,s.b]:s.p?s.p:s.t==='door'||s.t==='door2'||s.t==='win'?[[s.x-Math.cos(s.a)*(s.t==='door2'?(s.w1+s.w2):s.w)/2,s.y-Math.sin(s.a)*(s.t==='door2'?(s.w1+s.w2):s.w)/2],[s.x+Math.cos(s.a)*(s.t==='door2'?(s.w1+s.w2):s.w)/2,s.y+Math.sin(s.a)*(s.t==='door2'?(s.w1+s.w2):s.w)/2]]:s.t==='text'||s.t==='north'?rc(nb(s)):rc(s);
// مستطيل تقريبي حول نص أو سهم شمال (للتحديد والتدوير)
const mcx=document.createElement('canvas').getContext('2d');

function nb(s){let w=s.h;if(s.t==='text'){mcx.font=`600 100px ${FONT}`;w=Math.max(s.h*.6,mcx.measureText(s.txt||' ').width/100*s.h)}return{x:s.x-w/2,y:s.y-s.h/2,w,h:s.h,rot:s.a||0}}
// المستطيل: x,y,w,h + rot (زاوية بالراديان حول المركز)
function rc(s){const cx=s.x+s.w/2,cy=s.y+s.h/2,c=Math.cos(s.rot||0),n=Math.sin(s.rot||0);return[[-s.w/2,-s.h/2],[s.w/2,-s.h/2],[s.w/2,s.h/2],[-s.w/2,s.h/2]].map(q=>[cx+q[0]*c-q[1]*n,cy+q[0]*n+q[1]*c])}

const rp=(q,c,a)=>{const co=Math.cos(a),si=Math.sin(a),dx=q[0]-c[0],dy=q[1]-c[1];return[c[0]+dx*co-dy*si,c[1]+dx*si+dy*co]};

function rotS(s,o,c,a){
  if(s.t==='line'||s.t==='wall'||s.t==='dim'){s.a=rp(o.a,c,a);s.b=rp(o.b,c,a);if(s.t==='dim'&&o.c)s.c=rp(o.c,c,a);if(s.t==='dim'&&o.angle!==undefined)s.angle=o.angle+a}
  else if(s.p){s.p=o.p.map(q=>rp(q,c,a));if(o.cornerBase)s.cornerBase=o.cornerBase.map(q=>rp(q,c,a));}
  else if(s.t==='rect'||s.t==='furn'){const m=rp([o.x+o.w/2,o.y+o.h/2],c,a);s.x=m[0]-o.w/2;s.y=m[1]-o.h/2;s.rot=(o.rot||0)+a}
  else if(s.t==='ellipse'){const m=rp([o.x,o.y],c,a);s.x=m[0];s.y=m[1];s.rot=(o.rot||0)+a}
  else{const m=rp([o.x,o.y],c,a);s.x=m[0];s.y=m[1];if(o.a!=null)s.a=o.a+a;if(o.t==='arc'){s.a0=o.a0+a;s.a1=o.a1+a}}
}

const plen=p=>p.reduce((a,q,i)=>i?a+Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1]):0,0);

const area=s=>s.t==='rect'&& !s.p?s.w*s.h:s.t==='circle'?Math.PI*s.r*s.r:s.t==='ellipse'?Math.PI*s.rx*s.ry:['rect','tri','polygon'].includes(s.t)&&s.p&&s.p.length>=3?Math.abs(s.p.reduce((a,q,i)=>a+q[0]*s.p[(i+1)%s.p.length][1]-s.p[(i+1)%s.p.length][0]*q[1],0))/2:0;

// حدود الشكل بحلقة عادية بلا مصفوفات وسيطة (الانتشار Math.min(...arr) بطيء ويفشل مع آلاف النقاط)
const bx=s=>{
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  if(s.t==='circle'){x0=s.x-s.r;y0=s.y-s.r;x1=s.x+s.r;y1=s.y+s.r}
  else{const q=pts(s);for(let i=0;i<q.length;i++){const r=q[i],x=r[0],y=r[1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  return{x:x0,y:y0,X:x1,Y:y1}
};
// حدود مجموعة أشكال (بديل Math.min(...arr) الذي ينهار عند عشرات الآلاف من العناصر)
function bounds(list){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<list.length;i++){const b=bx(list[i]);if(b.x<x0)x0=b.x;if(b.y<y0)y0=b.y;if(b.X>x1)x1=b.X;if(b.Y>y1)y1=b.Y}return{x:x0,y:y0,X:x1,Y:y1}}
// صندوق حدود سريع في o=[x0,y0,x1,y1] بلا إنشاء مصفوفات، لاستبعاد ما هو خارج الشاشة أو بعيد عن المؤشر.
// يُرجع 1 إن كان الصندوق مطابقًا للشكل، و2 إن كان أكبر منه (أقواس، قطوع، مستطيل مدوّر، نص) فلا يكون أصغر أبدًا،
// وfalse للأنواع التي لا نستبعدها (أبعاد، أثاث، أبواب، نوافذ، سهم شمال).
function cullBox(s,o){
  const t=s.t;
  if(t==='line'||t==='wall'){const a=s.a,b=s.b;if(!a||!b)return false;o[0]=Math.min(a[0],b[0]);o[1]=Math.min(a[1],b[1]);o[2]=Math.max(a[0],b[0]);o[3]=Math.max(a[1],b[1]);return 1}
  if(t==='polyline'||t==='free'||t==='polygon'||t==='tri'){
    const p=s.p;if(!p||!p.length)return false;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(let i=0;i<p.length;i++){const q=p[i],x=q[0],y=q[1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    o[0]=x0;o[1]=y0;o[2]=x1;o[3]=y1;return 1;
  }
  if(t==='circle'){o[0]=s.x-s.r;o[1]=s.y-s.r;o[2]=s.x+s.r;o[3]=s.y+s.r;return 1}
  if(t==='arc'){o[0]=s.x-s.r;o[1]=s.y-s.r;o[2]=s.x+s.r;o[3]=s.y+s.r;return 2}
  if(t==='ellipse'){const r=Math.max(s.rx,s.ry);o[0]=s.x-r;o[1]=s.y-r;o[2]=s.x+r;o[3]=s.y+r;return 2}
  if(t==='rect'){
    if(!s.rot){o[0]=Math.min(s.x,s.x+s.w);o[1]=Math.min(s.y,s.y+s.h);o[2]=Math.max(s.x,s.x+s.w);o[3]=Math.max(s.y,s.y+s.h);return 1}
    const cx=s.x+s.w/2,cy=s.y+s.h/2,r=Math.hypot(s.w,s.h)/2;o[0]=cx-r;o[1]=cy-r;o[2]=cx+r;o[3]=cy+r;return 2;
  }
  if(t==='text'){const px=Math.max(6,s.h*V.s),r=((s.txt||'').length+2)*px/V.s;o[0]=s.x-r;o[1]=s.y-r;o[2]=s.x+r;o[3]=s.y+r;return 2}
  return false;
}

const valid=s=>s.t==='line'||s.t==='wall'||s.t==='dim'?len(s)>=.1:s.t==='circle'?s.r>=.05:s.t==='arc'?s.r>=.05&&s.a1>s.a0&&s.a1-s.a0<=Math.PI*2:s.t==='ellipse'?s.rx>=.05&&s.ry>=.05:['free','polyline','polygon','tri'].includes(s.t)?Array.isArray(s.p)&&s.p.length>=(s.t==='tri'?3:2)&&plen(s.p)>=.2:s.w>=.1&&s.h>=.1;

const segs=s=>s.t==='line'||s.t==='wall'?[[s.a,s.b]]:s.t==='arc'||s.t==='ellipse'?(()=>{const p=pts(s);return p.slice(1).map((q,i)=>[p[i],q])})():s.t==='tri'||s.t==='polygon'?s.p.map((q,i)=>[q,s.p[(i+1)%s.p.length]]):s.t==='polyline'||s.t==='free'?s.p.slice(1).map((q,i)=>[s.p[i],q]):s.t==='rect'?pts(s).map((q,i,a)=>[q,a[(i+1)%4]]):[];

const mv=(s,o,dx,dy)=>{if(s.t==='line'||s.t==='wall'||s.t==='dim'){s.a=[o.a[0]+dx,o.a[1]+dy];s.b=[o.b[0]+dx,o.b[1]+dy];if(s.t==='dim'&&o.c)s.c=[o.c[0]+dx,o.c[1]+dy]}else if(s.p){s.p=o.p.map(q=>[q[0]+dx,q[1]+dy]);if(o.cornerBase)s.cornerBase=o.cornerBase.map(q=>[q[0]+dx,q[1]+dy])}else{s.x=o.x+dx;s.y=o.y+dy}};

const copy=o=>{const t=JSON.parse(JSON.stringify(o));if(t&&!Array.isArray(t))delete t.id;return t};

function dseg(px,py,ax,ay,bx_,by){const dx=bx_-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=clamp(t,0,1);return Math.hypot(px-ax-t*dx,py-ay-t*dy)}

function build(a,b){
  const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);
  let s;
  if(tool==='line')s={t:'line',a,b};
  else if(tool==='wall')s={t:'wall',a,b,th:D.th||.2};
  else if(tool==='dim')s={t:'dim',mode:dimMode==='aligned'?'linear':dimMode,a,b,off:.6};
  else if(tool==='circle')s={t:'circle',x:a[0],y:a[1],r:Math.hypot(b[0]-a[0],b[1]-a[1])};
  else if(tool==='arc'){let a1=Math.atan2(b[1]-a[1],b[0]-a[0]);if(a1<=0)a1+=Math.PI*2;s={t:'arc',x:a[0],y:a[1],r:Math.hypot(b[0]-a[0],b[1]-a[1]),a0:0,a1};}
  else if(tool==='ellipse')s={t:'ellipse',x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,rx:Math.max(.025,w/2),ry:Math.max(.025,h/2),rot:0};
  else if(tool==='polygon'){const r=Math.hypot(b[0]-a[0],b[1]-a[1]),ang=Math.atan2(b[1]-a[1],b[0]-a[0]);s={t:'polygon',p:Array.from({length:polygonSides},(_,i)=>[a[0]+r*Math.cos(ang+i*2*Math.PI/polygonSides),a[1]+r*Math.sin(ang+i*2*Math.PI/polygonSides)])};}
  else if(tool==='tri')s={t:'tri',p:b[1]>=a[1]?[[x+w/2,y],[x+w,y+h],[x,y+h]]:[[x,y],[x+w,y],[x+w/2,y+h]]};
  else s={t:'rect',x,y,w,h};
  return Object.assign(s,{ly:cl,col:D.col||undefined,lw:D.lw});
}

