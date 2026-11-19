/* ==================================================================
 * 13-draw-input.js
 * الإدخال الرقمي الاختياري للرسم: شريط صغير أسفل اللوحة يعرض الخطوة الحالية (مثل سطر الأوامر في AutoCAD). الرسم باللمس هو الأساس، وزر لوحة الأرقام يفتح حقول الإحداثيات أو الأبعاد عند الحاجة فقط.
 *
 * يعرّف: drawNames، DRAG_FLOW_TOOLS، FLOW_TAP_PX، lastPtrType، diAutoFocus، diOpen، diSetOpen، drawPointFromInputs، drawInputOpen، drawInputStage، sidesSheet،
 *        startDrawFlow، closeDrawFlow، addDrawPoint، commitSinglePoint،
 *        commitParamShape، commitPointShape، finishDrawFlow
 * يعتمد على: 01-core.js، 02-geometry.js، 03-snap.js، 05-persistence.js،
 *            09-render.js، 10-dimensions.js، 11-furniture.js، 12-openings.js،
 *            15-properties.js، 22-toolbar.js
 * ================================================================== */

// ---- الإدخال الرقمي الاختياري: الشريط مطويّ افتراضيًا (يعرض الخطوة فقط)، وزر ⌨ يفتح الحقول ----
const drawNames={
  line:'خط',
  wall:'جدار',
  dim:'بُعد',
  rect:'مستطيل',
  circle:'دائرة',
  arc:'قوس',
  ellipse:'شكل بيضاوي',
  tri:'مثلث',
  polygon:'مضلع',
  polyline:'متعدد الخطوط',
  free:'رسم حر',
  furn:'أثاث',
  text:'نص',
  north:'سهم الشمال',
  door:'باب',
  win:'نافذة'
};
// قياسات العنصر الجاري رسمه: تظهر أعلى مساحة الرسم وتتحدّث مع كل حركة للمؤشر.
function updateDrawMetrics(s){
  const el=$('#drawMetrics');
  if(!el)return;
  if(!s){el.classList.remove('on');el.textContent='';return}
  const items=[],center=(x,y)=>`المركز X ${fu(x)} ${ul()} · Y ${fu(-y)} ${ul()}`;
  if(s.t==='line'||s.t==='wall'){
    const dx=s.b[0]-s.a[0],dy=s.a[1]-s.b[1],L=Math.hypot(dx,dy),a=(deg(Math.atan2(dy,dx))+360)%360;
    items.push(`الطول ${fu(L)} ${ul()}`,`الزاوية ${f(a)}°`);
    if(s.t==='wall')items.push(`السماكة ${f(s.th*100)} سم`)
  }else if(s.t==='rect'){
    items.push(`العرض ${fu(Math.abs(s.w))} ${ul()}`,`الارتفاع ${fu(Math.abs(s.h))} ${ul()}`,center(s.x+s.w/2,s.y+s.h/2))
  }else if(s.t==='circle'){
    items.push(`نصف القطر ${fu(s.r)} ${ul()}`,center(s.x,s.y))
  }else if(s.t==='ellipse'){
    items.push(`المحور X ${fu(s.rx*2)} ${ul()}`,`المحور Y ${fu(s.ry*2)} ${ul()}`,center(s.x,s.y))
  }else if(s.t==='arc'){
    items.push(`نصف القطر ${fu(s.r)} ${ul()}`,`الزاوية ${f(deg(s.a1-s.a0))}°`,center(s.x,s.y))
  }else if(s.t==='polyline'||s.t==='free'){
    items.push(`الطول ${fu(plen(s.p))} ${ul()}`)
  }else if(s.t==='tri'||s.t==='polygon'){
    if(s.p&&s.p.length>1){const a=s.p[0],b=s.p.at(-1),closed=s.t==='polygon'||s.t==='tri';items.push(`المحيط ${fu(plen(s.p)+(closed?Math.hypot(a[0]-b[0],a[1]-b[1]):0))} ${ul()}`)}
  }
  el.textContent=items.join('   |   ');
  el.classList.toggle('on',items.length>0)
}

