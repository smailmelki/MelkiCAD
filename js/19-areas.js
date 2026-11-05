/* ==================================================================
 * 19-areas.js
 * جدول المساحات: تحديد الغرف وحساب المساحة والمحيط، نسخ الجدول وحفظه CSV.
 *
 * يعرّف: inside، roomList، areaSheet
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 06-layers.js،
 *            07-projects.js، 08-project-io.js، 09-render.js، 22-toolbar.js
 * ================================================================== */

// ---- جدول المساحات: اضغط على رقم المساحة الكلية في أعلى الشاشة ----
function inside(s,p){
  if(s.t==='circle')return Math.hypot(p[0]-s.x,p[1]-s.y)<=s.r;
  if(s.t==='ellipse'){const c=Math.cos(-(s.rot||0)),n=Math.sin(-(s.rot||0)),dx=p[0]-s.x,dy=p[1]-s.y,x=dx*c-dy*n,y=dx*n+dy*c;return x*x/(s.rx*s.rx)+y*y/(s.ry*s.ry)<=1}
  if(s.t==='rect'){const c=Math.cos(-(s.rot||0)),n=Math.sin(-(s.rot||0)),dx=p[0]-(s.x+s.w/2),dy=p[1]-(s.y+s.h/2);return Math.abs(dx*c-dy*n)<=s.w/2&&Math.abs(dx*n+dy*c)<=s.h/2}
  const q=s.p;if(!q||q.length<3)return false;let hit=false;for(let i=0,j=q.length-1;i<q.length;j=i++){const a=q[i],b=q[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))hit=!hit}return hit;
}

function roomList(){
  const R=shapes.map((s,i)=>({s,i})).filter(o=>shown(o.s)&&['rect','circle','ellipse','tri','polygon'].includes(o.s.t)&&area(o.s)>.05);
  const claim=new Map();
  shapes.filter(t=>shown(t)&&t.t==='text'&&t.txt).forEach(t=>{
    let best=null;R.forEach(o=>{if(inside(o.s,[t.x,t.y])&&(!best||area(o.s)<area(best.s)))best=o});
    if(best&&!claim.has(best.i))claim.set(best.i,t.txt);
  });
  return R.map((o,k)=>{
    const s=o.s;
    const per=s.t==='rect'?2*(s.w+s.h):s.t==='circle'?2*Math.PI*s.r:s.t==='ellipse'?Math.PI*(3*(s.rx+s.ry)-Math.sqrt((3*s.rx+s.ry)*(s.rx+3*s.ry))):s.p.reduce((a,q,j)=>a+Math.hypot(q[0]-s.p[(j+1)%s.p.length][0],q[1]-s.p[(j+1)%s.p.length][1]),0);
    const dims=s.t==='rect'?`${fu(s.w)} × ${fu(s.h)}`:s.t==='circle'?`R ${fu(s.r)}`:s.t==='ellipse'?`${fu(s.rx)} × ${fu(s.ry)}`:'';
    return{i:o.i,name:s.name||claim.get(o.i)||`غرفة ${k+1}`,dims,area:area(s),per};
  });
}

function areaSheet(){
  const sh=$('#sheet'),rows=roomList();
  sh.innerHTML='<b>جدول المساحات</b><div class="at" id="atb"></div><div id="att" style="font-weight:600"></div><div class="row"><button class="fl" id="acp">نسخ</button><button class="fl" id="acs">حفظ CSV</button></div><button id="ok">تم</button>';
  const box=$('#atb'),inc=()=>rows.filter(r=>!shapes[r.i].ex),tot=()=>inc().reduce((a,r)=>a+r.area,0);
  const cell=(t,cls)=>{const d=document.createElement('div');d.textContent=t;if(cls)d.className=cls;return d};
  const goto=i=>{sel=[i];tool='select';sh.classList.remove('on');const b=bx(shapes[i]);V.x=W/2-(b.x+b.X)/2*V.s;V.y=H/2-(b.y+b.Y)/2*V.s;upd();draw()};
  const fill=()=>{
    box.textContent='';
    if(!rows.length){box.textContent='لا توجد غرف بعد: ارسم مستطيلًا أو دائرة أو مثلثًا';return}
    ['','الاسم','الأبعاد','م²'].forEach(h=>box.append(cell(h,'ah')));
    rows.forEach(r=>{
      const s=shapes[r.i],cb=document.createElement('button');cb.textContent=s.ex?'☐':'☑';cb.className='ack';cb.setAttribute('aria-label','تضمين في المجموع');
      cb.onclick=()=>{s.ex=s.ex?undefined:1;save();upd();fill()};
      const nm=cell(r.name,'anm');nm.onclick=()=>goto(r.i);
      box.append(cb,nm,cell(r.dims),cell(f(r.area)));
    });
    $('#att').textContent=`المجموع (${inc().length} من ${rows.length}): ${f(tot())} م²`;
  };
  fill();
  const txt=()=>['الاسم\tالأبعاد\tالمساحة م²\tالمحيط '+ul()].concat(rows.map(r=>`${r.name}\t${r.dims}\t${f(r.area)}\t${fu(r.per)}`)).concat([`المجموع\t\t${f(tot())}\t`]).join('\n');
  const csv=()=>'\ufeff'+[['#','الاسم','الأبعاد','المساحة م²','المحيط '+ul(),'ضمن المجموع']].concat(rows.map((r,n)=>[n+1,r.name,r.dims,f(r.area),fu(r.per),shapes[r.i].ex?'لا':'نعم'])).concat([['','المجموع','',f(tot()),'','']]).map(a=>a.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  $('#acp').onclick=async()=>{toast((await copyText(txt()))?'تم النسخ':'تعذّر النسخ، جرّب حفظ CSV')};
  $('#acs').onclick=async()=>{
    const nm=pname().replace(/[^\p{L}\p{N} _.()-]+/gu,'').trim()||'plan',res=await saveBlob(nm+'-areas.csv',new Blob([csv()],{type:'text/csv'}));
    if(res==='ok')toast('تم الحفظ');else if(res==='err')toast('الحفظ غير متاح هنا');
  };
  $('#ok').onclick=()=>{sh.classList.remove('on');upd()};
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#tot').onclick=()=>{$$('.gm').forEach(x=>x.classList.remove('on'));$('#smenu').classList.remove('on');areaSheet()};
