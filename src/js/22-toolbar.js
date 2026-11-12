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
  $$('[data-dm]').forEach(b=>b.classList.toggle('on',tool==='dim'&&b.dataset.dm===dimMode));
  $$('[data-g]').forEach(b=>{const m=$('#'+b.dataset.g);let it=m.querySelector(tool==='furn'?`[data-fk="${furnKind}"]`:tool==='dim'?`[data-dm="${dimMode}"]`:`[data-t="${tool}"]`);if(b.dataset.g==='gedit'&&editAction&&['offset','mirror','array','bmove','bcopy','stretch','brk1','brk2'].includes(editAction))it=m.querySelector(`[data-a="${editAction}"]`);b.classList.toggle('on',!!it);b.classList.toggle('has-active',!!it);b.title=it?`الأداة الحالية: ${it.textContent.trim()}`:b.dataset.groupTitle||b.textContent.trim();const icon=b.querySelector('svg'),selected=it&&it.querySelector('svg');if(icon&&b.dataset.defaultIcon)icon.innerHTML=selected?selected.innerHTML:b.dataset.defaultIcon});
  $$('[data-s]').forEach(b=>{b.classList.toggle('on',!!S[b.dataset.s]);b.setAttribute('aria-pressed',S[b.dataset.s]?'true':'false')});
  $('#snap').classList.toggle('on',Object.values(S).some(Boolean));
  const vb=$('#vdel');if(vb)vb.style.display=vtxSel()?'':'none';   // زر «حذف رأس» يظهر فقط مع رأس نشط
}
// ---- الأزرار ----
$$('[data-t]').forEach(b=>b.onclick=()=>{if(polyDraft)finishPolyline();closeDrawFlow();closeMoveFlow();cornerFirst=null;breakFirst=null;editAction=null;tool=b.dataset.t;if(tool==='dim'){dimMode='linear';dimDraft=[]}sel=[];if(tool==='trim')toast('المس الجزء المراد قصه من خط أو جدار');if(tool==='extend')toast('المس قرب طرف الخط أو الجدار لتمديده');$('#sheet').classList.remove('on');$$('.gm').forEach(m=>m.classList.remove('on'));upd();draw();startDrawFlow(tool);if(tool==='fillet'||tool==='chamfer')cornerSheet()});

$('#snap').onclick=()=>{$$('.gm').forEach(m=>m.classList.remove('on'));$('#smenu').classList.toggle('on')};