let diOpen=false; // يبقى مفتوحًا بين الأشكال إذا اختار المستخدم الإدخال الرقمي
// الأدوات التي يمكن رسمها بالسحب المباشر حتى والشريط الرقمي ظاهر (بقية الأدوات تعتمد على اللمس النقطي)،
// وأقصى حركة بالبكسل تُعدّ لمسة قصيرة (تثبيت النقطة الأولى) لا سحبًا.
const DRAG_FLOW_TOOLS=['line','wall','rect','circle','arc','ellipse','tri','polygon','free'];
const FLOW_TAP_PX=10;
let lastPtrType=(typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches)?'touch':'mouse'; // mouse | touch | pen: آخر مؤشر استُخدم في الصفحة كلها (أزرار الأدوات تُضغط قبل اللمس على اللوحة)
document.addEventListener('pointerdown',e=>{lastPtrType=e.pointerType||'mouse'},true);
// التركيز التلقائي على حقل الإدخال يفتح لوحة المفاتيح على الهاتف فتقطع الرسم باللمس؛ لذا لا يحدث إلا مع الفأرة،
// أو إذا كان المستخدم يكتب أصلًا داخل الشريط. زر ⌨ يركّز دائمًا لأنه طلب صريح.
function diAutoFocus(){
  const a=typeof document!=='undefined'?document.activeElement:null;
  return lastPtrType==='mouse'||!!(a&&typeof a.closest==='function'&&a.closest('#drawInput'))
}
function diSetOpen(o,focus){
  const panel=$('#drawInput'),key=$('#diKey'),enabled=!!S.dyn;
  panel.style.display=enabled?'':'none';
  if(key)key.hidden=!enabled;
  o=!!o&&enabled;
  diOpen=o;
  panel.classList.toggle('open',o);
  if(key){key.classList.toggle('on',o);key.setAttribute('aria-pressed',o?'true':'false')}
  if(o&&focus)setTimeout(()=>{const f=drawFlow&&drawFlow.stage==='params'?$('#diExtra input'):$('#diX');if(f)f.focus({preventScroll:true})},30)
}


function drawPointFromInputs(){
  const x=num($('#diX').value),y=num($('#diY').value);
  if(!Number.isFinite(x)||!Number.isFinite(y)){
    toast(drawFlow&&drawFlow.coordMode==='polar'?'أدخل المسافة والزاوية بشكل صحيح':'أدخل إحداثيي X وY بشكل صحيح');
    return null
  }
  if(drawFlow&&drawFlow.coordMode==='polar'){
    const anchor=['polyline','free'].includes(drawFlow.tool)?drawFlow.points.at(-1):drawFlow.points[0];
    const distance=nu(x),angle=rad(y);
    if(!anchor||!(distance>0)||!Number.isFinite(angle)){
      toast('أدخل مسافة موجبة وزاوية صحيحة بعد تحديد نقطة البداية');
      return null
    }
    return [anchor[0]+distance*Math.cos(angle),anchor[1]-distance*Math.sin(angle)]
  }
  return [nu(x),-nu(y)]
}   // في النمط القطبي تُقاس المسافة والزاوية من النقطة السابقة؛ الزاوية الموجبة عكس عقارب الساعة.

function drawInputOpen(){return !!drawFlow}

function updateDrawCoordinateMode(){
  if(!drawFlow)return;
  const polar=drawFlow.coordMode==='polar',active=['second','next'].includes(drawFlow.stage),button=$('#diMode');
  if(button){
    button.hidden=!active;
    button.textContent=polar?'ديكارتي':'قطبي';
    button.title=polar?'التحويل إلى الإحداثيات الديكارتية':'التحويل إلى الإحداثيات القطبية';
    button.setAttribute('aria-pressed',polar?'true':'false')
  }
  $('#diX').placeholder=polar?`المسافة (${ul()})`:`X (${ul()})`;
  $('#diY').placeholder=polar?'الزاوية (°)':`Y (${ul()})`;
  $('#diX').setAttribute('aria-label',polar?'المسافة':'X');
  $('#diY').setAttribute('aria-label',polar?'الزاوية':'Y')
}

