/* ==================================================================
 * 01-core.js
 * الحالة العامة والمساعدات الأساسية: مراجع DOM، الثوابت، متغيرات الحالة المشتركة
 * (الأشكال، التحديد، العرض، الإعدادات)، دوال الرياضيات والتنسيق، الوحدات والشبكة،
 * ومصنع سجل التراجع nh.
 *
 * يعرّف: esc، $، $$، cv، ctx، FONT، COLS، NM، shapes، redo، hist، sel، clip، tool، cur،
 *        polyDraft، g، box، mk، V، dpr، W، H، polygonSides، S، D، ST، cpos، furnKind،
 *        fileHintT، toast، P، drawFlow، f، clamp، num، len، w2s،
 *        s2w، pos، deg، rad، step، uk، ul، uA، fu، fl، nu، grid، nh
 * يعتمد على: — (لا شيء)
 * ================================================================== */

// الأشكال بالمتر: line{a,b} rect{x,y,w,h} circle{x,y,r} tri{p} free{p} + اختياري name,col,lw
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s),cv=$('#cv');let ctx=cv.getContext('2d');

const FONT='"IBM Plex Sans Arabic",system-ui,sans-serif',COLS=['','#dc2626','#ea580c','#16a34a','#2563eb','#9333ea','#0d9488','#6b7280'];

const NM={end:'نهاية',mid:'منتصف',int:'تقاطع',cen:'مركز',qua:'ربع'};

let shapes=[],redo=[],hist=nh(),sel=[],clip=[],tool='rect',cur=null,polyDraft=null,g=null,box=null,mk=null,V={x:24,y:24,s:40},dpr=1,W=0,H=0;

let polygonSides=6;let S={end:1,mid:1,int:1,cen:1,grid:1,ortho:0,polar:0,parallel:0,dyn:1},D={col:'',lw:2},ST={unit:'m',gs:0,axes:1,coord:1,grid:1,showDims:0,showAreas:0},cpos=null,furnKind='bed2',fileHintT=0;

// تهريب نص قبل وضعه داخل innerHTML (أسماء الطبقات والمشاريع قد تأتي من ملف مستورد)
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const toast=m=>{const t=$('#tt');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)};

const P=new Map();

let drawFlow=null;

const f=n=>(Math.round(n*100)/100).toFixed(2).replace(/\.?0+$/,'');

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

const num=v=>parseFloat(String(v).replace(/[٠-٩]/g,d=>d.charCodeAt(0)-1632).replace('٫','.').replace(',','.'));

const len=s=>Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]);

const w2s=(x,y)=>[V.x+x*V.s,V.y+y*V.s],s2w=(x,y)=>[(x-V.x)/V.s,(y-V.y)/V.s];

const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};

const deg=a=>a*180/Math.PI;

const rad=a=>a*Math.PI/180;

const step=()=>ST.gs||(V.s>=60?.1:V.s>=25?.5:1);
// الوحدات: الداخل دائمًا بالمتر، والعرض والإدخال حسب الإعداد (م أو سم)
const uk=()=>ST.unit==='cm'?100:1,ul=()=>ST.unit==='cm'?'cm':'m',uA=()=>ST.unit==='cm'?'سم':'م',fu=n=>f(n*uk()),fl=n=>`${fu(n)} ${ul()}`,nu=v=>num(v)/uk();

const grid=v=>S.grid?Math.round(v/step())*step():v;
// تراجع/إعادة: كل حالة تحفظ الأشكال والطبقات معًا، وأي إجراء جديد يمسح قائمة الإعادة
function nh(){redo=[];const h=[];h.push=function(x){redo=[];return Array.prototype.push.call(this,x)};return h}
