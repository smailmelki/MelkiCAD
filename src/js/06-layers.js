/* ==================================================================
 * 06-layers.js
 * الطبقات: بنية الطبقات وقواعد الظهور والقفل، ولوحة إدارة الطبقات (إضافة، نقل،
 * دمج، حذف).
 *
 * يعرّف: setLY، layerOf، shown، ed، layerSheet
 * يعتمد على: 01-core.js، 05-persistence.js، 09-render.js، 22-toolbar.js
 * ================================================================== */

// الطبقات: LY=[{id,name,vis,lock}]، cl=الطبقة الحالية، كل شكل له ly (بدونه = الطبقة الأولى)
function setLY(d){LY=d&&d.LY&&d.LY.length?d.LY:[{id:'l1',name:'طبقة 1',vis:1,lock:0}];cl=d&&d.cl&&LY.some(l=>l.id===d.cl)?d.cl:LY[0].id;const c0=LY.find(l=>l.id===cl);if(c0)c0.vis=1}

const layerOf=s=>LY.find(l=>l.id===s.ly)||LY[0]||{vis:1,lock:0},shown=s=>layerOf(s).vis!==0,ed=s=>{const l=layerOf(s);return l.vis!==0&&!l.lock};

function layerSheet(){
  const sh=$('#sheet');
  sh.innerHTML='<div class="pl"></div><div class="row"><button class="fl" id="lnew">طبقة جديدة</button><button class="fl" id="lmv">نقل المحدد هنا</button><button class="fl" id="ldel">حذف الحالية</button></div><div class="row"><button class="fl" id="lmg">دمج الطبقات</button><button class="fl" id="lmc" hidden>إلغاء</button></div><button id="ok">تم</button>';
  let mm=0;const mg=new Set();
  const pl=sh.querySelector('.pl'),ch=()=>{const c0=LY.find(l=>l.id===cl);if(c0)c0.vis=1;sel=sel.filter(i=>ed(shapes[i]));save();upd();draw();fill()},
    btn=(t,fn)=>{const b=document.createElement('button');b.textContent=t;b.onclick=fn;return b};
  const fill=()=>{pl.textContent='';LY.forEach(l=>{
    const r=document.createElement('div'),nm=document.createElement('input'),lc=document.createElement('input'),lt=document.createElement('select');r.className='lr'+(l.id===cl?' on':'');nm.value=l.name;
    lt.className='layer-linetype';lt.title='نوع الخط الافتراضي لعناصر مجموعة رسم';lt.innerHTML='<option value="">متصل (افتراضي)</option><option value="continuous">متصل</option><option value="dashed">متقطع</option><option value="dotted">منقط</option><option value="dashdot">شرطة ونقطة</option><option value="center">محوري</option><option value="hidden">مخفي</option>';lt.value=l.linetype||'';lt.onchange=()=>{snap();l.linetype=lt.value||undefined;save();draw()};nm.oninput=()=>{l.name=nm.value;save()};lc.type='color';lc.className='layer-color';lc.title='لون الطبقة';lc.value=l.col||'#15324b';lc.onchange=()=>{snap();l.col=lc.value;save();draw()};
    if(mm&&l.id!==cl)r.append(btn(mg.has(l.id)?'☑':'☐',()=>{mg.has(l.id)?mg.delete(l.id):mg.add(l.id);mgUi()}));
    r.append(btn(l.id===cl?'●':'○',()=>{cl=l.id;l.vis=1;mg.delete(cl);save();draw();mgUi()}),nm,lc,lt,btn(l.vis!==0?'ظاهرة':'مخفية',()=>{if(l.id===cl&&l.vis!==0){toast('لا يمكن إخفاء الطبقة الحالية');return}snap();l.vis=l.vis!==0?0:1;ch()}),btn(l.lock?'مقفلة':'مفتوحة',()=>{snap();l.lock=l.lock?0:1;ch()}));
    pl.append(r)})};
  fill();
  $('#lnew').onclick=()=>{snap();LY.push({id:uid(),name:`طبقة ${LY.length+1}`,vis:1,lock:0,col:'#15324b'});cl=LY[LY.length-1].id;save();fill()};
  $('#lmv').onclick=()=>{if(!sel.length){toast('حدّد أشكالًا أولًا');return}snap();sel.forEach(i=>{shapes[i].ly=cl});toast('تم النقل إلى الطبقة الحالية');ch()};
  let armed=0;
  // دمج: اختر طبقات لتنتقل أشكالها إلى الطبقة الحالية ثم تُحذف هي
  const mgUi=()=>{$('#lmg').textContent=mm?`دمج (${mg.size}) في الطبقة الحالية`:'دمج الطبقات';$('#lmc').hidden=!mm;fill()};
  $('#lmc').onclick=()=>{mm=0;mg.clear();mgUi()};
  $('#lmg').onclick=()=>{
    if(!mm){mm=1;mg.clear();toast('اختر الطبقات المراد دمجها');mgUi();return}
    if(!mg.size){toast('اختر طبقة واحدة على الأقل');return}
    snap();const first=LY[0].id;
    shapes.forEach(s=>{const id=s.ly&&LY.some(l=>l.id===s.ly)?s.ly:first;if(mg.has(id))s.ly=cl});
    LY=LY.filter(l=>!mg.has(l.id));mm=0;mg.clear();toast('تم دمج الطبقات');ch();mgUi();
  };
  $('#ldel').onclick=e=>{
    const b=e.currentTarget;
    if(LY.length<2){toast('لا يمكن حذف الطبقة الوحيدة');return}
    if(!armed){armed=1;b.textContent='تأكيد الحذف';setTimeout(()=>{armed=0;b.textContent='حذف الحالية'},3000);return}
    armed=0;b.textContent='حذف الحالية';
    const to=LY.find(l=>l.id!==cl).id,first=LY[0].id;snap();
    shapes.forEach(s=>{if((s.ly||first)===cl)s.ly=to});LY=LY.filter(l=>l.id!==cl);cl=to;ch();
  };
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#lyb').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');layerSheet()};
