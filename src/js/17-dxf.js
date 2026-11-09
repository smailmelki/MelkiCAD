/* ==================================================================
 * 17-dxf.js
 * DXF: تصدير ASCII متوافق مع AutoCAD 2000 (AC1015) واستيراد الكيانات الشائعة مع
 * اختيار وحدة القياس.
 *
 * يعرّف: dxfBuild، exportDXF، dxfEntities، dxfShapes، fitImportedView، dxfImport
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 07-projects.js،
 *            08-project-io.js، 09-render.js، 10-dimensions.js، 11-furniture.js،
 *            22-toolbar.js
 * ================================================================== */

// ---- DXF: تصدير واستيراد بصيغة ASCII متوافقة مع AutoCAD 2000 (AC1015)، مع دعم وحدات القياس والطبقات والكيانات الشائعة ----
function dxfBuild(){
  const D=[],w=(c,v)=>{D.push(String(c),String(v))},n=v=>Number.isFinite(+v)?+Number(v).toFixed(6):0,Yf=y=>n(-y),BS=String.fromCharCode(92);
  const esc=s=>Array.from(String(s??'')).map(ch=>{
    const cp=ch.codePointAt(0);
    if(cp>=32&&cp<=126)return ch;
    if(cp<=0xffff)return BS+'U+'+cp.toString(16).toUpperCase().padStart(4,'0');
    const z=cp-0x10000,hi=0xD800+(z>>10),lo=0xDC00+(z&1023);
    return BS+'U+'+hi.toString(16).toUpperCase()+BS+'U+'+lo.toString(16).toUpperCase();
  }).join('');
  const aci=c=>({'#dc2626':1,'#ca8a04':2,'#16a34a':3,'#0d9488':4,'#2563eb':5,'#9333ea':6,'#6b7280':8,'#ea580c':30})[String(c||'').toLowerCase()]||7;
  const used=new Set(['0']);
  const clean=(v,i)=>{
    let q=String(v||'Layer').normalize('NFKC').replace(/[<>\/\\":;?*|,=]/g,'_').replace(/\s+/g,'_').replace(/[^A-Za-z0-9_$-]/g,'_').slice(0,28)||'Layer';
    if(/^_+$/.test(q)||q.toLowerCase()==='0')q='Layer_'+(i+1);
    let b=q,j=1;while(used.has(q.toLowerCase()))q=(b.slice(0,24)+'_'+(++j));
    used.add(q.toLowerCase());return q;
  };
  const lnames=LY.map((l,i)=>clean(l.name,i));
  if(!lnames.length)lnames.push('0');
  const lay=s=>{const i=LY.findIndex(l=>l.id===s.ly);return i<0?'0':lnames[i]};
  const ent=(t,s)=>{w(0,t);w(8,lay(s));w(62,256)};
  const P3=(c,q)=>{w(c,n(q[0]));w(c+10,Yf(q[1]));w(c+20,0)};
  const line=(s,a,b)=>{ent('LINE',s);P3(10,a);P3(11,b)};
  const poly=(s,P,closed)=>{if(!P||P.length<2)return;ent('POLYLINE',s);w(66,1);w(10,0);w(20,0);w(30,0);w(70,closed?1:0);P.forEach(q=>{w(0,'VERTEX');w(8,lay(s));P3(10,q)});w(0,'SEQEND');w(8,lay(s))};
  const circ=(s,c,r)=>{ent('CIRCLE',s);P3(10,c);w(40,n(r))};
  const txt=(s,q,h,ang,str)=>{ent('TEXT',s);P3(10,q);w(40,n(h));w(1,esc(str));w(50,n(-ang*180/Math.PI));w(7,'STANDARD')};
  const rot=(c,a,u,v)=>[c[0]+u*Math.cos(a)-v*Math.sin(a),c[1]+u*Math.sin(a)+v*Math.cos(a)];
  const blockDefs=[],blockNames=new Set();
  const enc=v=>String(v).replace(/-/g,'M').replace(/\\./g,'P');
  const decNum=v=>Number(String(v).replace(/M/g,'-').replace(/P/g,'.'));
  const addBlock=(name,items)=>{
    if(blockNames.has(name))return;
    blockNames.add(name);
    const B=[],bw=(c,v)=>B.push(String(c),String(v)),bn=v=>n(v),bp=(c,q)=>{bw(c,bn(q[0]));bw(c+10,Yf(q[1]));bw(c+20,0)};
    const bl=(a,b)=>{bw(0,'LINE');bw(8,'0');bp(10,a);bp(11,b)};
    const bpoly=p=>{if(p.length<2)return;bw(0,'LWPOLYLINE');bw(8,'0');bw(90,p.length);bw(70,0);p.forEach(q=>{bw(10,bn(q[0]));bw(20,Yf(q[1]))})};
    items({line:bl,poly:bpoly});
    blockDefs.push(['0','BLOCK','8','0','2',name,'70','0','10','0','20','0','30','0',...B,'0','ENDBLK','8','0']);
  };
  const insert=(s,name,x,y,angle)=>{ent('INSERT',s);w(2,name);P3(10,[x,y]);w(41,1);w(42,1);w(43,1);w(50,n(-angle*180/Math.PI))};
  const makeCompositeBlock=s=>{
    if(s.t==='door'||s.t==='win'){
      const name=s.t==='door'?['MKD_D',enc(s.w),enc(s.th||0),enc(s.f||1),enc(s.h||1)].join('_'):['MKD_W',enc(s.w),enc(s.th||0)].join('_');
      addBlock(name,({line:bl,poly:bp})=>{
        const w2=s.w,th=s.th||0;
        if(s.t==='win'){const hf=Math.max(.05,th/2);[-hf,0,hf].forEach(v=>bl([-w2/2,v],[w2/2,v]));bl([-w2/2,-hf],[-w2/2,hf]);bl([w2/2,-hf],[w2/2,hf])}
        else{const f=s.f||1,hu=-(s.h||1)*w2/2,of=th/2*f,H=[hu,of],E=[hu,of+f*w2],C=[-hu,of],arc=[],a0=Math.atan2(E[1]-H[1],E[0]-H[0]),a1=Math.atan2(C[1]-H[1],C[0]-H[0]);let d=Math.atan2(Math.sin(a1-a0),Math.cos(a1-a0));bl(H,E);for(let j=0;j<=32;j++){const a=a0+d*j/32;arc.push([H[0]+w2*Math.cos(a),H[1]+w2*Math.sin(a)])}bp(arc)}
      });
      return name;
    }
    if(s.t==='furn'){
      const d=SYM[s.k]||SYM.table,name=['MKD_F',String(s.k||'table').replace(/[^A-Za-z0-9_-]/g,''),enc(s.w),enc(s.h)].join('_');
      addBlock(name,({line:bl,poly:bp})=>d.p.forEach(p=>{if(p[0]==='r')bp([[p[1]*s.w,p[2]*s.h],[(p[1]+p[3])*s.w,p[2]*s.h],[(p[1]+p[3])*s.w,(p[2]+p[4])*s.h],[p[1]*s.w,(p[2]+p[4])*s.h]]);else if(p[0]==='e'){const o=[];for(let i=0;i<40;i++){const t=i/40*2*Math.PI;o.push([(p[1]+Math.abs(p[3])*Math.cos(t))*s.w,(p[2]+Math.abs(p[4])*Math.sin(t))*s.h])}bp(o)}else bl([p[1]*s.w,p[2]*s.h],[p[3]*s.w,p[4]*s.h])}));
      return name;
    }
    return null;
  };
  w(0,'SECTION');w(2,'HEADER');
  w(9,'$ACADVER');w(1,'AC1015');
  w(9,'$INSUNITS');w(70,6);
  w(9,'$MEASUREMENT');w(70,1);
  w(9,'$LUNITS');w(70,2);
  w(9,'$LUPREC');w(70,4);
  w(0,'ENDSEC');
  w(0,'SECTION');w(2,'TABLES');
  w(0,'TABLE');w(2,'LTYPE');w(70,1);w(0,'LTYPE');w(2,'CONTINUOUS');w(70,0);w(3,'Solid line');w(72,65);w(73,0);w(40,0);w(0,'ENDTAB');
  w(0,'TABLE');w(2,'STYLE');w(70,1);w(0,'STYLE');w(2,'STANDARD');w(70,0);w(40,0);w(41,1);w(50,0);w(71,0);w(42,.2);w(3,'txt');w(4,'');w(0,'ENDTAB');
  w(0,'TABLE');w(2,'LAYER');w(70,Math.max(1,LY.length));
  if(!LY.length){w(0,'LAYER');w(2,'0');w(70,0);w(62,7);w(6,'CONTINUOUS')}
  LY.forEach((l,i)=>{w(0,'LAYER');w(2,lnames[i]);w(70,l.lock?4:0);w(62,l.vis===0?-aci(l.col):aci(l.col));w(6,'CONTINUOUS')});
  w(0,'ENDTAB');w(0,'ENDSEC');
  shapes.forEach(s=>{if(s&&(s.t==='door'||s.t==='win'||s.t==='furn'))makeCompositeBlock(s)});
  if(blockDefs.length){w(0,'SECTION');w(2,'BLOCKS');blockDefs.forEach(B=>{for(let i=0;i<B.length;i+=2)w(B[i],B[i+1])});w(0,'ENDSEC')}
  w(0,'SECTION');w(2,'ENTITIES');
  shapes.forEach(s=>{
    if(!s||typeof s!=='object')return;
    if(s.t==='line')line(s,s.a,s.b);
    else if(s.t==='wall'){
      const L=len(s);if(L>1e-9){const ux=(s.b[0]-s.a[0])/L,uy=(s.b[1]-s.a[1])/L,h=(s.th||.2)/2,nx=-uy*h,ny=ux*h;
      poly(s,[[s.a[0]+nx,s.a[1]+ny],[s.b[0]+nx,s.b[1]+ny],[s.b[0]-nx,s.b[1]-ny],[s.a[0]-nx,s.a[1]-ny]],true)}
    }
    else if(s.t==='rect')poly(s,rc(s),true);
    else if(s.t==='circle')circ(s,[s.x,s.y],s.r);
    else if(s.t==='ellipse'){ent('ELLIPSE',s);const major=Math.max(s.rx,s.ry),minor=Math.min(s.rx,s.ry),ang=(s.rot||0)+(s.ry>s.rx?Math.PI/2:0);P3(10,[s.x,s.y]);w(11,n(major*Math.cos(ang)));w(21,n(-major*Math.sin(ang)));w(31,0);w(40,n(minor/major));w(41,0);w(42,Math.PI*2)}
    else if(s.t==='polyline')poly(s,s.p,false);
    else if(s.t==='polygon')poly(s,s.p,true);
    else if(s.t==='arc'){ent('ARC',s);P3(10,[s.x,s.y]);w(40,n(s.r));let a0=-s.a1*180/Math.PI,a1=-s.a0*180/Math.PI;while(a0<0)a0+=360;while(a0>=360)a0-=360;while(a1<0)a1+=360;while(a1>=360)a1-=360;if(a1<=a0)a1+=360;w(50,n(a0));w(51,n(a1))}
    else if(s.t==='tri')poly(s,s.p,true);
    else if(s.t==='free'&&s.p&&s.p.length>1)poly(s,s.p,false);
    else if(s.t==='dim'&&dimValue(s)>1e-6){
      const d=dimPts(s),p=d[0],q=d[1];line(s,s.a,p);line(s,s.b,q);line(s,p,q);
      let ang=Math.atan2(q[1]-p[1],q[0]-p[0]);if(ang>Math.PI/2||ang<-Math.PI/2)ang+=Math.PI;
      const str=dimText(s),h=.15,ux=Math.cos(ang),uy=Math.sin(ang),tw=str.length*h*.55,m=[(p[0]+q[0])/2,(p[1]+q[1])/2];
      txt(s,[m[0]-ux*tw/2+uy*h*.35,m[1]-uy*tw/2-ux*h*.35],h,ang,str);
    }
    else if(s.t==='text'){const b=nb(s),a=s.a||0,u=[Math.cos(a),Math.sin(a)],dn=[-Math.sin(a),Math.cos(a)];txt(s,[s.x-u[0]*b.w/2+dn[0]*s.h*.35,s.y-u[1]*b.w/2+dn[1]*s.h*.35],s.h,a,s.txt||'')}
    else if(s.t==='north'){const r=s.h/2,a=s.a||0,c=[s.x,s.y],T=(u,v)=>rot(c,a,u,v);circ(s,c,r);poly(s,[T(0,-.9*r),T(.35*r,.6*r),T(0,.25*r),T(-.35*r,.6*r)],true);txt(s,T(-.15*r,-1.55*r),r*.5,a,'N')}
    else if(s.t==='door'||s.t==='win'){
      const name=makeCompositeBlock(s);insert(s,name,s.x,s.y,s.a||0);
    }
    else if(s.t==='furn'){
      const name=makeCompositeBlock(s);insert(s,name,s.x+s.w/2,s.y+s.h/2,s.rot||0);
    }
  });
  w(0,'ENDSEC');w(0,'EOF');
  return D.join('\r\n')+'\r\n';
}

async function exportDXF(){
  let txt;try{txt=dxfBuild()}catch(e){toast('تعذّر إنشاء ملف DXF');return}
  const nm=pname().replace(/[^\p{L}\p{N} _.()-]+/gu,'').trim()||'plan';
  let r=await saveBlob(nm+'.dxf',new Blob([txt],{type:'application/dxf'}));
  if(r==='ext'){r=await saveBlob(nm+'.dxf.txt',new Blob([txt],{type:'text/plain'}));if(r==='ok')toast('حُفظ باسم ‎.dxf.txt — غيّر الامتداد إلى dxf قبل فتحه في أوتوكاد');return}
  if(r==='ok')toast('تم حفظ ملف DXF');else if(r==='err')toast('الحفظ غير متاح هنا');
}

function dxfEntities(txt){
  txt=String(txt??'').replace(/^\uFEFF/,'');
  if(txt.length>50000000)throw new Error('ملف DXF أكبر من الحد المسموح (50 MB)');
  if(txt.startsWith('AutoCAD Binary DXF'))throw new Error('DXF الثنائي غير مدعوم؛ استخدم DXF ASCII');
  const a=txt.replace(/\r\n?/g,'\n').split('\n'),P=[];
  for(let i=0;i+1<a.length;){
    // لا نتجاوز قيمة فارغة؛ بعض حقول DXF (مثل STYLE group 4) قيمتها فارغة عمدًا.
    const code=Number.parseInt(a[i].trim(),10);
    if(!Number.isInteger(code)||code<0||code>1071)throw new Error('بنية DXF غير صالحة عند السطر '+(i+1));
    P.push([code,a[i+1].trim()]);i+=2;
  }
  if(!P.length)throw new Error('ملف DXF فارغ');
  const E=[];E.layers=new Map();E.meta={insunits:null,acadver:null};
  E.blocks=new Map();
  let section='',table='',cur=null,blockName=null;
  for(let i=0;i<P.length;i++){
    const [c,v]=P[i];
    if(c===0&&v==='SECTION'){section=P[i+1]?.[1]||'';table='';cur=null;i++;continue}
    if(c===0&&v==='ENDSEC'){section='';table='';cur=null;continue}
    if(section==='HEADER'){
      if(c===9){
        const key=v;let q=null;
        for(let j=i+1;j<P.length&&P[j][0]!==9;j++){if((key==='$INSUNITS'&&P[j][0]===70)||(key==='$ACADVER'&&P[j][0]===1)){q=P[j];break}}
        if(q){if(key==='$INSUNITS')E.meta.insunits=Number(q[1]);if(key==='$ACADVER')E.meta.acadver=q[1]}
      }
    }else if(section==='TABLES'){
      if(c===0&&v==='TABLE'){table=P[i+1]?.[1]||'';i++}
      else if(c===0&&v==='ENDTAB'){table='';cur=null}
      else if(c===0&&v==='LAYER'&&table==='LAYER'){cur={name:'0',color:7}}
      else if(cur&&table==='LAYER'){
        if(c===2){if(E.layers.get('0')===cur&&cur.name==='0')E.layers.delete('0');cur.name=v;if(!E.layers.has(v))E.layers.set(v,cur)}
        else if(c===62)cur.color=Number(v);
        else if(c===70)cur.flags=Number(v);
      }
    }else if(section==='BLOCKS'){
      if(c===0&&v==='BLOCK'){blockName=P[i+1]?.[1]||'';E.blocks.set(blockName,[]);cur={t:'BLOCK',p:[]};i++}
      else if(c===0&&v==='ENDBLK'){blockName=null;cur=null}
      else if(c===0&&cur){cur={t:v,p:[]};if(blockName)E.blocks.get(blockName).push(cur)}
      else if(cur)cur.p.push([c,v]);
    }else if(section==='ENTITIES'){
      if(c===0){if(v==='EOF')break;cur={t:v,p:[]};E.push(cur)}
      else if(cur)cur.p.push([c,v]);
    }
  }
  if(!E.length)throw new Error('لم يتم العثور على عناصر في قسم ENTITIES');
  return E;
}

function dxfShapes(E,k){
  const out=[],lm=new Map(),skip={},BS=String.fromCharCode(92),COL={1:'#dc2626',2:'#ca8a04',3:'#16a34a',4:'#0d9488',5:'#2563eb',6:'#9333ea',8:'#6b7280',30:'#ea580c'};
  const layerColor=nm=>E.layers?.get(nm)?.color||7;
  const lay=nm=>{
    nm=String(nm||'0').slice(0,64);
    if(!lm.has(nm)){const ac=layerColor(nm);lm.set(nm,{id:uid(),name:nm,vis:ac<0?0:1,lock:0,col:COL[Math.abs(ac)]})}
    return lm.get(nm).id;
  };
  (E.layers||new Map()).forEach((v,nm)=>lay(nm));
  const g=(e,c,d)=>{const q=e.p.find(z=>z[0]===c);return q?q[1]:d};
  const all=(e,c)=>e.p.filter(z=>z[0]===c).map(z=>z[1]);
  const N=(e,c)=>{const v=Number.parseFloat(g(e,c,0));return Number.isFinite(v)?v:0};
  const X=v=>v*k,Y=v=>-v*k;
  // فك ترميز الأبعاد المخزنة في أسماء كتل MelkiCAD؛ يجب أن تكون الدالة
  // ضمن نطاق dxfShapes لأن dxfBuild يملك نطاقًا مستقلاً.
  const decNum=v=>Number(String(v??'').replace(/M/g,'-').replace(/P/g,'.'));
  const dec=s=>String(s??'').replace(/\\U\+([0-9A-Fa-f]{4})/g,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\P/g,' ').replace(/\\[A-Za-z][^;]*;/g,'').replace(/[{}]/g,'').replace(/%%d/gi,'°').replace(/%%p/gi,'±').replace(/%%c/gi,'⌀');
  const mk=(o,e)=>{
    if(out.length>=30000)return;
    o.ly=lay(g(e,8,'0'));
    const raw=g(e,62,null);
    // لون الطبقة يبقى موروثًا من الطبقة؛ لا نحوله إلى لون مستقل للعنصر.
    if(raw!==null&&Number(raw)!==256){const c=COL[Math.abs(Number(raw))];if(c)o.col=c}
    o.lw=1.5;out.push(o);
  };
  const eq=(a,b)=>Math.abs(a-b)<1e-5;
  const sampleBulge=(a,b,bulge)=>{
    if(!bulge||Math.abs(bulge)<1e-9)return[[X(b[0]),Y(b[1])]];
    const dx=b[0]-a[0],dy=b[1]-a[1],ch=Math.hypot(dx,dy),theta=4*Math.atan(bulge);
    if(ch<1e-9)return[];
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],off=ch*(1-bulge*bulge)/(4*bulge),cx=mid[0]-dy/ch*off,cy=mid[1]+dx/ch*off;
    const aa=Math.atan2(a[1]-cy,a[0]-cx),r=Math.hypot(a[0]-cx,a[1]-cy),n=Math.max(2,Math.min(48,Math.ceil(Math.abs(theta)/(Math.PI/18)))),pts=[];
    for(let j=1;j<=n;j++){const t=aa+theta*j/n;pts.push([X(cx+r*Math.cos(t)),Y(cy+r*Math.sin(t))])}
    return pts;
  };
  const polyShape=(pts,closed,e)=>{
    if(pts.length<2)return;
    if(closed&&pts.length===4){
      const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
      if((eq(pts[0][0],pts[1][0])&&eq(pts[1][1],pts[2][1])&&eq(pts[2][0],pts[3][0])&&eq(pts[3][1],pts[0][1]))||(eq(pts[0][1],pts[1][1])&&eq(pts[1][0],pts[2][0])&&eq(pts[2][1],pts[3][1])&&eq(pts[3][0],pts[0][0]))){
        const x=Math.min(...xs),y=Math.min(...ys);mk({t:'rect',x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y},e);return;
      }
    }
    if(closed&&pts.length===3){mk({t:'tri',p:pts},e);return}
    if(!closed&&pts.length===2){mk({t:'line',a:pts[0],b:pts[1]},e);return}
    mk({t:closed?'polygon':'polyline',p:pts},e);
  };
  const arc=(cx,cy,r,a0,a1,e)=>{
    const start=-a1*Math.PI/180,end=-a0*Math.PI/180;
    let aEnd=end;while(aEnd<=start)aEnd+=Math.PI*2;
    mk({t:'arc',x:X(cx),y:Y(cy),r:Math.abs(X(r)),a0:start,a1:aEnd},e);
  };
  for(let i=0;i<E.length&&out.length<30000;i++){
    const e=E[i];
    if(e.t==='INSERT'){
      const name=g(e,2,'');
      if(name.startsWith('MKD_D_')){const q=name.split('_');if(q.length===6){const w=decNum(q[2]),th=decNum(q[3]),f=decNum(q[4]),h=decNum(q[5]);if(w>0)mk({t:'door',x:X(N(e,10)),y:Y(N(e,20)),w,th,f,h,a:-N(e,50)*Math.PI/180},e);else skip.INSERT=(skip.INSERT||0)+1}else skip.INSERT=(skip.INSERT||0)+1}
      else if(name.startsWith('MKD_W_')){const q=name.split('_');if(q.length===4){const w=decNum(q[2]),th=decNum(q[3]);if(w>0)mk({t:'win',x:X(N(e,10)),y:Y(N(e,20)),w,th,h:1,a:-N(e,50)*Math.PI/180},e);else skip.INSERT=(skip.INSERT||0)+1}else skip.INSERT=(skip.INSERT||0)+1}
      else if(name.startsWith('MKD_F_')){const q=name.split('_');if(q.length===5){const k=q[2],w=decNum(q[3]),h=decNum(q[4]),a=-N(e,50)*Math.PI/180;if(w>0&&h>0)mk({t:'furn',k,x:X(N(e,10))-w/2,y:Y(N(e,20))-h/2,w,h,rot:a},e);else skip.INSERT=(skip.INSERT||0)+1}else skip.INSERT=(skip.INSERT||0)+1}
      else skip.INSERT=(skip.INSERT||0)+1;
    }
    else if(e.t==='LINE')mk({t:'line',a:[X(N(e,10)),Y(N(e,20))],b:[X(N(e,11)),Y(N(e,21))]},e);
    else if(e.t==='CIRCLE')mk({t:'circle',x:X(N(e,10)),y:Y(N(e,20)),r:Math.abs(X(N(e,40)))},e);
    else if(e.t==='ARC')arc(N(e,10),N(e,20),Math.abs(N(e,40)),N(e,50),N(e,51),e);
    else if(e.t==='LWPOLYLINE'){
      const verts=[];let cur=null;
      e.p.forEach(([c,v])=>{
        if(c===10){if(cur)verts.push(cur);cur={x:Number(v)||0,y:0,b:0,hasY:false}}
        else if(c===20&&cur){cur.y=Number(v)||0;cur.hasY=true}
        else if(c===42&&cur)cur.b=Number(v)||0;
      });
      if(cur)verts.push(cur);
      const closed=(Number(g(e,70,0))&1)!==0,pts=[];
      for(let j=0;j<verts.length;j++){
        const a=verts[j],b=verts[(j+1)%verts.length];pts.push([X(a.x),Y(a.y)]);
        if((j<verts.length-1||closed)&&a.b)pts.push(...sampleBulge([a.x,a.y],[b.x,b.y],a.b));
      }
      polyShape(pts,closed,e);
    }
    else if(e.t==='POLYLINE'){
      const verts=[];let j=i+1;
      while(j<E.length&&E[j].t==='VERTEX'){verts.push({x:Number(g(E[j],10,0))||0,y:Number(g(E[j],20,0))||0,b:Number(g(E[j],42,0))||0});j++}
      if(j<E.length&&E[j].t==='SEQEND')j++;
      i=j-1;
      const closed=(Number(g(e,70,0))&1)!==0,pts=[];
      for(let q=0;q<verts.length;q++){const a=verts[q],b=verts[(q+1)%verts.length];pts.push([X(a.x),Y(a.y)]);if((q<verts.length-1||closed)&&a.b)pts.push(...sampleBulge([a.x,a.y],[b.x,b.y],a.b))}
      polyShape(pts,closed,e);
    }
    else if(e.t==='DIMENSION'){
      const kind=Number(g(e,70,0))&7;
      const has=[13,23,14,24,10,20].every(c=>g(e,c,null)!==null);
      if((kind===0||kind===1)&&has){
        const a=[X(N(e,13)),Y(N(e,23))],b=[X(N(e,14)),Y(N(e,24))],d=[X(N(e,10)),Y(N(e,20))],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
        if(L>1e-9){const off=((d[0]-a[0])*(-dy)+(d[1]-a[1])*dx)/L;mk({t:'dim',a,b,off},e)}
        else skip.DIMENSION=(skip.DIMENSION||0)+1;
      }else skip.DIMENSION=(skip.DIMENSION||0)+1;
    }
    else if(e.t==='TEXT'||e.t==='MTEXT'){
      const raw=e.t==='MTEXT'?[...all(e,3),...all(e,1)].join(''):g(e,1,'');
      const str=dec(raw).trim();if(!str)continue;
      const h=Math.abs(X(N(e,40)))||.3,a=-N(e,50)*Math.PI/180,w2=str.length*h*.55,u=[Math.cos(a),Math.sin(a)],dn=[-Math.sin(a),Math.cos(a)],ix=X(N(e,10)),iy=Y(N(e,20));
      mk({t:'text',x:ix+u[0]*w2/2-dn[0]*h*.35,y:iy+u[1]*w2/2-dn[1]*h*.35,h,a,txt:str},e);
    }
    else if(e.t==='SOLID'||e.t==='TRACE'||e.t==='3DFACE'){
      const p=[[X(N(e,10)),Y(N(e,20))],[X(N(e,11)),Y(N(e,21))],[X(N(e,12)),Y(N(e,22))],[X(N(e,13)),Y(N(e,23))]];
      if(eq(p[2][0],p[3][0])&&eq(p[2][1],p[3][1]))p.pop();
      polyShape(p,true,e);
    }
    else if(e.t==='ELLIPSE'){
      const cx=N(e,10),cy=N(e,20),mx=N(e,11),my=N(e,21),ratio=Math.abs(N(e,40)),a0=N(e,41),a1=N(e,42)||Math.PI*2,major=Math.hypot(mx,my);
      if(major>0&&ratio>0){let end=a1;if(end<=a0)end+=Math.PI*2;if(Math.abs((end-a0)-Math.PI*2)<1e-4){mk({t:'ellipse',x:X(cx),y:Y(cy),rx:Math.abs(X(major)),ry:Math.abs(X(major*ratio)),rot:Math.atan2(-my,mx)},e)}else{const count=Math.max(12,Math.min(144,Math.ceil((end-a0)*24))),p=[];for(let j=0;j<=count;j++){const t=a0+(end-a0)*j/count,xx=major*Math.cos(t),yy=major*ratio*Math.sin(t);const x=cx+xx*mx/major-yy*my/major,y=cy+xx*my/major+yy*mx/major;p.push([X(x),Y(y)])}polyShape(p,false,e)}}
    }
    else if(e.t==='SPLINE'){
      const xs=all(e,10).map(Number),ys=all(e,20).map(Number),p=[];for(let j=0;j<Math.min(xs.length,ys.length);j++)p.push([X(xs[j]),Y(ys[j])]);polyShape(p,(Number(g(e,70,0))&1)!==0,e);
    }
    else if(e.t!=='VERTEX'&&e.t!=='SEQEND'&&e.t!=='ENDSEC')skip[e.t]=(skip[e.t]||0)+1;
  }
  const LYs=[...lm.values()];if(!LYs.length)LYs.push({id:uid(),name:'طبقة 1',vis:1,lock:0});
  return{shapes:out,LY:LYs,skip,meta:E.meta||{}};
}
// ضبط مجال العرض بعد استيراد DXF: نعتمد حدود الهندسة ونستبعد النصوص
// من حساب التكبير حتى لا يبعد نص شارد المخطط عن الشاشة.
function fitImportedView(items){
  const geom=items.filter(s=>s.t!=='text'&&s.t!=='north');
  const use=geom.length?geom:items;
  if(!use.length)return;
  const B=use.map(bx),x0=Math.min(...B.map(b=>b.x)),x1=Math.max(...B.map(b=>b.X)),
    y0=Math.min(...B.map(b=>b.y)),y1=Math.max(...B.map(b=>b.Y));
  const cx=(x0+x1)/2,cy=(y0+y1)/2;
  const sw=Math.max(x1-x0,.5),sh=Math.max(y1-y0,.5);
  const aw=Math.max(120,W-100),ah=Math.max(120,H-100);
  V.s=clamp(Math.min(aw/sw,ah/sh),4,160);
  V.x=W/2-cx*V.s;
  V.y=H/2-cy*V.s;
}

function dxfImport(txt){
  const E=dxfEntities(txt),meta=E.meta||{},probe=dxfShapes(E,1);
  if(!probe.shapes.length){toast('لا توجد أشكال مدعومة في الملف');return}
  const R=probe.shapes.map(bx),ext=Math.max(Math.max(...R.map(q=>q.X))-Math.min(...R.map(q=>q.x)),Math.max(...R.map(q=>q.Y))-Math.min(...R.map(q=>q.y)));
  const units={1:.0254,2:.3048,4:.001,5:.01,6:1,7:1000,10:.9144,14:.1};
  const labels={1:'بوصة',2:'قدم',4:'مليمتر',5:'سنتيمتر',6:'متر',7:'كيلومتر',10:'ياردة',14:'ديسيمتر'};
  const hasUnit=Object.prototype.hasOwnProperty.call(units,meta.insunits);
  let u=hasUnit?units[meta.insunits]:(ext>3000?.001:ext>300?.01:1);
  const choices=[[1,'متر'],[.01,'سنتيمتر'],[.001,'مليمتر'],[.0254,'بوصة'],[.3048,'قدم'],[.9144,'ياردة'],[.1,'ديسيمتر'],[1000,'كيلومتر']];
  const sh=$('#sheet'),sk=Object.entries(probe.skip).map(([t,c])=>`${t}×${c}`).join(' ');
  sh.innerHTML='<b>استيراد DXF</b><div id="dxi" style="color:var(--dim);font-size:12px"></div><b>وحدة القياس في الملف</b><div class="chips" id="dxu">'+choices.map(([v,l])=>`<button class="chip${Math.abs(v-u)<1e-9?' on':''}" data-v="${v}">${l}</button>`).join('')+'</div><div class="row"><button class="fl" id="dxx">إلغاء</button><button class="fl" id="opk">استيراد</button></div>';
  const info=()=>{$('#dxi').textContent=`${probe.shapes.length} عنصر مدعوم · ${hasUnit?'الوحدة المعلنة في DXF: '+(labels[meta.insunits]||'غير شائعة'):'لم يحدد الملف وحدة القياس؛ تم تقديرها مبدئيًا'} · الحجم بعد التحويل ≈ ${f(ext*u)} م${sk?' · عناصر متجاهلة: '+sk:''}`};
  info();
  sh.querySelectorAll('#dxu .chip').forEach(b=>{b.onclick=()=>{u=+b.dataset.v;sh.querySelectorAll('#dxu .chip').forEach(x=>x.classList.toggle('on',x===b));info()}});
  $('#dxx').onclick=()=>{sh.classList.remove('on');upd()};
  $('#opk').onclick=()=>{const r=dxfShapes(E,u);sh.classList.remove('on');newP('DXF',r.shapes,{LY:r.LY,cl:r.LY[0].id});fitImportedView(r.shapes);save();draw();toast(`تم استيراد ${r.shapes.length} عنصرًا من DXF`)};
  sh.classList.add('on');$('#ctx').style.display='none';
}
