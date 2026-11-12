/* ==================================================================
 * 15-properties.js
 * خصائص العنصر: لوحة الخيارات (اللون، السمك، الطبقة، التعبئة، القياسات).
 *
 * يعرّف: opts، dynAngle، dynSpec، applyGeometryValues
 * يعتمد على: 01-core.js، 02-geometry.js، 05-persistence.js، 09-render.js،
 *            22-toolbar.js
 * ================================================================== */

// ---- خيارات: اللون والسمك والأبعاد ----
function opts(){
  if(!sel.length)return;
  const sh=$('#sheet'),s1=sel.length===1?shapes[sel[0]]:null,first=shapes[sel[0]],F=[];let done=0;
  const once=()=>{if(!done){snap();done=1}};
  const drawingSelection=sel.length>0&&sel.every(i=>isDrawLineShape(shapes[i]));
  if(s1){
    if(!['line','wall','dim','free','polyline','door','door2','win','text','north','furn'].includes(s1.t))F.push(['name','الاسم',s1.name||'']);
    if(s1.t==='text')F.push(['txt','النص',s1.txt||'']);
    if(s1.t==='dim'&&!['radius','diameter'].includes(s1.mode))F.push(['off',s1.mode==='angular'?'نصف قطر قوس الزاوية':'الإزاحة ('+uA()+')',fu(s1.off||.6)]);
    if(s1.t==='dim'&&s1.mode!=='angular')F.push(['prec','الدقة العشرية',String(clamp(Math.round(Number(s1.prec??2)),0,4))]);
    F.push(...dynSpec(s1));

  }
  sh.innerHTML=`<b>اللون</b><div class="sws">${COLS.map(c=>`<button class="sw${c?'':' auto'}${c===(first.col||'')?' on':''}" data-c="${c}" style="${c?'background:'+c:''}" aria-label="لون"></button>`).join('')}</div>`
    +`<label>الطبقة<select id="elementLayer">${LY.map(l=>`<option value="${esc(l.id)}" ${l.id===(first.ly||LY[0]?.id)?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>`
    +`<label>السُّمك<input type="range" id="lw" min="1" max="10" step=".5"><b id="lwv"></b></label>`
    +(sel.some(i=>['rect','circle','ellipse','tri','polygon'].includes(shapes[i].t))?`<b>التعبئة</b><div class="chips" id="fk">${[['','بدون'],['solid','لون'],['tile','بلاط'],['wood','خشب'],['hatch','تهشير'],['dots','نقاط']].map(([v,l])=>`<button class="chip${(first.fk||'')===v?' on':''}" data-v="${v}">${l}</button>`).join('')}</div><div class="sws" id="fc">${COLS.map(c=>`<button class="sw${c?'':' auto'}${c===(first.fc||'')?' on':''}" data-c="${c}" style="${c?'background:'+c:''}" aria-label="لون التعبئة"></button>`).join('')}</div>`:'')
    +F.map(x=>x[0]==='prec'?`<label>${x[1]}<select data-k="prec"><option value="0">0</option><option value="1">0.0</option><option value="2">0.00</option><option value="3">0.000</option><option value="4">0.0000</option></select></label>`:`<label>${x[1]}<input data-k="${x[0]}" ${x[0]==='name'||x[0]==='txt'?'type="text"':'dir="ltr" inputmode="decimal"'}></label>`).join('')
    +(drawingSelection?'<div class="prop-line-types"><b>خصائص الخط</b><label>نوع الخط<select id="propLineType"><option value="">افتراضي الطبقة</option><option value="continuous">متصل</option><option value="dashed">متقطع</option><option value="dotted">منقط</option><option value="dashdot">شرطة ونقطة</option><option value="center">محوري</option><option value="hidden">مخفي</option></select></label><label><input type="checkbox" id="propDoubleLine"> خط مزدوج</label><label>المسافة بين الخطين<input id="propDoubleGap" type="number" min="0.01" step="0.01" value="${s1?.doubleLineGap??0.1}"></label></div>':'')
    +(s1&&s1.t==='door'?'<div class="row"><button class="fl" data-f="f">قلب الفتح</button><button class="fl" data-f="h">عكس المفصلة</button></div>':s1&&s1.t==='door2'?'<button class="fl" data-f="f">قلب اتجاه الفتح</button>':'')
    +(s1&&s1.t==='rect'?'<button class="fl" id="tw">إضافة جدران حولها</button>':'')+'<button id="ok">تم</button>';
  F.forEach(x=>sh.querySelector(`[data-k="${x[0]}"]`).value=x[2]);
  $('#elementLayer').onchange=e=>{once();const id=e.target.value;sel.forEach(i=>{shapes[i].ly=id});save();draw()};
  if(drawingSelection){const lt=$('#propLineType'),dl=$('#propDoubleLine'),dg=$('#propDoubleGap');if(s1){lt.value=s1.linetype||'';dl.checked=!!s1.doubleLine;dg.value=s1.doubleLineGap??.1}else{lt.value='';dl.checked=sel.every(i=>!!shapes[i].doubleLine)}
   const applyLineProps=()=>{once();sel.forEach(i=>{const s=shapes[i];if(!isDrawLineShape(s))return;s.linetype=lt.value||undefined;s.doubleLine=dl.checked;const v=nu(dg.value);if(Number.isFinite(v)&&v>0)s.doubleLineGap=v});save();draw()};
   lt.onchange=applyLineProps;dl.onchange=applyLineProps;dg.onchange=applyLineProps;
  }
  $('#lw').value=first.lw||2;$('#lwv').textContent=first.lw||2;
  sh.querySelectorAll('.sws:not(#fc) .sw').forEach(b=>b.onclick=()=>{
    once();const c=b.dataset.c;sel.forEach(i=>{shapes[i].col=c||undefined});D.col=c;
    sh.querySelectorAll('.sws:not(#fc) .sw').forEach(x=>x.classList.toggle('on',x===b));save();draw();
  });
  $('#lw').oninput=e=>{once();const v=+e.target.value;sel.forEach(i=>{shapes[i].lw=v});D.lw=v;$('#lwv').textContent=v;save();draw()};
  sh.querySelectorAll('.fl').forEach(b=>b.onclick=()=>{once();s1[b.dataset.f]*=-1;save();draw()});
  const isC=s=>['rect','circle','ellipse','tri','polygon'].includes(s.t);
  sh.querySelectorAll('#fk .chip').forEach(b=>{b.onclick=()=>{once();const v=b.dataset.v||undefined;sel.forEach(i=>{if(isC(shapes[i]))shapes[i].fk=v});sh.querySelectorAll('#fk .chip').forEach(x=>x.classList.toggle('on',x===b));save();draw()}});
  sh.querySelectorAll('#fc .sw').forEach(b=>{b.onclick=()=>{once();const c=b.dataset.c||undefined;sel.forEach(i=>{if(isC(shapes[i]))shapes[i].fc=c});sh.querySelectorAll('#fc .sw').forEach(x=>x.classList.toggle('on',x===b));save();draw()}});
  const tw=$('#tw');if(tw)tw.onclick=()=>{once();const k=rc(s1);k.forEach((q,j)=>shapes.push({t:'wall',a:q,b:k[(j+1)%4],th:D.th||.2,ly:s1.ly,col:s1.col}));sel=[];sh.classList.remove('on');save();upd();draw()};
  $('#ok').onclick=()=>{
    if(s1&&F.length){
      once();const v=k=>{const el=sh.querySelector(`[data-k="${k}"]`);return el?Math.abs(k==='th'?num(el.value):nu(el.value)):0},nm=sh.querySelector('[data-k="name"]');
      if(nm)s1.name=nm.value.trim()||undefined;
      if(s1.t==='text'){
        const tx=sh.querySelector('[data-k="txt"]');
        if(tx)s1.txt=tx.value.trim()||s1.txt;
      }
      applyGeometryValues(s1,k=>{const el=sh.querySelector(`[data-k="${k}"]`);return el?el.value:undefined});
      if(s1.t==='dim'){
        const off=sh.querySelector('[data-k="off"]'),prec=sh.querySelector('[data-k="prec"]');
        if(off){const n=nu(off.value);if(Number.isFinite(n))s1.off=n}
        if(prec)s1.prec=clamp(Math.round(num(prec.value)||0),0,4);
      }
      if(s1.t==='wall'){D.th=s1.th}

    }
    sh.classList.remove('on');save();upd();draw();
  };
  sh.classList.add('on');$('#ctx').style.display='none';
}

$('#op').onclick=opts;
// القيم الهندسية القابلة للتعديل لكل نوع من عناصر الرسم (تُعرض في لوحة الخصائص)
function dynAngle(dx,dy){let a=deg(Math.atan2(-dy,dx));return (a+360)%360}

function dynSpec(s){
  const b=bx(s),cx=(b.x+b.X)/2,cy=(b.y+b.Y)/2;
  if(s.t==='rect')return [['w','العرض',fu(s.w)],['h','الارتفاع',fu(s.h)],['ang','الزاوية °',f(deg(s.rot||0))]];
  if(s.t==='circle')return [['r','نصف القطر',fu(s.r)]];
  if(s.t==='dim'&&s.mode==='angular')return [];
  if(s.t==='line'||s.t==='wall'||s.t==='dim')return [['L','الطول',fu(len(s))],['ang','الزاوية °',f(dynAngle(s.b[0]-s.a[0],s.b[1]-s.a[1]))],...(s.t==='wall'?[['th','السماكة',fu(s.th)]]:[])];
  if(s.t==='arc')return [['r','نصف القطر',fu(s.r)],['a0','زاوية البداية °',f(deg(s.a0||0))],['a1','زاوية النهاية °',f(deg(s.a1||0))]];
  if(s.t==='ellipse')return [['rx','نصف المحور X',fu(s.rx)],['ry','نصف المحور Y',fu(s.ry)],['ang','زاوية الدوران °',f(deg(s.rot||0))]];
  if(s.t==='tri')return [['w','العرض',fu(b.X-b.x)],['h','الارتفاع',fu(b.Y-b.y)]];
  if(s.t==='polygon'){
    const p=s.p||[],n=p.length,c=p.reduce((a,q)=>[a[0]+q[0]/n,a[1]+q[1]/n],[0,0]),r=n?Math.hypot(p[0][0]-c[0],p[0][1]-c[1]):1;
    return [['r','نصف قطر المضلع',fu(r)],['sides','عدد الأضلاع',String(n)],['ang','زاوية البداية °',f(dynAngle(p[0][0]-c[0],p[0][1]-c[1]))]];
  }
  if(s.t==='polyline'||s.t==='free'){
    const p=s.p||[],n=p.length;if(n<2)return [];
    const a=p[n-2],z=p[n-1];return [['L','طول آخر مقطع',fu(Math.hypot(z[0]-a[0],z[1]-a[1]))],['ang','زاوية آخر مقطع °',f(dynAngle(z[0]-a[0],z[1]-a[1]))]];
  }
  if(s.t==='furn')return [['w','العرض',fu(s.w)],['h','الطول',fu(s.h)],['ang','زاوية الدوران °',f(deg(s.rot||0))]];
  if(s.t==='door2')return [['w1','عرض الجهة الأولى',fu(s.w1)],['w2','عرض الجهة الثانية',fu(s.w2)],['ang','زاوية العنصر °',f(deg(s.a||0))],['oa','زاوية الفتح °',f(s.oa===undefined?90:s.oa)]];
  if(s.t==='door')return [['w','العرض',fu(s.w)],['ang','زاوية العنصر °',f(deg(s.a||0))],['oa','زاوية الفتح °',f(s.oa===undefined?90:s.oa)]];
  if(s.t==='win')return [['w','العرض',fu(s.w)],['ang','زاوية العنصر °',f(deg(s.a||0))]];
  if(s.t==='text'||s.t==='north')return [['h','الحجم',fu(s.h)],['ang','زاوية الدوران °',f(deg(s.a||0))]];
  return [];
}

function applyGeometryValues(s,get){
  const v=k=>{const n=num(get(k));return Number.isFinite(n)?n:NaN};
  const old=copy(s);
  const angle=k=>{const n=v(k);return Number.isFinite(n)?rad(n):null};
  if(s.t==='rect'){
    const w=nu(get('w')),h=nu(get('h')),a=angle('ang');
    if(w>0)s.w=w;if(h>0)s.h=h;if(a!==null)s.rot=a;if(old.cornerBase)resizeCornerGeometry(s,old);
  }else if(s.t==='circle'){const r=nu(get('r'));if(r>0)s.r=r}
  else if(s.t==='dim'&&(s.mode==='radius'||s.mode==='diameter')){
    const L=nu(get('L')),a=angle('ang'),oldL=len(s)||1,l=L>0?L:oldL,ang=a===null?Math.atan2(-(s.b[1]-s.a[1]),s.b[0]-s.a[0]):a;
    if(L>0||a!==null){if(s.mode==='radius'){s.b=[s.a[0]+l*Math.cos(ang),s.a[1]-l*Math.sin(ang)]}else{const cx=(s.a[0]+s.b[0])/2,cy=(s.a[1]+s.b[1])/2,dx=Math.cos(ang)*l/2,dy=-Math.sin(ang)*l/2;s.a=[cx-dx,cy-dy];s.b=[cx+dx,cy+dy]}delete s.circleId}
  }else if(s.t==='line'||s.t==='wall'||s.t==='dim'){
    const L=nu(get('L')),a=angle('ang'),d=len(s)||1;
    if(L>0||a!==null){const q=a===null?Math.atan2(-(s.b[1]-s.a[1]),s.b[0]-s.a[0]):a,l=L>0?L:d;s.b=[s.a[0]+l*Math.cos(q),s.a[1]-l*Math.sin(q)];if(s.t==='dim'){s.lb=undefined}}
    if(s.t==='wall'){const th=nu(get('th'));if(th>0)s.th=th}
  }else if(s.t==='arc'){
    const r=nu(get('r')),a0=angle('a0'),a1=angle('a1');if(r>0)s.r=r;if(a0!==null)s.a0=a0;if(a1!==null)s.a1=a1;while(s.a1<=s.a0)s.a1+=Math.PI*2;
  }else if(s.t==='ellipse'){
    const rx=nu(get('rx')),ry=nu(get('ry')),a=angle('ang');if(rx>0)s.rx=rx;if(ry>0)s.ry=ry;if(a!==null)s.rot=a;
  }else if(s.t==='tri'){
    const b=bx(old),w0=Math.max(.0001,b.X-b.x),h0=Math.max(.0001,b.Y-b.y),w=nu(get('w')),h=nu(get('h'));
    s.p=old.p.map(q=>[b.x+(q[0]-b.x)*(w>0?w/w0:1),b.y+(q[1]-b.y)*(h>0?h/h0:1)]);
  }else if(s.t==='polygon'){
    const p=old.p||[],n0=p.length,c=p.reduce((z,q)=>[z[0]+q[0]/n0,z[1]+q[1]/n0],[0,0]),r=nu(get('r')),sides=Math.round(v('sides')),a=angle('ang');
    const radius=r>0?r:(n0?Math.hypot(p[0][0]-c[0],p[0][1]-c[1]):1),count=Number.isFinite(sides)?clamp(sides,3,32):n0,ang=a===null?(n0?Math.atan2(p[0][1]-c[1],p[0][0]-c[0]):0):-a;
    s.p=Array.from({length:count},(_,i)=>[c[0]+radius*Math.cos(ang+i*2*Math.PI/count),c[1]+radius*Math.sin(ang+i*2*Math.PI/count)]);
  }else if(s.t==='polyline'||s.t==='free'){
    const p=s.p||[],n=p.length;if(n>=2){const a=p[n-2],z=p[n-1],oldL=Math.hypot(z[0]-a[0],z[1]-a[1])||1,L=nu(get('L')),ang=angle('ang'),q=ang===null?Math.atan2(-(z[1]-a[1]),z[0]-a[0]):ang,l=L>0?L:oldL;p[n-1]=[a[0]+l*Math.cos(q),a[1]-l*Math.sin(q)]}
  }else if(s.t==='furn'){
    const cx=s.x+s.w/2,cy=s.y+s.h/2,w=nu(get('w')),h=nu(get('h')),a=angle('ang');if(w>0){s.w=w;s.x=cx-w/2}if(h>0){s.h=h;s.y=cy-h/2}if(a!==null)s.rot=a;
  }else if(s.t==='door2'){
    const w1=nu(get('w1')),w2=nu(get('w2')),a=angle('ang'),oa=v('oa');if(w1>0)s.w1=w1;if(w2>0)s.w2=w2;s.w=s.w1+s.w2;if(a!==null)s.a=a;if(Number.isFinite(oa))s.oa=clamp(oa,0,180);
  }else if(s.t==='door'||s.t==='win'){
    const w=nu(get('w')),a=angle('ang');if(w>0)s.w=w;if(a!==null)s.a=a;if(s.t==='door'){const oa=v('oa');if(Number.isFinite(oa))s.oa=clamp(oa,0,180)}
  }else if(s.t==='text'||s.t==='north'){
    const h=nu(get('h')),a=angle('ang');if(h>0)s.h=h;if(a!==null)s.a=a;
  }
}


