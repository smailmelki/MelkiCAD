/* ==================================================================
 * 18a-pdf.js
 * PDF متجهي: مسجِّل يحاكي واجهة Canvas 2D التي يستعملها الرسم ويكتب عوامل PDF بدل البكسلات،
 * فيعيد التصدير استعمال كود الرسم نفسه (renderSheet) دون تكرار. الهندسة متجهية بالكامل،
 * أما النصوص فتُرسَم صورًا عالية الدقة بقناع شفافية لأن تشكيل العربية يحتاج خطًا مضمّنًا.
 *
 * الواجهة المدعومة هي ما يستعمله الرسم فقط: المسارات (moveTo وlineTo وarc وellipse وrect وbezierCurveTo
 * وclosePath) وstroke وfill وclip وfillRect وstrokeRect وfillText وstrokeText وmeasureText وsave وrestore
 * وtranslate وrotate وscale وtransform وsetTransform وsetLineDash. أي طريقة أخرى ترمي TypeError،
 * ويتحوّل التصدير حينها إلى مسار JPEG القديم (انظر doExport).
 *
 * يعرّف: PdfPath، PdfRecorder، pdfParseColor، pdfArcSegments، pdfRasterizeText، pdfDeflate
 * يعتمد على: لا شيء (يستدعيه 18-print.js)
 * ================================================================== */

const PDF_TAU=Math.PI*2;
const PDF_NAMED={black:[0,0,0],white:[255,255,255],red:[255,0,0],green:[0,128,0],blue:[0,0,255],gray:[128,128,128],grey:[128,128,128],transparent:[0,0,0,0]};

// لون CSS ← [r,g,b,a] (a بين 0 و1)، أو null إن لم يُفهم
function pdfParseColor(s){
  s=String(s??'').trim().toLowerCase();
  let m;
  if((m=/^#([0-9a-f]{3,8})$/.exec(s))){
    let h=m[1];
    if(h.length===3||h.length===4)h=[...h].map(c=>c+c).join('');
    if(h.length===6||h.length===8){
      const n=i=>parseInt(h.slice(i,i+2),16);
      return[n(0),n(2),n(4),h.length===8?n(6)/255:1];
    }
  }
  if((m=/^rgba?\(([^)]+)\)$/.exec(s))){
    const t=m[1].split(/[\s,\/]+/).filter(Boolean);
    const v=t.slice(0,3).map(x=>x.endsWith('%')?parseFloat(x)*2.55:parseFloat(x));
    const a=t[3]===undefined?1:t[3].endsWith('%')?parseFloat(t[3])/100:parseFloat(t[3]);
    if(v.length===3&&v.every(Number.isFinite)&&Number.isFinite(a)){
      return[...v.map(x=>Math.max(0,Math.min(255,Math.round(x)))),Math.max(0,Math.min(1,a))];
    }
  }
  if(PDF_NAMED[s]){const c=PDF_NAMED[s];return[c[0],c[1],c[2],c[3]??1]}
  return null;
}

// قوس على دائرة الوحدة ← مقاطع بيزيه تكعيبية [x1,y1,x2,y2,x3,y3]؛ زوايا Canvas نفسها (بما فيها ≥ 2π = دائرة كاملة)
function pdfArcSegments(a0,a1,ccw){
  let d=a1-a0;
  if(!ccw)d=d>=PDF_TAU?PDF_TAU:((d%PDF_TAU)+PDF_TAU)%PDF_TAU;
  else d=-d>=PDF_TAU?-PDF_TAU:-(((-d%PDF_TAU)+PDF_TAU)%PDF_TAU);
  const n=Math.ceil(Math.abs(d)/(Math.PI/2)-1e-9),out=[];
  if(!n)return out;
  const da=d/n,k=4/3*Math.tan(da/4);
  for(let i=0;i<n;i++){
    const t1=a0+da*i,t2=t1+da,c1=Math.cos(t1),s1=Math.sin(t1),c2=Math.cos(t2),s2=Math.sin(t2);
    out.push([c1-k*s1,s1+k*c1,c2+k*s2,s2-k*c2,c2,s2]);
  }
  return out;
}

