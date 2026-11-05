/* ==================================================================
 * 21-settings.js
 * الإعدادات: الوحدات، حجم الشبكة، خيارات الإظهار، والاستيراد والتصدير.
 *
 * يعرّف: settingsSheet
 * يعتمد على: 01-core.js، 05-persistence.js، 08-project-io.js، 09-render.js،
 *            22-toolbar.js
 * ================================================================== */

function settingsSheet(){
  const sh=$('#sheet');
  const chips=(id,items,cur)=>`<div class="chips" id="${id}">${items.map(([v,l])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-v="${v}">${l}</button>`).join('')}</div>`;
  sh.innerHTML='<b>الوحدات</b>'+chips('cu',[['m','متر'],['cm','سنتيمتر']],ST.unit)
    +'<b>حجم الشبكة والالتقاط</b>'+chips('cg',[[0,'تلقائي'],[.05,'5 سم'],[.1,'10 سم'],[.25,'25 سم'],[.5,'50 سم'],[1,'1 م']],ST.gs)
    +'<b>الخصائص العامة</b><div class="chips"><button class="chip" id="dynInputToggle">الإدخال الرقمي</button></div>'
    +'<b>الإظهار</b><div class="chips" id="ct">'+[['grid','الشبكة'],['axes','المعلم والأصل'],['coord','الإحداثيات']].map(([k,l])=>`<button class="chip${ST[k]?' on':''}" data-k2="${k}">${l}</button>`).join('')+'</div>'
    +'<b>خصائص العرض</b><div class="chips"><button class="chip" id="showDims">إظهار الأبعاد</button><button class="chip" id="showAreas">إظهار المساحات</button></div>'
    +'<b>استيراد وتصدير</b><div class="chips"><button class="chip" id="pimport">استيراد مشروع / DXF</button><button class="chip" id="pexport">تصدير مشروع / DXF</button></div>'
    +'<button id="ok">تم</button>';
  const pick=(id,fn)=>sh.querySelectorAll(`#${id} .chip`).forEach(b=>{b.onclick=()=>{fn(b.dataset.v);sh.querySelectorAll(`#${id} .chip`).forEach(x=>x.classList.toggle('on',x===b));save();upd();draw()}});
  pick('cu',v=>{ST.unit=v});pick('cg',v=>{ST.gs=+v});
  const syncView=()=>{$('#showDims').classList.toggle('on',!!ST.showDims);$('#showAreas').classList.toggle('on',!!ST.showAreas)};
  $('#showDims').onclick=()=>{ST.showDims=ST.showDims?0:1;save();syncView();draw()};
  $('#showAreas').onclick=()=>{ST.showAreas=ST.showAreas?0:1;save();syncView();draw()};
  syncView();
  $('#pimport').onclick=importChoice;$('#pexport').onclick=exportChoice;
  sh.querySelectorAll('#ct .chip').forEach(b=>{b.onclick=()=>{const k=b.dataset.k2;ST[k]=ST[k]?0:1;b.classList.toggle('on',!!ST[k]);save();draw()}});
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
  const dynToggle=$('#dynInputToggle');
  const syncDynToggle=()=>dynToggle.classList.toggle('on',!!S.dyn);
  syncDynToggle();
  dynToggle.onclick=()=>{S.dyn=S.dyn?0:1;syncDynToggle();diSetOpen(diOpen,false);toast(S.dyn?'الإدخال الرقمي متاح أثناء الرسم — استخدم زر لوحة المفاتيح':'الإدخال الرقمي معطّل أثناء الرسم');save();upd()};
}

$('#stg').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');settingsSheet()};