function drawInputStage(stage){
  if(!drawFlow)return;
  drawFlow.stage=stage;
  const t=drawFlow.tool,multi=['polyline','free'].includes(t),params=stage==='params',L=` (${ul()})`;
  $('#diTitle').textContent=`${drawNames[t]||'رسم'} · ${stage==='first'?(DRAG_FLOW_TOOLS.includes(t)?'اسحب للرسم أو المس البداية':'حدّد النقطة الأولى'):stage==='second'?'حدّد النقطة الثانية':params?'حدّد الحجم أو اكتبه':'حدّد النقطة التالية'}`;
  $('#diFinish').style.display=multi&&drawFlow.points.length>=2?'':'none';
  $('#diCoords').style.display=params?'none':'flex';
  const specs={
    circle:[['r','نصف القطر'+L,fu(1)]],
    arc:[['r','نصف القطر'+L,fu(1)],['a0','من °',0],['a1','إلى °',90]],
    ellipse:[['rx','المحور X'+L,fu(2)],['ry','المحور Y'+L,fu(1)],['rot','دوران °',0]],
    polygon:[['r','نصف القطر'+L,fu(1)],['sides','الأضلاع',polygonSides],['ang','بداية °',0]]
  };
  $('#diExtra').innerHTML=params
    ?(specs[t]||[]).map(([k,label,v])=>`<label><i>${label}</i><input data-param="${k}" type="number" step="any" inputmode="decimal" value="${v}"></label>`).join('')
    :'';
  $('#diExtra').style.display=params?'flex':'none';
  $('#diX').value='';
  $('#diY').value='';
  updateDrawCoordinateMode();
  $('#drawInput').classList.add('on');
  diSetOpen(diOpen,diAutoFocus())
}

function sidesSheet(done){
  const sh=$('#sheet');
  sh.innerHTML='<b>عدد أضلاع المضلع</b><div class="chips" id="sdc">'
    +[3,4,5,6,8,10,12].map(n=>`<button class="chip${n===polygonSides?' on':''}" data-v="${n}">${n}</button>`).join('')
    +'</div><label>عدد آخر (3 إلى 32)<input id="sdn" dir="ltr" inputmode="numeric"></label><div class="row"><button class="fl" id="sdx">إلغاء</button><button class="fl" id="opk">متابعة</button></div>';
  $('#sdn').value=polygonSides;
  const fin=n=>{polygonSides=clamp(Math.round(n)||6,3,32);sh.classList.remove('on');upd();done()};
  sh.querySelectorAll('#sdc .chip').forEach(b=>{b.onclick=()=>fin(+b.dataset.v)});
  $('#sdx').onclick=()=>{drawFlow=null;sh.classList.remove('on');upd()};
  $('#opk').onclick=()=>fin(num($('#sdn').value));
  sh.classList.add('on');$('#ctx').style.display='none';
}

function startDrawFlow(t){
  if(['furn','dim','door','win'].includes(t))return;
  if(!['line','wall','rect','circle','arc','ellipse','tri','polygon','polyline','free','text','north'].includes(t))return;
  clearOtrack();
  diOpen=false;
  drawFlow={tool:t,stage:'first',points:[],coordMode:'cartesian'};
  if(t==='polygon'){sidesSheet(()=>{if(drawFlow&&drawFlow.tool==='polygon')drawInputStage('first')});return}
  drawInputStage('first')
}

function nextDrawFlow(){
  const t=drawFlow&&drawFlow.tool;
  if(!t||tool!==t){closeDrawFlow();return}
  // بعد إنهاء رسم عنصر: طي النافذة فقط والبدء بدورة رسم جديدة بالحالة الأولية (ديكارتية ونظيفة) دون إغلاقها
  clearOtrack();
  parallelGuide=null;
  if(guideMode){guideMode=null;parallelRef=null}
  hideGuideChoice();
  diSetOpen(false);
  drawFlow={tool:t,stage:'first',points:[],coordMode:'cartesian'};
  drawInputStage('first')
}

function closeDrawFlow(){clearOtrack();drawFlow=null;parallelGuide=null;if(guideMode){guideMode=null;parallelRef=null}hideGuideChoice();$('#drawInput').classList.remove('on');updateDrawMetrics(null)}

function addDrawPoint(q,fromInput=false){if(!drawFlow)return false;const t=drawFlow.tool;let p=fromInput?q:snapPt(q);if(!fromInput
  &&!mk
  &&drawFlow.points.length
  &&['line','wall','polyline'].includes(drawFlow.tool)
  &&(guideMode||S.ortho||S.parallel&&parallelRef))p=constrain(drawFlow.points[drawFlow.points.length-1],p,guideMode);if(drawFlow.stage==='first'){
  drawFlow.points=[p];
  if(['furn','text','north','door','win'].includes(t)){commitSinglePoint(p);return true}
  drawInputStage(['circle','arc','ellipse','polygon'].includes(t)?'params':'second');
  return true
}
 if(drawFlow.stage==='params'){drawFlow.points.push(p);commitPointShape();return true}
 if(t==='polyline'||t==='free'){
   const last=drawFlow.points[drawFlow.points.length-1];
   if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>.001)drawFlow.points.push(p);
   drawInputStage('next');
   return true
 }
 drawFlow.points.push(p);commitPointShape();return true}

