/* ==================================================================
 * 05-persistence.js
 * حالة المشاريع والحفظ (عبر طبقة التخزين 00-storage.js) وسجل التراجع/الإعادة. المتغيرات PJ و pid و LY و cl
 * تُعرَّف هنا وتُستخدم في المشاريع والطبقات.
 *
 * يعرّف: PJ، pid، LY، cl، uid، saveTimer، save، saveView، saveSoon، flushOnLeave، load، snapStr، lazyBefore، snap، restore
 * يعتمد على: 01-core.js، 06-layers.js، 09-render.js، 15-properties.js،
 *            22-toolbar.js
 * ================================================================== */

// المشاريع: idx = قائمة المشاريع والحالي، p:<id> = رسم كل مشروع، set = إعدادات الالتقاط واللون
let PJ=[],pid='',LY=[],cl='';const uid=()=>Math.random().toString(36).slice(2,9);

// القراءة والكتابة من kvGet/kvSet/kvDel (00-storage.js): متزامنة من جهة الكود، وتُكتب إلى IndexedDB في الخلفية.

// save() فوري ويُلغي أي حفظ مؤجَّل؛ saveSoon() لتغييرات العرض فقط (تحريك/تكبير) فيجمعها في كتابة واحدة.
// كل مسار يبدّل المشروع (openP/newP/delP) يستدعي save() أولًا فلا يُكتب مؤجَّل على مشروع آخر.
let saveTimer=0;
// قبل جاهزية التخزين (Store.init) لا نكتب شيئًا كي لا نطمس المشاريع المحفوظة بحالة فارغة.
// العرض (V) في سجل صغير مستقل 'v:<id>': تحريك اللوحة وتكبيرها لا يعيد تسلسل المشروع كله ولا يكتب ميغابايتات إلى IndexedDB.
const save=()=>{clearTimeout(saveTimer);saveTimer=0;if(!Store.ready)return;kvSet('p:'+pid,{shapes,LY,cl});kvSet('v:'+pid,V);kvSet('set',{S,D,ST});kvSet('idx',{PJ,pid})};
const saveView=()=>{saveTimer=0;if(!Store.ready)return;kvSet('v:'+pid,V)};
const saveSoon=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(saveView,400)};
// عند إخفاء الصفحة أو إغلاقها: احفظ أي تغيير عرض مؤجَّل ثم ابدأ كتابة IndexedDB فورًا
const flushOnLeave=()=>{if(saveTimer)save();Store.flushNow()};
window.addEventListener('pagehide',flushOnLeave);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushOnLeave()});

const load=()=>{
  const st=kvGet('set');if(st){S=Object.assign(S,st.S||{});D=st.D||D;ST=Object.assign(ST,st.ST||{});delete ST.cloud;delete ST.bk}
  const ix=kvGet('idx');
  if(ix&&ix.PJ&&ix.PJ.length){PJ=ix.PJ;pid=PJ.some(p=>p.id===ix.pid)?ix.pid:PJ[0].id}
  else{
    let old=null;try{old=JSON.parse(localStorage.getItem('plan2')||localStorage.getItem('plan1'))}catch(e){}
    pid=uid();PJ=[{id:pid,name:'مشروعي'}];
    if(old){kvSet('p:'+pid,{shapes:old.shapes||[],V:old.V||V});if(old.S)S=old.S;if(old.D)D=old.D}
  }
  const d=kvGet('p:'+pid);setLY(d);if(d){shapes=d.shapes||[];V=kvGet('v:'+pid)||d.V||V}
};

const snapStr=()=>JSON.stringify({s:shapes,LY,cl});
// لقطة التراجع تُؤخذ عند أول وصول إلى g.before (أي عند أول تغيير فعلي) لا عند كل لمسة: تسلسل مشروع كبير مكلف.
// تُستعمل فقط حيث لا يتغيّر الرسم قبل ذلك الوصول (رسم جديد، مقابض التعديل والتدوير).
const lazyBefore=o=>{let b;Object.defineProperty(o,'before',{get(){return b===undefined?(b=snapStr()):b},enumerable:false});return o};
const snap=()=>{hist.push(snapStr());if(hist.length>100)hist.shift()};

function restore(str){
  const d=JSON.parse(str);
  if(Array.isArray(d))shapes=d;else{shapes=d.s;LY=d.LY;cl=d.cl}
  if(!LY||!LY.length)setLY(null);else{if(!LY.some(l=>l.id===cl))cl=LY[0].id;const c0=LY.find(l=>l.id===cl);if(c0)c0.vis=1}
  sel=[];$('#sheet').classList.remove('on');
}

$('#undo').onclick=()=>{if(!hist.length)return;redo.push(snapStr());restore(hist.pop());save();upd();draw()};

$('#redo').onclick=()=>{if(!redo.length)return;Array.prototype.push.call(hist,snapStr());restore(redo.pop());save();upd();draw()};