// مسار: بلا tf = إحداثيات محلية تُحوَّل بمصفوفة اللحظة عند الرسم (كـ Path2D)،
// ومع tf = تُحوَّل النقاط لحظة إضافتها (كالمسار الضمني في ctx.beginPath)
class PdfPath{
  constructor(tf){this.ops=[];this.tf=tf||null;this.has=false;this.sx=0;this.sy=0}
  _p(x,y){const m=this.tf&&this.tf();return m?[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]:[x,y]}
  moveTo(x,y){const p=this._p(x,y);this.ops.push(['M',p[0],p[1]]);this.sx=p[0];this.sy=p[1];this.has=true}
  lineTo(x,y){if(!this.has){this.moveTo(x,y);return}const p=this._p(x,y);this.ops.push(['L',p[0],p[1]])}
  bezierCurveTo(x1,y1,x2,y2,x,y){
    if(!this.has)this.moveTo(x1,y1);
    const a=this._p(x1,y1),b=this._p(x2,y2),c=this._p(x,y);
    this.ops.push(['C',a[0],a[1],b[0],b[1],c[0],c[1]]);
  }
  closePath(){if(this.has)this.ops.push(['Z'])}
  rect(x,y,w,h){this.moveTo(x,y);this.lineTo(x+w,y);this.lineTo(x+w,y+h);this.lineTo(x,y+h);this.closePath()}
  ellipse(x,y,rx,ry,rot,a0,a1,ccw){
    if(rx<0||ry<0)throw new RangeError('نصف قطر سالب');
    const ct=Math.cos(rot),st=Math.sin(rot),T=(u,v)=>[x+rx*u*ct-ry*v*st,y+rx*u*st+ry*v*ct];
    const s0=T(Math.cos(a0),Math.sin(a0));
    if(this.has)this.lineTo(s0[0],s0[1]);else this.moveTo(s0[0],s0[1]);
    for(const g of pdfArcSegments(a0,a1,!!ccw)){
      const p1=T(g[0],g[1]),p2=T(g[2],g[3]),p3=T(g[4],g[5]);
      this.bezierCurveTo(p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]);
    }
  }
  arc(x,y,r,a0,a1,ccw){if(r<0)throw new RangeError('نصف قطر سالب');this.ellipse(x,y,r,r,0,a0,a1,ccw)}
}

// نص ← قناع شفافية عالي الدقة (K ضعف دقة اللوحة). يعيد null إن تعذّر.
// الأصل (x,y) يقع عند (px,py) داخل الصورة بغضّ النظر عن المحاذاة والاتجاه واللاصقة.
function pdfRasterizeText(a){
  if(typeof document==='undefined')return null;
  const sz=/(\d*\.?\d+)px/.exec(a.font);if(!sz)return null;
  let K=a.K;
  for(let pass=0;pass<2;pass++){
    const c=document.createElement('canvas'),g=c.getContext('2d');if(!g)return null;
    g.font=a.font.replace(sz[0],parseFloat(sz[1])*K+'px');g.textAlign=a.align;g.textBaseline=a.baseline;g.direction=a.dir;
    const m=g.measureText(a.text),pad=Math.ceil((a.mode==='stroke'?a.lineWidth*K/2:0)+2);
    const L=m.actualBoundingBoxLeft,R=m.actualBoundingBoxRight,A=m.actualBoundingBoxAscent,D=m.actualBoundingBoxDescent;
    if(![L,R,A,D].every(Number.isFinite))return null;
    const w=Math.ceil(L+R)+2*pad,h=Math.ceil(A+D)+2*pad;
    if(w<=2*pad||h<=2*pad)return null;
    if(w*h>3e6&&pass===0){K*=Math.sqrt(3e6/(w*h));continue}
    c.width=w;c.height=h;
    // تغيير الأبعاد يصفّر الحالة، فنعيد ضبطها
    g.font=a.font.replace(sz[0],parseFloat(sz[1])*K+'px');g.textAlign=a.align;g.textBaseline=a.baseline;g.direction=a.dir;
    const px=pad+L,py=pad+A,mw=a.maxWidth===undefined?undefined:a.maxWidth*K;
    g.fillStyle=g.strokeStyle='#000';
    if(a.mode==='stroke'){g.lineWidth=a.lineWidth*K;g.lineJoin=a.lineJoin;mw===undefined?g.strokeText(a.text,px,py):g.strokeText(a.text,px,py,mw)}
    else mw===undefined?g.fillText(a.text,px,py):g.fillText(a.text,px,py,mw);
    const d=g.getImageData(0,0,w,h).data,al=new Uint8Array(w*h);
    for(let i=0;i<al.length;i++)al[i]=d[i*4+3];
    return{w,h,px,py,K,alpha:al};
  }
  return null;
}

