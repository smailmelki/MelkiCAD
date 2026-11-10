/* ==================================================================
 * 20-keyboard.js
 * اختصارات لوحة المفاتيح للحاسوب (لا أثر لها على الهاتف): تراجع/إعادة، نسخ/لصق، حذف،
 * تبديل الأدوات بحرف واحد، قيود الرسم F8/F9/F10، تحريك العرض بالأسهم، والتكبير.
 * تعتمد على e.code (موضع المفتاح) فتعمل بنفس الطريقة مع لوحة المفاتيح العربية.
 *
 * يعرّف: typing، TOOL_KEYS، KEY_HELP، keysSheet، zoomBy، onKey
 * يعتمد على: 01-core.js، 04-selection.js، 05-persistence.js، 08-project-io.js،
 *            09-render.js، 13-draw-input.js، 14-pointer.js، 22-toolbar.js
 * ================================================================== */

// لا نعترض المفاتيح أثناء الكتابة داخل حقل (للمحافظة على تراجع النص وتحديده الأصلي)
const typing=e=>{const t=e.target;return !!t&&(!!t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||''))};

const TOOL_KEYS={KeyV:'select',KeyH:'pan',KeyL:'line',KeyW:'wall',KeyR:'rect',KeyC:'circle',KeyA:'arc',KeyE:'ellipse',KeyG:'polygon',KeyP:'polyline',KeyF:'free',KeyT:'text',KeyD:'dim'};

const KEY_HELP=[
  ['Ctrl+Z','تراجع'],['Ctrl+Y','إعادة'],['Ctrl+C / X / V','نسخ / قص / لصق'],['Ctrl+A','تحديد الكل'],
  ['Delete','حذف المحدد'],['Esc','إلغاء الرسم أو التحديد'],['Enter','إنهاء المتعدد POLYLINE'],
  ['V','تحديد'],['H','تحريك العرض'],['L','خط'],['W','جدار'],['R','مستطيل'],['C','دائرة'],['A','قوس'],['E','بيضاوي'],
  ['G','مضلع'],['P','متعدد POLYLINE'],['F','رسم حر'],['T','نص'],['D','بُعد'],['M','تحريك المحدد'],
  ['F3','تشغيل/إيقاف الالتقاط بالنقاط'],['F8','تعامد أفقي / رأسي'],['F9','شبكة'],['F10','زاوية 45°'],
  ['الأسهم','تحريك العرض (Shift أسرع)'],['+ / -','تكبير / تصغير'],['0 أو Home','ملاءمة الرسم'],
  ['Ctrl+S','حفظ المشروع JSON'],['Ctrl+P','طباعة / تصدير'],['?','هذه القائمة']
];

function keysSheet(){
  const sh=$('#sheet');
  const cap=k=>k.split(' / ').map(g=>g.split('+').map(x=>`<span class="kbd">${esc(x)}</span>`).join(' + ')).join(' ، ');
  sh.innerHTML='<b>اختصارات لوحة المفاتيح</b><div class="keys">'+KEY_HELP.map(([k,d])=>`<span>${cap(k)}</span><span>${esc(d)}</span>`).join('')+'</div><button id="ok">تم</button>';
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

// تكبير/تصغير حول مركز اللوحة
function zoomBy(k){
  const c=[W/2,H/2],w=s2w(...c);
  V.s=clamp(V.s*k,MIN_VIEW_SCALE,1200);V.x=c[0]-w[0]*V.s;V.y=c[1]-w[1]*V.s;
  redraw();saveSoon();
}

const press=q=>{const b=$(q);if(b&&!b.disabled)b.click()};
const toggleSnap=k=>{S[k]=S[k]?0:1;upd();save();draw();toast(`${{ortho:'التعامد الأفقي/الرأسي',grid:'التقاط الشبكة',polar:'زاوية 45°'}[k]}: ${S[k]?'مفعّل':'متوقف'}`)};

// Esc يتراجع خطوة واحدة في كل ضغطة: نافذة مفتوحة ← رسم جارٍ ← قائمة ← لوحة ← وضع التحريك ← التحديد ← أداة التحديد
function escapeStep(){
  if(!$('#io').hidden){press('#iox');return}
  if(!$('#ov').hidden){press('#ovx');return}
  if(drawFlow){press('#diClose');return}
  if(polyDraft){press('#polycancel');return}
  if($$('.gm.on').length||$('#smenu').classList.contains('on')){$$('.gm').forEach(m=>m.classList.remove('on'));$('#smenu').classList.remove('on');upd();return}
  if($('#sheet').classList.contains('on')){$('#sheet').classList.remove('on');upd();return}
  if(moveArmed){setMoveMode(false);upd();return}
  if(sel.length){sel=[];upd();draw();return}
  if(tool!=='select'&&tool!=='pan')press('[data-t="select"]');
}

function onKey(e){
  if(e.defaultPrevented)return;
  const k=e.code,mod=e.ctrlKey||e.metaKey,stop=()=>{if(e.preventDefault)e.preventDefault()};
  if(k==='Escape'){escapeStep();return}
  if(typing(e)||!$('#io').hidden||!$('#ov').hidden)return;
  if(mod){
    if(e.repeat&&k!=='KeyZ'&&k!=='KeyY')return;
    if(k==='KeyZ'){stop();press(e.shiftKey?'#redo':'#undo')}
    else if(k==='KeyY'){stop();press('#redo')}
    else if(k==='KeyC'){if(sel.length){stop();press('#cp')}}
    else if(k==='KeyX'){if(sel.length){stop();press('#cp');press('#del')}}
    else if(k==='KeyV'){if(clip.length){stop();press('#ps')}}
    else if(k==='KeyA'){stop();if(tool!=='select')press('[data-t="select"]');press('#all')}
    else if(k==='KeyS'){stop();exportFile()}
    else if(k==='KeyP'){stop();press('#shot')}
    return;
  }
  if(e.altKey)return;
  if(k==='Delete'||k==='Backspace'){if(sel.length){stop();press('#del')}return}
  if(k==='Enter'){
    if(polyDraft){stop();finishPolyline()}
    else if(drawFlow&&['polyline','free'].includes(drawFlow.tool)){stop();finishDrawFlow()}
    return;
  }
  if(k==='F1'||(k==='Slash'&&e.shiftKey)){stop();keysSheet();return}
  const pan={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[k];
  if(pan){stop();const d=e.shiftKey?240:60;V.x+=pan[0]*d;V.y+=pan[1]*d;redraw();saveSoon();return}
  if(k==='Equal'||k==='NumpadAdd'){stop();zoomBy(1.25);return}
  if(k==='Minus'||k==='NumpadSubtract'){stop();zoomBy(.8);return}
  if(e.repeat)return;
  if(k==='Digit0'||k==='Numpad0'||k==='Home'){stop();press('#fit');return}
  if(k==='F8'){stop();toggleSnap('ortho');return}
  if(k==='F9'){stop();toggleSnap('grid');return}
  if(k==='F10'){stop();toggleSnap('polar');return}
  if(k==='F3'){stop();const on=['end','mid','int','cen'].some(x=>S[x]);['end','mid','int','cen'].forEach(x=>{S[x]=on?0:1});upd();save();draw();toast(`الالتقاط بالنقاط: ${on?'متوقف':'مفعّل'}`);return}
  if(k==='KeyM'){if(sel.length){stop();press('#mv')}return}
  if(TOOL_KEYS[k]&&!e.shiftKey){stop();press(`[data-t="${TOOL_KEYS[k]}"]`)}
}

document.addEventListener('keydown',onKey);
