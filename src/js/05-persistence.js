/* ==================================================================
 * 05-persistence.js
 * التخزين المحلي (localStorage) وسجل التراجع/الإعادة. المتغيرات PJ و pid و LY و cl
 * تُعرَّف هنا وتُستخدم في المشاريع والطبقات.
 *
 * يعرّف: PJ، pid، LY، cl، K، uid، lsGet، lsSet، lsWarnAt، save، load، snapStr، snap، restore
 * يعتمد على: 01-core.js، 06-layers.js، 09-render.js، 15-properties.js،
 *            22-toolbar.js
 * ================================================================== */

// المشاريع: idx = قائمة المشاريع والحالي، p:<id> = رسم كل مشروع، set = إعدادات الالتقاط واللون
let PJ=[],pid='',LY=[],cl='';const K='plan3:',uid=()=>Math.random().toString(36).slice(2,9);

const lsGet=k=>{try{return JSON.parse(localStorage.getItem(K+k))}catch(e){return null}};

// فشل الكتابة (امتلاء التخزين أو منعه) يُنبَّه عنه مرة كل 15 ثانية بدل ابتلاعه بصمت
let lsWarnAt=0;
const lsSet=(k,v)=>{try{localStorage.setItem(K+k,JSON.stringify(v));return true}catch(e){if(Date.now()-lsWarnAt>15000){lsWarnAt=Date.now();toast('تعذّر الحفظ التلقائي: التخزين ممتلئ أو غير متاح. صدّر المشروع من الإعدادات الآن')}return false}};

const save=()=>{lsSet('p:'+pid,{shapes,V,LY,cl});lsSet('set',{S,D,ST});lsSet('idx',{PJ,pid})};

const load=()=>{
  const st=lsGet('set');if(st){S=Object.assign(S,st.S||{});D=st.D||D;ST=Object.assign(ST,st.ST||{});delete ST.cloud;delete ST.bk}
  const ix=lsGet('idx');
  if(ix&&ix.PJ&&ix.PJ.length){PJ=ix.PJ;pid=PJ.some(p=>p.id===ix.pid)?ix.pid:PJ[0].id}
  else{
    let old=null;try{old=JSON.parse(localStorage.getItem('plan2')||localStorage.getItem('plan1'))}catch(e){}
    pid=uid();PJ=[{id:pid,name:'مشروعي'}];
    if(old){lsSet('p:'+pid,{shapes:old.shapes||[],V:old.V||V});if(old.S)S=old.S;if(old.D)D=old.D}
  }
  const d=lsGet('p:'+pid);setLY(d);if(d){shapes=d.shapes||[];V=d.V||V}
};

const snapStr=()=>JSON.stringify({s:shapes,LY,cl});const snap=()=>{hist.push(snapStr());if(hist.length>100)hist.shift()};

function restore(str){
  const d=JSON.parse(str);
  if(Array.isArray(d))shapes=d;else{shapes=d.s;LY=d.LY;cl=d.cl}
  if(!LY||!LY.length)setLY(null);else{if(!LY.some(l=>l.id===cl))cl=LY[0].id;const c0=LY.find(l=>l.id===cl);if(c0)c0.vis=1}
  sel=[];hideDyn();$('#sheet').classList.remove('on');
}

$('#undo').onclick=()=>{if(!hist.length)return;redo.push(snapStr());restore(hist.pop());save();upd();draw()};

$('#redo').onclick=()=>{if(!redo.length)return;Array.prototype.push.call(hist,snapStr());restore(redo.pop());save();upd();draw()};