function commitSinglePoint(p){
  const t=drawFlow.tool;
  let s;
  if(t==='door'||t==='win'){
    const w=wallAt(p,28/V.s);
    if(!w){toast('لا يوجد جدار قريب من النقطة المحددة');return}
    s={t,x:w.q[0],y:w.q[1],a:w.a,th:w.th,w:t==='door'?.9:1.2,f:1,h:1,host:{id:sid(w.host),edge:w.edge,t:w.t,offset:0},ly:cl,col:D.col||undefined,lw:D.lw}
  }else if(t==='furn'){
    const d=SYM[furnKind];
    s={t:'furn',k:furnKind,x:p[0]-d.w/2,y:p[1]-d.h/2,w:d.w,h:d.h,rot:0,ly:cl,col:D.col||undefined}
  }else{s={t,x:p[0],y:p[1],h:t==='text'?.35:1,a:0,ly:cl,col:D.col||undefined};if(t==='text')s.txt='نص'}
  snap();
  shapes.push(s);
  sel=[shapes.length-1];
  nextDrawFlow();
  save();
  upd();
  draw();
  if(t==='text'){opts();setTimeout(()=>{const x=$('#sheet [data-k="txt"]');if(x){x.focus();x.select()}},60)}
}

function commitParamShape(){if(!drawFlow||drawFlow.stage!=='params')return;const t=drawFlow.tool,
  p=drawFlow.points[0],
  get=k=>num($(`#diExtra [data-param="${k}"]`)?.value),
  u=uk();let s;
 if(t==='circle'){const r=get('r')/u;if(!(r>0)){toast('أدخل نصف قطر أكبر من صفر');return}s={t,x:p[0],y:p[1],r}}
 else if(t==='arc'){
   const r=get('r')/u,a0=rad(get('a0')),a1=rad(get('a1'));
   if(!(r>0)||!Number.isFinite(a0)||!Number.isFinite(a1)||a0===a1){toast('تحقق من نصف القطر وزاويتي البداية والنهاية');return}
   s={t,x:p[0],y:p[1],r,a0,a1};
   while(s.a1<=s.a0)s.a1+=Math.PI*2;
   if(s.a1-s.a0>Math.PI*2){toast('زاوية القوس يجب ألا تتجاوز دورة كاملة');return}
 }
 else if(t==='ellipse'){
   const rx=get('rx')/u,ry=get('ry')/u,rot=rad(get('rot'));
   if(!(rx>0&&ry>0)||!Number.isFinite(rot)){toast('أدخل نصفي محور صحيحين وزاوية صالحة');return}
   s={t,x:p[0],y:p[1],rx,ry,rot}
 }
 else if(t==='polygon'){
   const r=get('r')/u,sides=Math.round(get('sides')),a=rad(get('ang'));
   if(!(r>0)||!Number.isFinite(sides)||sides<3||sides>32||!Number.isFinite(a)){toast('تحقق من نصف القطر وعدد الأضلاع والزاوية');return}
   s={t,p:Array.from({length:sides},(_,i)=>[p[0]+r*Math.cos(a+i*2*Math.PI/sides),p[1]+r*Math.sin(a+i*2*Math.PI/sides)])}
 }
 if(!s||!valid(s)){toast('الأبعاد المدخلة غير صالحة');return}
 s.ly=cl;
 s.col=D.col||undefined;
 s.lw=D.lw;
 snap();
 shapes.push(s);
 sel=[shapes.length-1];
 nextDrawFlow();
 save();
 upd();
 draw();}

