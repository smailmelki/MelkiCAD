/* ==================================================================
 * 21-settings.js
 * الإعدادات: الوحدات، حجم الشبكة، خيارات الإظهار، والاستيراد والتصدير، وبيانات المكتب (تظهر في جدول عنوان الطباعة).
 *
 * يعرّف: CO_KEYS، CO_KIND، coGet، coSet، officeSheet، settingsSheet
 * يعتمد على: 01-core.js، 05-persistence.js، 08-project-io.js، 09-render.js،
 *            20-keyboard.js، 22-toolbar.js
 * ================================================================== */

// بيانات المكتب: عامة لكل المشاريع، تُحفظ في الإعدادات (السجل 'co') وتُستعمل في جدول عنوان الورقة المطبوعة (18-print.js)
const CO_KEYS=['kind','name','phone','email','addr'],CO_KIND='المكتب الاستشاري / الهندسي';
function coGet(){
  const r=kvGet('co'),o={kind:CO_KIND,name:'',phone:'',email:'',addr:''};
  if(r&&typeof r==='object')for(const k of CO_KEYS)if(typeof r[k]==='string')o[k]=r[k].slice(0,200);
  return o;
}
function coSet(patch){
  const o=coGet();
  if(patch&&typeof patch==='object')for(const k of CO_KEYS)if(patch[k]!==undefined&&patch[k]!==null)o[k]=String(patch[k]).slice(0,200);
  kvSet('co',o);return o;
}

// back: دالة تُستدعى عند «رجوع» (مثل لوحة الطباعة)؛ بدونها يُغلق اللوح
function officeSheet(back){
  const sh=$('#sheet'),c=coGet();
  const fld=(k,l,t)=>`<label>${l}<input data-k="${k}" type="${t||'text'}"${t==='tel'||t==='email'?' dir="ltr"':''} autocomplete="off"></label>`;
  sh.innerHTML='<b>بيانات المكتب</b><div class="hint">تُحفظ في إعدادات التطبيق وتظهر في جدول العنوان لكل لوحة تطبعها، من أي مشروع.</div>'
    +fld('kind','صفة المكتب (عنوان الخانة)')+fld('name','اسم المكتب')+fld('phone','الهاتف','tel')+fld('email','البريد الإلكتروني','email')+fld('addr','العنوان')
    +`<button id="ok">${back?'رجوع':'تم'}</button>`;
  sh.querySelectorAll('input[data-k]').forEach(i=>{i.value=c[i.dataset.k]||'';i.oninput=()=>{coSet({[i.dataset.k]:i.value})}});
  $('#ok').onclick=()=>{if(back)back();else{sh.classList.remove('on');upd()}};
  sh.classList.add('on');$('#ctx').style.display='none';
}

function settingsSheet(){
  const sh=$('#sheet');
  const chips=(id,items,cur)=>`<div class="chips" id="${id}">${items.map(([v,l])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  sh.innerHTML='<b>الوحدات</b>'+chips('cu',[['m','متر'],['cm','سنتيمتر']],ST.unit)
    +'<b>حجم الشبكة والالتقاط</b>'+chips('cg',[[0,'تلقائي'],[.05,'5 سم'],[.1,'10 سم'],[.25,'25 سم'],[.5,'50 سم'],[1,'1 م']],ST.gs)
    +'<b>الخصائص العامة</b><div class="chips"><button class="chip" id="dynInputToggle">الإدخال الرقمي</button></div>'
    +'<b>الإظهار</b><div class="chips" id="ct">'+[
      ['grid','الشبكة'],
      ['axes','المعلم والأصل'],
      ['coord','الإحداثيات']
    ].map(([k,l])=>`<button class="chip${ST[k]?' on':''}" data-k2="${k}">${l}</button>`).join('')+'</div>'
    +'<b>خصائص العرض</b><div class="chips"><button class="chip" id="showDims">إظهار الأبعاد</button><button class="chip" id="showAreas">إظهار المساحات</button></div>'
    +'<b>استيراد وتصدير</b><div class="chips"><button class="chip" id="pimport">استيراد مشروع / DXF</button><button class="chip" id="pexport">تصدير مشروع / DXF</button></div>'
    +'<b>بيانات المكتب (للطباعة)</b><div class="chips"><button class="chip" id="poffice">تعديل بيانات المكتب</button></div>'
    +'<b>التخزين</b><div class="hint" id="stinfo">…</div>'
    +'<b>مساعدة</b><div class="chips"><button class="chip" id="pkeys">اختصارات لوحة المفاتيح</button></div>'
    +'<button id="ok">تم</button>';
  const pick=(id,fn)=>sh.querySelectorAll(`#${id} .chip`).forEach(b=>{
    b.onclick=()=>{fn(b.dataset.v);sh.querySelectorAll(`#${id} .chip`).forEach(x=>x.classList.toggle('on',x===b));save();upd();draw()}
  });
  pick('cu',v=>{ST.unit=v});pick('cg',v=>{ST.gs=+v});
  const syncView=()=>{$('#showDims').classList.toggle('on',!!ST.showDims);$('#showAreas').classList.toggle('on',!!ST.showAreas)};
  $('#showDims').onclick=()=>{ST.showDims=ST.showDims?0:1;save();syncView();draw()};
  $('#showAreas').onclick=()=>{ST.showAreas=ST.showAreas?0:1;save();syncView();draw()};
  syncView();
  $('#poffice').onclick=()=>officeSheet(settingsSheet);$('#pimport').onclick=importChoice;$('#pexport').onclick=exportChoice;$('#pkeys').onclick=keysSheet;
  Store.describe().then(t=>{const el=$('#stinfo');if(el)el.textContent=t});
  sh.querySelectorAll('#ct .chip').forEach(b=>{b.onclick=()=>{const k=b.dataset.k2;ST[k]=ST[k]?0:1;b.classList.toggle('on',!!ST[k]);save();draw()}});
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
  const dynToggle=$('#dynInputToggle');
  const syncDynToggle=()=>dynToggle.classList.toggle('on',!!S.dyn);
  syncDynToggle();
  dynToggle.onclick=()=>{
    S.dyn=S.dyn?0:1;
    syncDynToggle();
    diSetOpen(diOpen,false);
    toast(S.dyn?'الإدخال الرقمي متاح أثناء الرسم — استخدم زر لوحة المفاتيح':'الإدخال الرقمي معطّل أثناء الرسم');
    save();
    upd()
  };
}

$('#stg').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');settingsSheet()};
