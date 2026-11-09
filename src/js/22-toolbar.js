/* ==================================================================
 * 22-toolbar.js
 * الشريط السفلي والقوائم: تحديث حالة الأزرار upd، ربط أزرار الأدوات، مجموعات
 * الأدوات المنبثقة، قائمة الأثاث، وقائمة الالتقاط.
 *
 * يعرّف: upd، GROUPS، fm، fbtn
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            07-projects.js، 09-render.js، 11-furniture.js، 13-draw-input.js،
 *            14-pointer.js، 15-properties.js، 16-edit-tools.js
 * ================================================================== */

function upd(){
  const n=sel.length;$('#pn').textContent=pname();
  $('#tot').textContent=`المساحة الكلية ${f(shapes.reduce((a,s)=>a+(shown(s)&&!s.ex?area(s):0),0))} م² ▾`;
  $('#undo').disabled=!hist.length;$('#redo').disabled=!redo.length;$('#ctx').style.display=tool==='select'||n?'flex':'none';
  $('#op').disabled=$('#cp').disabled=$('#del').disabled=$('#rt').disabled=$('#scale').disabled=!n;$('#ps').disabled=!clip.length;
  $$('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===tool));
  $$('[data-fk]').forEach(b=>b.classList.toggle('on',tool==='furn'&&b.dataset.fk===furnKind));
  $$('[data-g]').forEach(b=>{const m=$('#'+b.dataset.g),it=m.querySelector(tool==='furn'?`[data-fk="${furnKind}"]`:`[data-t="${tool}"]`);b.dataset.h=b.dataset.h||b.innerHTML;b.innerHTML=it?it.innerHTML:b.dataset.h;b.classList.toggle('on',!!it)});
  $$('[data-s]').forEach(b=>b.classList.toggle('on',!!S[b.dataset.s]));
  $('#snap').classList.toggle('on',Object.values(S).some(Boolean));
}
// ---- الأزرار ----
$$('[data-t]').forEach(b=>b.onclick=()=>{if(polyDraft)finishPolyline();closeDrawFlow();tool=b.dataset.t;sel=[];hideDyn();if(tool==='trim')toast('المس الجزء المراد قصه من خط أو جدار');if(tool==='extend')toast('المس قرب طرف الخط أو الجدار لتمديده');$('#sheet').classList.remove('on');$$('.gm').forEach(m=>m.classList.remove('on'));upd();draw();startDrawFlow(tool)});

$('#snap').onclick=()=>{$$('.gm').forEach(m=>m.classList.remove('on'));$('#smenu').classList.toggle('on')};

$('[data-s]').forEach(b=>b.onclick=()=>{
  const k=b.dataset.s;S[k]=S[k]?0:1;
  if(k==='parallel'){
    parallelRef=null;parallelGuide=null;
    toast(S.parallel?'الموازاة مفعّلة: المس خطًا مرجعيًا أولًا':'تم إيقاف الموازاة');
  }else if(k==='ortho'&&S.ortho)toast('التعامد مفعّل: اتجاه أفقي أو رأسي');
  upd();save();draw();
});
// ---- مجموعات الأدوات: رسم / إضافة (تنقل أزرار الأدوات إلى قائمة منبثقة) ----
const GROUPS=[['gdraw','رسم','<path d="M4 20l4-1 11-11-3-3L5 16z"/>',['line','wall','rect','circle','arc','ellipse','polygon','polyline','tri','free']],['gadd','إضافة','<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',['door','win','text','north']],['gedit','تعديل','<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5L20 18M8.5 16.5L20 6"/>',['trim','extend']]];

GROUPS.forEach(([id,label,icon,tools])=>{
  const gb=document.createElement('button'),menu=document.createElement('div');
  gb.dataset.g=id;gb.innerHTML=`<svg viewBox="0 0 24 24">${icon}</svg>${label}`;menu.className='gm';menu.id=id;
  $(`nav [data-t="${tools[0]}"]`).before(gb);
  tools.forEach(t=>menu.append($(`nav [data-t="${t}"]`)));
  $('main').append(menu);
});

[['offset','إزاحة','<path d="M4 8h16M4 16h16"/><path d="M12 8v8M9 13l3 3 3-3"/>'],['mirror','انعكاس','<path d="M12 3v18M7 7l-4 5 4 5zM17 7l4 5-4 5z"/>'],['array','تكرار','<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>']].forEach(([a,l,ic])=>{const b=document.createElement('button');b.dataset.a=a;b.innerHTML=`<svg viewBox="0 0 24 24">${ic}</svg>${l}`;b.onclick=()=>opAction(a);$('#gedit').append(b)});

const fm=document.createElement('div');fm.className='gm';fm.id='gfurn';

Object.keys(SYM).forEach(k=>{const b=document.createElement('button');b.dataset.fk=k;b.innerHTML=furnIcon(k)+SYM[k].n;b.onclick=()=>{furnKind=k;tool='furn';sel=[];hideDyn();closeDrawFlow();$$('.gm').forEach(m=>m.classList.remove('on'));upd();draw();startDrawFlow('furn')};fm.append(b)});

$('main').append(fm);

const fbtn=document.createElement('button');fbtn.dataset.g='gfurn';fbtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 12V8a2 2 0 012-2h14a2 2 0 012 2v4M3 12h18v5H3zM5 17v2M19 17v2"/></svg>أثاث';$('#lyb').before(fbtn);

$$('[data-g]').forEach(b=>b.onclick=()=>{
  const m=$('#'+b.dataset.g),was=m.classList.contains('on');
  $$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');$('#sheet').classList.remove('on');
  if(!was)m.classList.add('on');upd();
});