// ضغط zlib (FlateDecode) عبر CompressionStream إن وُجد، وإلا null فيُكتب الدفق بلا ضغط
async function pdfDeflate(u8){
  if(typeof CompressionStream==='undefined'||typeof Response==='undefined')return null;
  try{
    const s=new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }catch(e){return null}
}

const pdfNum=v=>{v=+v;return Number.isFinite(v)?String(Math.round(v*1000)/1000):'0'};

class PdfRecorder{
  // pxW×pxH: أبعاد لوحة الرسم بالبكسل، wMm×hMm: حجم الورقة الحقيقي
  constructor(pxW,pxH,wMm,hMm,opt){
    this.opt=opt||{};this.W=wMm/25.4*72;this.H=hMm/25.4*72;
    this.m=[1,0,0,1,0,0];this.stack=[];this.gs=new Map();this.imgs=[];this.warn=new Set();this.cur='';
    this.fillStyle='#000000';this.strokeStyle='#000000';this.lineWidth=1;this.globalAlpha=1;this.lineCap='butt';this.lineJoin='miter';
    this.font='10px sans-serif';this.textAlign='start';this.textBaseline='alphabetic';this.direction='ltr';this._dash=[];
    this.path=new PdfPath(()=>this.m);
    // قاعدة الصفحة: بكسلات اللوحة (y لأسفل) ← نقاط PDF (y لأعلى)
    this.out=[`q ${this.W/pxW} 0 0 ${-this.H/pxH} 0 ${this.H} cm`];this.depth=1;
  }
  // ---- الحالة ----
  save(){
    this.stack.push({m:this.m.slice(),dash:this._dash.slice(),cur:this.cur,
      s:[
        this.fillStyle,
        this.strokeStyle,
        this.lineWidth,
        this.globalAlpha,
        this.lineCap,
        this.lineJoin,
        this.font,
        this.textAlign,
        this.textBaseline,
        this.direction
      ]});
    this.out.push('q');this.depth++;
  }
  restore(){
    const z=this.stack.pop();if(!z)return;
    this.m=z.m;this._dash=z.dash;this.cur=z.cur;
    [this.fillStyle,this.strokeStyle,this.lineWidth,this.globalAlpha,this.lineCap,this.lineJoin,this.font,this.textAlign,this.textBaseline,this.direction]=z.s;
    this.out.push('Q');this.depth--;
  }
  setLineDash(a){
    a=Array.from(a||[]);
    if(a.every(v=>Number.isFinite(v)&&v>=0))this._dash=a;
  }
  // ---- التحويلات (كما في Canvas: M = M × T) ----
  transform(a,b,c,d,e,f){
    const m=this.m;
    this.m=[m[0]*a+m[2]*b,m[1]*a+m[3]*b,m[0]*c+m[2]*d,m[1]*c+m[3]*d,m[0]*e+m[2]*f+m[4],m[1]*e+m[3]*f+m[5]];
  }
  setTransform(a,b,c,d,e,f){this.m=[a,b,c,d,e,f]}
  resetTransform(){this.m=[1,0,0,1,0,0]}
  translate(x,y){this.transform(1,0,0,1,x,y)}
  scale(x,y){this.transform(x,0,0,y,0,0)}
  rotate(r){const c=Math.cos(r),s=Math.sin(r);this.transform(c,s,-s,c,0,0)}
  // ---- المسار الضمني ----
  beginPath(){this.path=new PdfPath(()=>this.m)}
  moveTo(x,y){this.path.moveTo(x,y)}
  lineTo(x,y){this.path.lineTo(x,y)}
  bezierCurveTo(a,b,c,d,e,f){this.path.bezierCurveTo(a,b,c,d,e,f)}
  closePath(){this.path.closePath()}
  rect(x,y,w,h){this.path.rect(x,y,w,h)}
  arc(x,y,r,a0,a1,ccw){this.path.arc(x,y,r,a0,a1,ccw)}
  ellipse(x,y,rx,ry,rot,a0,a1,ccw){this.path.ellipse(x,y,rx,ry,rot,a0,a1,ccw)}
  // ---- الرسم ----
  _scale(){const m=this.m;return Math.sqrt(Math.abs(m[0]*m[3]-m[1]*m[2]))}
  _col(style){
    const c=pdfParseColor(style);
    if(!c){this.warn.add(String(style));return[0,0,0,1]}
    return c;
  }
  _gsName(alpha){
    const k=Math.round(Math.max(0,Math.min(1,alpha))*1000)/1000;
    let n=this.gs.get(k);if(!n){n='GS'+this.gs.size;this.gs.set(k,n)}
    return n;
  }
  // يكتب حالة الرسم (لون وشفافية، وللخط العرض والنهايات والتقطيع)؛ يعيد false إن كان غير مرئي
  _paintState(stroke){
    const c=this._col(stroke?this.strokeStyle:this.fillStyle),a=c[3]*this.globalAlpha;
    if(a<=0)return false;
    let s=`/${this._gsName(a)} gs ${c.slice(0,3).map(v=>pdfNum(v/255)).join(' ')} ${stroke?'RG':'rg'}`;
    if(stroke){
      const k=this._scale(),cap={butt:0,round:1,square:2}[this.lineCap]??0,jn={miter:0,round:1,bevel:2}[this.lineJoin]??0;
      s+=` ${pdfNum(this.lineWidth*k)} w ${cap} J ${jn} j [${this._dash.map(v=>pdfNum(v*k)).join(' ')}] 0 d`;
    }
    if(this.cur!==s){this.cur=s;this.out.push(s)}
    return true;
  }
  _pathStr(p){
    const t=p.tf?null:this.m,P=(x,y)=>t?[t[0]*x+t[2]*y+t[4],t[1]*x+t[3]*y+t[5]]:[x,y],f=q=>pdfNum(q[0])+' '+pdfNum(q[1]);
    return p.ops.map(o=>o[0]==='M'?f(P(o[1],o[2]))+' m':o[0]==='L'?f(P(o[1],o[2]))+' l'
      :o[0]==='C'?f(P(o[1],o[2]))+' '+f(P(o[3],o[4]))+' '+f(P(o[5],o[6]))+' c':'h').join(' ');
  }
  stroke(p){p=p||this.path;if(p.ops.length&&this._paintState(true))this.out.push(this._pathStr(p)+' S')}
  fill(p,rule){
    if(typeof p==='string'){rule=p;p=null}
    p=p||this.path;
    if(p.ops.length&&this._paintState(false))this.out.push(this._pathStr(p)+(rule==='evenodd'?' f*':' f'));
  }
  clip(p,rule){
    if(typeof p==='string'){rule=p;p=null}
    p=p||this.path;
    if(p.ops.length)this.out.push(this._pathStr(p)+(rule==='evenodd'?' W* n':' W n'));
  }
  fillRect(x,y,w,h){const p=new PdfPath(()=>this.m);p.rect(x,y,w,h);this.fill(p)}
  strokeRect(x,y,w,h){const p=new PdfPath(()=>this.m);p.rect(x,y,w,h);this.stroke(p)}
  // ---- النص ----
  measureText(t){
    t=String(t??'');
    if(this.opt.measure)return this.opt.measure(this,t);
    if(!this._mc){const c=document.createElement('canvas');this._mc=c.getContext('2d')}
    const g=this._mc;g.font=this.font;g.textAlign=this.textAlign;g.textBaseline=this.textBaseline;g.direction=this.direction;
    return g.measureText(t);
  }
  fillText(t,x,y,maxW){this._text('fill',t,x,y,maxW)}
  strokeText(t,x,y,maxW){this._text('stroke',t,x,y,maxW)}
  _text(mode,t,x,y,maxW){
    t=String(t??'');if(!t.trim())return;
    const col=this._col(mode==='stroke'?this.strokeStyle:this.fillStyle),a=col[3]*this.globalAlpha;
    if(a<=0)return;
    const r=(this.opt.rasterize||pdfRasterizeText)({text:t,font:this.font,align:this.textAlign,baseline:this.textBaseline,dir:this.direction,
      K:this.opt.textScale||4,mode,lineWidth:this.lineWidth,lineJoin:this.lineJoin,maxWidth:maxW});
    if(!r){this.warn.add('text:'+t.slice(0,20));return}
    // وحدة الصورة (v لأعلى) ← الفضاء المحلي حيث الأصل (x,y) عند (px,py) من الصورة، ثم مصفوفة اللحظة ← الجهاز
    const k=r.K,aa=r.w/k,dd=-r.h/k,ee=x-r.px/k,ff=y+r.h/k-r.py/k,m=this.m;
    const C=[m[0]*aa,m[1]*aa,m[2]*dd,m[3]*dd,m[0]*ee+m[2]*ff+m[4],m[1]*ee+m[3]*ff+m[5]];
    this.imgs.push({w:r.w,h:r.h,alpha:r.alpha,rgb:col.slice(0,3)});
    this.out.push(`q ${this._gsName(a)?'/'+this._gsName(a)+' gs ':''}${C.map(pdfNum).join(' ')} cm /Im${this.imgs.length-1} Do Q`);
  }
  // ---- التجميع ----
  async toPdf(title){
    while(this.depth>0){this.out.push('Q');this.depth--}
    const enc=new TextEncoder(),deflate=this.opt.deflate===undefined?pdfDeflate:this.opt.deflate;
    const parts=[],offs=[];let len=0;
    const add=x=>{const b=typeof x==='string'?enc.encode(x):x;parts.push(b);len+=b.length};
    const stream=async(n,dict,data)=>{
      let body=data,f='';
      if(deflate){const z=await deflate(data);if(z&&z.length<data.length){body=z;f='/Filter/FlateDecode'}}
      offs[n]=len;add(`${n} 0 obj\n<<${dict}${f}/Length ${body.length}>>\nstream\n`);add(body);add('\nendstream\nendobj\n');
    };
    const obj=(n,body)=>{offs[n]=len;add(`${n} 0 obj\n${body}\nendobj\n`)};
    // أرقام الكائنات: 1 فهرس، 2 صفحات، 3 صفحة، 4 محتوى، 5 معلومات، ثم صورتان (لون وقناع) لكل نص
    const gsRes=[...this.gs].map(([k,n])=>`/${n}<</ca ${k}/CA ${k}>>`).join('');
    const imRes=this.imgs.map((_,i)=>`/Im${i} ${6+i*2} 0 R`).join('');
    const hex=s=>Array.from(String(s??'')).map(c=>c.codePointAt(0)).flatMap(cp=>cp>0xffff
      ?[0xD800+((cp-0x10000)>>10),0xDC00+((cp-0x10000)&1023)]
      :[cp]).map(u=>u.toString(16).padStart(4,'0')).join('');
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1,'<</Type/Catalog/Pages 2 0 R>>');
    obj(2,'<</Type/Pages/Kids[3 0 R]/Count 1>>');
    obj(
      3,
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${pdfNum(this.W)} ${pdfNum(this.H)}]/Contents 4 0 R/Resources<<${gsRes?`/ExtGState<<${gsRes}>>`:''}${imRes?`/XObject<<${imRes}>>`:''}>>>>`
    );
    await stream(4,'',enc.encode(this.out.join('\n')));
    obj(5,`<</Title<FEFF${hex(title||'')}>/Producer(MelkiCAD)>>`);
    for(let i=0;i<this.imgs.length;i++){
      const im=this.imgs[i],n=6+i*2,rowBytes=Math.ceil(im.w/8),hx=im.rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
      // لون الصورة ثابت (لوحة من مدخل واحد، بت واحد للبكسل)، والتدرّج كله في القناع
      await stream(
        n,
        `/Type/XObject/Subtype/Image/Width ${im.w}/Height ${im.h}/ColorSpace[/Indexed/DeviceRGB 0<${hx}>]/BitsPerComponent 1/SMask ${n+1} 0 R`,
        new Uint8Array(rowBytes*im.h)
      );
      await stream(n+1,`/Type/XObject/Subtype/Image/Width ${im.w}/Height ${im.h}/ColorSpace/DeviceGray/BitsPerComponent 8`,im.alpha);
    }
    const size=6+this.imgs.length*2,xr=len;
    add(`xref\n0 ${size}\n0000000000 65535 f \n`+Array.from({length:size-1},(_,i)=>String(offs[i+1]).padStart(10,'0')+' 00000 n \n').join(''));
    add(`trailer\n<</Size ${size}/Root 1 0 R/Info 5 0 R>>\nstartxref\n${xr}\n%%EOF\n`);
    const out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}
    return out;
  }
}