const SNAP_ICONS={end:'<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg>',mid:'<svg viewBox="0 0 24 24"><path d="M12 4L20 19H4Z"/></svg>',int:'<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',cen:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',grid:'<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM12 4v16M4 12h16"/></svg>',ortho:'<svg viewBox="0 0 24 24"><path d="M5 5v14h14"/></svg>',parallel:'<svg viewBox="0 0 24 24"><path d="M7 4L3 20M17 4l-4 16"/></svg>',perpendicular:'<svg viewBox="0 0 24 24"><path d="M5 5v14h14M9 5h10v10"/></svg>',per:'<svg viewBox="0 0 24 24"><path d="M4 20h16M10 20V5M10 15h4v5"/></svg>',nea:'<svg viewBox="0 0 24 24"><path d="M6 5h12L6 19h12z"/></svg>',polar:'<svg viewBox="0 0 24 24"><path d="M4 20L20 4M4 20h16M4 20V4"/></svg>'};
$$('[data-s]').forEach(b=>{if(!b.querySelector('.snap-ico'))b.insertAdjacentHTML('afterbegin',`<span class="snap-ico">${SNAP_ICONS[b.dataset.s]||''}</span>`);b.setAttribute('aria-pressed',S[b.dataset.s]?'true':'false');b.onclick=()=>{
  const k=b.dataset.s;S[k]=S[k]?0:1;
  if(k==='parallel'||k==='perpendicular'){
    if(S[k])S[k==='parallel'?'perpendicular':'parallel']=0;
    parallelRef=null;parallelGuide=null;
    toast(S[k]?(k==='parallel'?'الموازاة مفعّلة: المس خطًا مرجعيًا أولًا':'التعامد مع مرجع مفعّل: المس خطًا مرجعيًا أولًا'):'تم إيقاف القيد');
  }else if(k==='ortho'&&S.ortho)toast('التعامد الأفقي والرأسي مفعّل');
  upd();save();draw();
}});
// ---- مجموعات الأدوات: رسم / إضافة (تنقل أزرار الأدوات إلى قائمة منبثقة) ----
const GROUPS=[['gdraw','رسم','<path d="M4 20l4-1 11-11-3-3L5 16z"/>',['line','wall','rect','circle','arc','ellipse','polygon','polyline','tri','free']],['gadd','إضافة','<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',['door','door2','win','text','north']],['gedit','تعديل','<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.5L20 18M8.5 16.5L20 6"/>',['trim','extend','fillet','chamfer']],['gdim','أبعاد','<path d="M3 7v10M21 7v10M3 12h18M7 9l-4 3 4 3M17 9l4 3-4 3"/>',['dim']]];

GROUPS.forEach(([id,label,icon,tools])=>{
  const gb=document.createElement('button'),menu=document.createElement('div');
  gb.dataset.g=id;gb.dataset.groupTitle=label;gb.dataset.defaultIcon=icon;gb.className='tool-group';gb.setAttribute('aria-label',label);gb.innerHTML=`<svg viewBox="0 0 24 24">${icon}</svg><span>${label}</span>`;menu.className='gm';menu.id=id;
  $(`nav [data-t="${tools[0]}"]`).before(gb);
  tools.forEach(t=>menu.append($(`nav [data-t="${t}"]`)));
  if(id==='gdim')menu.querySelector('[data-t="dim"]').dataset.dm='linear';
  $('main').append(menu);
});
const DIM_TOOLS=[
  ['aligned','مائل','<path d="M4 18L20 6M4 6v12M20 6v12"/>'],
  ['horizontal','أفقي','<path d="M4 12h16M4 7v10M20 7v10"/>'],
  ['vertical','عمودي','<path d="M12 4v16M7 4h10M7 20h10"/>'],
  ['angular','زاوية','<path d="M4 19h16M4 19l10-13M9 19a5 5 0 0 1 2-4"/>'],
  ['radius','نصف القطر','<circle cx="12" cy="12" r="8"/><path d="M12 12l7-7"/>'],
  ['diameter','القطر','<circle cx="12" cy="12" r="8"/><path d="M5 19L19 5M5 19l5-1M19 5l-1 5"/>']
];
DIM_TOOLS.forEach(([mode,label,icon])=>{
  const b=document.createElement('button');b.dataset.dm=mode;b.innerHTML=`<svg viewBox="0 0 24 24">${icon}</svg>${label}`;
  b.onclick=()=>{editAction=null;dimMode=mode;dimDraft=[];tool='dim';sel=[];closeDrawFlow();$$('.gm').forEach(m=>m.classList.remove('on'));upd();draw();toast(mode==='angular'?'حدّد رأس الزاوية ثم نقطتين على ضلعيها':mode==='radius'||mode==='diameter'?'المس دائرة لإظهار البعد':'حدّد نقطتي البعد ثم اسحب لتحديد موضع خط القياس')};
  $('#gdim').append(b);
});


[['offset','إزاحة','<path d="M4 8h16M4 16h16"/><path d="M12 8v8M9 13l3 3 3-3"/>'],['mirror','انعكاس','<path d="M12 3v18M7 7l-4 5 4 5zM17 7l4 5-4 5z"/>'],['array','تكرار','<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'],['explode','تفكيك','<path d="M4 4l5 3M20 4l-5 3M4 20l5-3M20 20l-5-3M12 9v6"/>'],['join','ربط','<path d="M3 18l7-7M14 13l7-7"/><circle cx="12" cy="12" r="2"/>'],['bmove','نقل بنقطة','<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'],['bcopy','نسخ بنقطة','<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'],['stretch','شدّ','<rect x="3" y="6" width="8" height="12" stroke-dasharray="2 2"/><path d="M11 12h10M18 9l3 3-3 3"/>'],['brk1','كسر عند نقطة','<path d="M3 12h6M15 12h6M12 6v12"/>'],['brk2','كسر بين نقطتين','<path d="M3 12h5M16 12h5M10 7v10M14 7v10"/>']].forEach(([a,l,ic])=>{const b=document.createElement('button');b.dataset.a=a;b.innerHTML=`<svg viewBox="0 0 24 24">${ic}</svg>${l}`;b.onclick=()=>opAction(a);$('#gedit').append(b)});

const fm=document.createElement('div');fm.className='gm';fm.id='gfurn';

Object.keys(SYM).forEach(k=>{const b=document.createElement('button');b.dataset.fk=k;b.innerHTML=furnIcon(k)+SYM[k].n;b.onclick=()=>{editAction=null;furnKind=k;tool='furn';sel=[];closeDrawFlow();$$('.gm').forEach(m=>m.classList.remove('on'));upd();draw();startDrawFlow('furn')};fm.append(b)});

$('main').append(fm);

const fbtn=document.createElement('button');fbtn.dataset.g='gfurn';fbtn.dataset.groupTitle='أثاث';fbtn.dataset.defaultIcon='<path d="M3 12V8a2 2 0 012-2h14a2 2 0 012 2v4M3 12h18v5H3zM5 17v2M19 17v2"/>';fbtn.innerHTML=`<svg viewBox="0 0 24 24">${fbtn.dataset.defaultIcon}</svg>أثاث`;$('#lyb').before(fbtn);

$$('[data-g]').forEach(b=>b.onclick=()=>{
  const m=$('#'+b.dataset.g),was=m.classList.contains('on');
  $$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');$('#sheet').classList.remove('on');
  if(!was)m.classList.add('on');upd();
});

