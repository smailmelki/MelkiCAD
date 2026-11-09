/* ==================================================================
 * 13-draw-input.js
 * الإدخال الرقمي الاختياري للرسم: شريط صغير أسفل اللوحة يعرض الخطوة الحالية (مثل سطر الأوامر في AutoCAD). الرسم باللمس هو الأساس، وزر لوحة الأرقام يفتح حقول الإحداثيات أو الأبعاد عند الحاجة فقط.
 *
 * يعرّف: drawNames، diOpen، diSetOpen، drawPointFromInputs، drawInputOpen، drawInputStage، sidesSheet،
 *        startDrawFlow، closeDrawFlow، addDrawPoint، commitSinglePoint،
 *        commitParamShape، commitPointShape، finishDrawFlow
 * يعتمد على: 01-core.js، 02-geometry.js، 03-snap.js، 05-persistence.js،
 *            09-render.js، 10-dimensions.js، 11-furniture.js، 12-openings.js،
 *            15-properties.js، 22-toolbar.js
 * ================================================================== */

// ---- الإدخال الرقمي الاختياري: الشريط مطويّ افتراضيًا (يعرض الخطوة فقط)، وزر ⌨ يفتح الحقول ----
const drawNames={line:'خط',wall:'جدار',dim:'بُعد',rect:'مستطيل',circle:'دائرة',arc:'قوس',ellipse:'شكل بيضاوي',tri:'مثلث',polygon:'مضلع',polyline:'متعدد الخطوط',free:'رسم حر',furn:'أثاث',text:'نص',north:'سهم الشمال',door:'باب',win:'نافذة'};
let diOpen=false; // يبقى مفتوحًا بين الأشكال إذا اختار المستخدم الإدخال الرقمي
function diSetOpen(o,focus){const panel=$('#drawInput'),key=$('#diKey'),enabled=!!S.dyn;panel.style.display=enabled?'':'none';if(key)key.hidden=!enabled;o=!!o&&enabled;diOpen=o;panel.classList.toggle('open',o);if(key){key.classList.toggle('on',o);key.setAttribute('aria-pressed',o?'true':'false')}if(o&&focus)setTimeout(()=>{const f=drawFlow&&drawFlow.stage==='params'?$('#diExtra input'):$('#diX');if(f)f.focus({preventScroll:true})},30)}


function drawPointFromInputs(){const x=num($('#diX').value),y=num($('#diY').value);if(!Number.isFinite(x)||!Number.isFinite(y)){toast('أدخل إحداثيي X وY بشكل صحيح');return null}return [nu(x),nu(y)]}

function drawInputOpen(){return !!drawFlow}

function drawInputStage(stage){if(!drawFlow)return;drawFlow.stage=stage;const t=drawFlow.tool,multi=['polyline','free'].includes(t),params=stage==='params',L=` (${ul()})`;$('#diTitle').textContent=`${drawNames[t]||'رسم'} · ${stage==='first'?'حدّد النقطة الأولى':stage==='second'?'حدّد النقطة الثانية':params?'حدّد الحجم أو اكتبه':'حدّد النقطة التالية'}`;$('#diFinish').style.display=multi&&drawFlow.points.length>=2?'':'none';$('#diCoords').style.display=params?'none':'flex';const specs={circle:[['r','نصف القطر'+L,fu(1)]],arc:[['r','نصف القطر'+L,fu(1)],['a0','من °',0],['a1','إلى °',90]],ellipse:[['rx','المحور X'+L,fu(2)],['ry','المحور Y'+L,fu(1)],['rot','دوران °',0]],polygon:[['r','نصف القطر'+L,fu(1)],['sides','الأضلاع',polygonSides],['ang','بداية °',0]]};$('#diExtra').innerHTML=params?(specs[t]||[]).map(([k,label,v])=>`<label><i>${label}</i><input data-param="${k}" type="number" step="any" inputmode="decimal" value="${v}"></label>`).join(''):'';$('#diExtra').style.display=params?'flex':'none';$('#diX').placeholder='X'+L;$('#diY').placeholder='Y'+L;$('#diX').value='';$('#diY').value='';$('#drawInput').classList.add('on');diSetOpen(diOpen,true)}