function commitPointShape(){if(!drawFlow||drawFlow.points.length<2)return;const t=drawFlow.tool,[a,b]=drawFlow.points;let s;if(t==='door'||t==='win'){
  const w=wallAt(a,28/V.s);
  if(!w){toast('لا يوجد جدار قريب من الإحداثيات المحددة');drawFlow.points.pop();drawInputStage('first');return}
  s={t,x:w.q[0],y:w.q[1],a:w.a,th:w.th,w:t==='door'?.9:1.2,f:1,h:1,host:{id:sid(w.host),edge:w.edge,t:w.t,offset:0},ly:cl,col:D.col||undefined,lw:D.lw}
}
 else{s=buildGuidedShape(a,b);if(t==='ellipse'){s.x=a[0];s.y=a[1];s.rx=Math.max(.025,Math.abs(b[0]-a[0]));s.ry=Math.max(.025,Math.abs(b[1]-a[1]));s.rot=0}}
 if(!valid(s)){toast('النقطتان متقاربتان جداً أو أن الأبعاد غير صالحة');return}
 snap();
 if(s.t==='dim')linkDim(s);
 shapes.push(s);
 sel=[shapes.length-1];
 nextDrawFlow();
 save();
 upd();
 draw();}

function finishDrawFlow(){
  if(!drawFlow)return;
  const t=drawFlow.tool;
  if(t==='polyline'||t==='free'){
    const p=drawFlow.points;
    if(p.length>=2){
      const s={t,p:copy(p),ly:cl,col:D.col||undefined,lw:D.lw};
      if(valid(s)){snap();shapes.push(s);sel=[shapes.length-1];clearOtrack();nextDrawFlow();save();upd();draw();return}
    }
    toast('أضف نقطتين على الأقل قبل الإنهاء');
    return
  }
  clearOtrack();
  closeDrawFlow()
}

$('#diSubmit').onclick=()=>{
  if(moveFlow){moveFlowSubmit();draw();return}
  if(!drawFlow)return;
  if(drawFlow.stage==='params'){commitParamShape();return}
  const p=drawPointFromInputs();
  if(p){
    // احذف معاينة المؤشر السابقة قبل تثبيت النقطة الرقمية حتى لا تبقى كخط ثانٍ بعد الإنهاء.
    cur=null;mk=null;updateDrawMetrics(null);
    addDrawPoint(p,true)
  }
};

$('#diFinish').onclick=()=>{if(moveFlow){closeMoveFlow();draw();return}finishDrawFlow()};
$('#diKey').onclick=()=>diSetOpen(!diOpen,true);
$('#diMode').onclick=()=>{
  if(!drawFlow||!['second','next'].includes(drawFlow.stage))return;
  const oldMode=drawFlow.coordMode||'cartesian';
  const newMode=oldMode==='polar'?'cartesian':'polar';
  drawFlow.coordMode=newMode;
  const anchor=['polyline','free'].includes(drawFlow.tool)?drawFlow.points.at(-1):drawFlow.points[0];
  const rx=$('#diX').value.trim(),ry=$('#diY').value.trim();
  if(rx!==''&&ry!==''&&anchor){
    const vx=num(rx),vy=num(ry);
    if(Number.isFinite(vx)&&Number.isFinite(vy)){
      if(oldMode==='cartesian'&&newMode==='polar'){
        const pt=[nu(vx),-nu(vy)],dx=pt[0]-anchor[0],dy=-(pt[1]-anchor[1]);
        const dist=Math.hypot(dx,dy);
        let ang=deg(Math.atan2(dy,dx));
        if(ang<0)ang+=360;
        $('#diX').value=f(fu(dist));
        $('#diY').value=f(ang);
      }else if(oldMode==='polar'&&newMode==='cartesian'){
        const dist=nu(vx),ang=rad(vy);
        if(dist>0&&Number.isFinite(ang)){
          const tx=anchor[0]+dist*Math.cos(ang),ty=anchor[1]-dist*Math.sin(ang);
          $('#diX').value=f(fu(tx));
          $('#diY').value=f(fu(-ty));
        }
      }
    }
  }
  updateDrawCoordinateMode();
  if(newMode==='polar'){cur=null;updateDrawMetrics(null);parallelGuide=null;draw()}
  diSetOpen(true,true);
};
$('#drawInput').addEventListener('pointerdown',e=>{e.stopPropagation()});
const diTitleEl=$('#diTitle');
if(diTitleEl){
  diTitleEl.style.cursor='pointer';
  diTitleEl.onclick=()=>diSetOpen(!diOpen,true);
}
$('#diClose').onclick=()=>{
  if(moveFlow){closeMoveFlow();cur=null;draw();return}
  closeDrawFlow();
  cur=null;
  polyDraft=null;
  $('#polybar').style.display='none';
  draw()
};

$('#diX').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#diY').focus()}});
$('#diY').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#diSubmit').click()}});
$('#diExtra').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#diSubmit').click()}});