function sidesSheet(done){
  const sh=$('#sheet');
  sh.innerHTML='<b>عدد أضلاع المضلع</b><div class="chips" id="sdc">'+[3,4,5,6,8,10,12].map(n=>`<button class="chip${n===polygonSides?' on':''}" data-v="${n}">${n}</button>`).join('')+'</div><label>عدد آخر (3 إلى 32)<input id="sdn" dir="ltr" inputmode="numeric"></label><div class="row"><button class="fl" id="sdx">إلغاء</button><button class="fl" id="opk">متابعة</button></div>';
  $('#sdn').value=polygonSides;
  const fin=n=>{polygonSides=clamp(Math.round(n)||6,3,32);sh.classList.remove('on');upd();done()};
  sh.querySelectorAll('#sdc .chip').forEach(b=>{b.onclick=()=>fin(+b.dataset.v)});
  $('#sdx').onclick=()=>{drawFlow=null;sh.classList.remove('on');upd()};
  $('#opk').onclick=()=>fin(num($('#sdn').value));
  sh.classList.add('on');$('#ctx').style.display='none';
}

function startDrawFlow(t){if(['furn','dim','door','win'].includes(t))return;if(!['line','wall','rect','circle','arc','ellipse','tri','polygon','polyline','free','text','north'].includes(t))return;drawFlow={tool:t,stage:'first',points:[]};if(t==='polygon'){sidesSheet(()=>{if(drawFlow&&drawFlow.tool==='polygon')drawInputStage('first')});return}drawInputStage('first')}

function closeDrawFlow(){drawFlow=null;$('#drawInput').classList.remove('on')}

function addDrawPoint(q,fromInput=false){if(!drawFlow)return false;const t=drawFlow.tool;let p=fromInput?q:snapPt(q);if(!fromInput&&!mk&&drawFlow.points.length&&['line','wall','polyline'].includes(drawFlow.tool)&&(S.ortho||S.parallel&&parallelRef))p=constrain(drawFlow.points[drawFlow.points.length-1],p);if(drawFlow.stage==='first'){drawFlow.points=[p];if(['furn','text','north','door','win'].includes(t)){commitSinglePoint(p);return true}drawInputStage(['circle','arc','ellipse','polygon'].includes(t)?'params':'second');return true}
 if(drawFlow.stage==='params'){drawFlow.points.push(p);commitPointShape();return true}
 if(t==='polyline'||t==='free'){const last=drawFlow.points[drawFlow.points.length-1];if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>.001)drawFlow.points.push(p);drawInputStage('next');return true}
 drawFlow.points.push(p);commitPointShape();return true}

function commitSinglePoint(p){const t=drawFlow.tool;let s;if(t==='door'||t==='win'){const w=wallAt(p,28/V.s);if(!w){toast('لا يوجد جدار قريب من النقطة المحددة');return}s={t,x:w.q[0],y:w.q[1],a:w.a,th:w.th,w:t==='door'?.9:1.2,f:1,h:1,ly:cl,col:D.col||undefined,lw:D.lw}}else if(t==='furn'){const d=SYM[furnKind];s={t:'furn',k:furnKind,x:p[0]-d.w/2,y:p[1]-d.h/2,w:d.w,h:d.h,rot:0,ly:cl,col:D.col||undefined}}else{s={t,x:p[0],y:p[1],h:t==='text'?.35:1,a:0,ly:cl,col:D.col||undefined};if(t==='text')s.txt='نص'}snap();shapes.push(s);sel=[shapes.length-1];closeDrawFlow();save();upd();draw();showDyn(s);if(t==='text'){opts();setTimeout(()=>{const x=$('#sheet [data-k="txt"]');if(x){x.focus();x.select()}},60)}}

function commitParamShape(){if(!drawFlow||drawFlow.stage!=='params')return;const t=drawFlow.tool,p=drawFlow.points[0],get=k=>num($(`#diExtra [data-param="${k}"]`)?.value),u=uk();let s;
 if(t==='circle'){const r=get('r')/u;if(!(r>0)){toast('أدخل نصف قطر أكبر من صفر');return}s={t,x:p[0],y:p[1],r}}
 else if(t==='arc'){const r=get('r')/u,a0=rad(get('a0')),a1=rad(get('a1'));if(!(r>0)||!Number.isFinite(a0)||!Number.isFinite(a1)||a0===a1){toast('تحقق من نصف القطر وزاويتي البداية والنهاية');return}s={t,x:p[0],y:p[1],r,a0,a1};while(s.a1<=s.a0)s.a1+=Math.PI*2;if(s.a1-s.a0>Math.PI*2){toast('زاوية القوس يجب ألا تتجاوز دورة كاملة');return}}
 else if(t==='ellipse'){const rx=get('rx')/u,ry=get('ry')/u,rot=rad(get('rot'));if(!(rx>0&&ry>0)||!Number.isFinite(rot)){toast('أدخل نصفي محور صحيحين وزاوية صالحة');return}s={t,x:p[0],y:p[1],rx,ry,rot}}
 else if(t==='polygon'){const r=get('r')/u,sides=Math.round(get('sides')),a=rad(get('ang'));if(!(r>0)||!Number.isFinite(sides)||sides<3||sides>32||!Number.isFinite(a)){toast('تحقق من نصف القطر وعدد الأضلاع والزاوية');return}s={t,p:Array.from({length:sides},(_,i)=>[p[0]+r*Math.cos(a+i*2*Math.PI/sides),p[1]+r*Math.sin(a+i*2*Math.PI/sides)])}}
 if(!s||!valid(s)){toast('الأبعاد المدخلة غير صالحة');return}s.ly=cl;s.col=D.col||undefined;s.lw=D.lw;snap();shapes.push(s);sel=[shapes.length-1];closeDrawFlow();save();upd();draw();showDyn(s)}

function commitPointShape(){if(!drawFlow||drawFlow.points.length<2)return;const t=drawFlow.tool,[a,b]=drawFlow.points;let s;if(t==='door'||t==='win'){const w=wallAt(a,28/V.s);if(!w){toast('لا يوجد جدار قريب من الإحداثيات المحددة');drawFlow.points.pop();drawInputStage('first');return}s={t,x:w.q[0],y:w.q[1],a:w.a,th:w.th,w:t==='door'?.9:1.2,f:1,h:1,ly:cl,col:D.col||undefined,lw:D.lw}}
 else{s=build(a,b);if(t==='ellipse'){s.x=a[0];s.y=a[1];s.rx=Math.max(.025,Math.abs(b[0]-a[0]));s.ry=Math.max(.025,Math.abs(b[1]-a[1]));s.rot=0}}
 if(!valid(s)){toast('النقطتان متقاربتان جداً أو أن الأبعاد غير صالحة');return}snap();if(s.t==='dim')linkDim(s);shapes.push(s);sel=[shapes.length-1];closeDrawFlow();save();upd();draw();showDyn(s)}

function finishDrawFlow(){if(!drawFlow)return;const t=drawFlow.tool;if(t==='polyline'||t==='free'){const p=drawFlow.points;if(p.length>=2){const s={t,p:copy(p),ly:cl,col:D.col||undefined,lw:D.lw};if(valid(s)){snap();shapes.push(s);sel=[shapes.length-1];closeDrawFlow();save();upd();draw();showDyn(s);return}}toast('أضف نقطتين على الأقل قبل الإنهاء');return}closeDrawFlow()}

$('#diSubmit').onclick=()=>{if(!drawFlow)return;if(drawFlow.stage==='params'){commitParamShape();return}const p=drawPointFromInputs();if(p)addDrawPoint(p,true)};

$('#diFinish').onclick=finishDrawFlow;$('#diKey').onclick=()=>diSetOpen(!diOpen,true);$('#diClose').onclick=()=>{closeDrawFlow();cur=null;polyDraft=null;$('#polybar').style.display='none';draw()};

$('#diX').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#diY').focus()}});$('#diY').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#diSubmit').click()}});$('#diExtra').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#diSubmit').click()}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawFlow)closeDrawFlow()});
