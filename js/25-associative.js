/* ==================================================================
 * 25-associative.js
 * الارتباط التلقائي للأبواب والنوافذ والأبعاد بالعناصر المضيفة.
 * يُحمّل بعد 24-groups.js.
 * ================================================================== */
(() => {
  const OPENINGS = new Set(['door','door2','win']);
  // إرجاع الجدار والضلع وموضع الإسقاط، لا مجرد نقطة الإسقاط.
  function locateHost(p, radius) {
    let best = null, limit = radius;
    for (const host of shapes) {
      // حافظ على نطاق الالتقاط الأصلي: الجدار والخط وأضلاع الأشكال المغلقة.
      // نوع العنصر المضيف لا يُقيّد هنا؛ wallAt الأصلي كان يفحص كل الأضلاع الظاهرة.
      if (!host || !shown(host)) continue;
      const edges = segs(host);
      for (let i = 0; i < edges.length; i++) {
        const [a,b] = edges[i], dx=b[0]-a[0], dy=b[1]-a[1], l2=dx*dx+dy*dy;
        if (l2 < 1e-12) continue;
        const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,0,1);
        const q=[a[0]+dx*t,a[1]+dy*t], d=Math.hypot(q[0]-p[0],q[1]-p[1]);
        if (d < limit) { limit=d; best={host,i,t,q,a:Math.atan2(dy,dx),th:host.t==='wall'?host.th:0}; }
      }
    }
    return best;
  }

  // الالتقاط يعتمد مباشرة على الجدار؛ لا نسمح لعنصر آخر أقرب للمؤشر
  // بأن يمنع وضع الباب/النافذة على جدار صالح.
  wallAt = function(p,r) {
    const h=locateHost(p,r);
    return h ? {q:h.q,a:h.a,th:h.th,host:h.host,edge:h.i,t:h.t} : null;
  };

  let beforeCount = 0, beforeTool = '';
  cv.addEventListener('pointerdown', () => {
    beforeCount=shapes.length;
    beforeTool=tool;
  }, true);

  // ينفذ بعد معالج إنشاء الباب/النافذة الأصلي على pointerdown.
  cv.addEventListener('pointerdown', () => {
    if (!OPENINGS.has(beforeTool) || shapes.length<=beforeCount) return;
    const made=shapes.slice(beforeCount).filter(s=>OPENINGS.has(s.t)&&!s.host);
    for (const opening of made) {
      const h=locateHost([opening.x,opening.y],Math.max(.05,28/Math.max(V.s,1e-9)));
      if (!h) continue;
      opening.host={id:sid(h.host),edge:h.i,t:h.t,offset:0};
    }
    if (made.length) save();
  });

  // آخر موضع صالح لكل فتحة؛ يمنع إسقاطها خارج الجدار أثناء السحب.
  const lastValid = new WeakMap();

  function rememberValidOpenings() {
    for (const s of shapes) {
      if (s && OPENINGS.has(s.t) && s.host) {
        lastValid.set(s, {x:s.x,y:s.y,a:s.a,th:s.th,host:{...s.host}});
      }
    }
  }

  // سحب الباب/النافذة يسمح فقط بالانتقال إلى موضع قريب من جدار.
  // إذا خرج المؤشر عن جميع الجدران، تبقى الفتحة في آخر موضع صالح.
  function trackDraggedOpenings() {
    if (!g || g.k !== 'move' || !sel.length) return;
    const moving = sel.map(i => shapes[i]).filter(s => s && OPENINGS.has(s.t));
    if (!moving.length) return;
    const radius = Math.max(.05, 28 / Math.max(V.s, 1e-9));
    for (const opening of moving) {
      const host = locateHost([opening.x, opening.y], radius);
      if (host) {
        opening.host = {id:sid(host.host),edge:host.i,t:host.t,offset:0};
        opening.x=host.q[0];
        opening.y=host.q[1];
        opening.a=host.a;
        opening.th=host.th;
        lastValid.set(opening,{x:opening.x,y:opening.y,a:opening.a,th:opening.th,host:{...opening.host}});
      } else {
        const previous=lastValid.get(opening);
        if (previous) {
          opening.x=previous.x; opening.y=previous.y;
          opening.a=previous.a; opening.th=previous.th;
          opening.host={...previous.host};
        }
      }
    }
  }
  function syncOpenings() {
    const byId=new Map();
    for (const s of shapes) if (s && s.id) byId.set(s.id,s);
    const remove=new Set();
    for (const s of shapes) {
      if (!s || !OPENINGS.has(s.t) || !s.host) continue;
      const host=byId.get(s.host.id), edges=host&&segs(host), edge=edges&&edges[s.host.edge];
      if (!edge) { remove.add(s); continue; }
      const [a,b]=edge,dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
      if (L<1e-9) { remove.add(s); continue; }
      const t=clamp(s.host.t,0,1),nx=-dy/L,ny=dx/L,off=Number(s.host.offset)||0;
      s.x=a[0]+dx*t+nx*off;
      s.y=a[1]+dy*t+ny*off;
      s.a=Math.atan2(dy,dx);
      s.th=host.t==='wall'?host.th:0;
    }
    return remove;
  }

  function removeDependents(removed) {
    if (!removed.size) return false;
    const ids=new Set();
    for (const s of removed) if (s&&s.id) ids.add(s.id);
    let changed=false;
    // حذف الفتحات المرتبطة بالجدران/العناصر المحذوفة.
    for (const s of shapes) {
      if (s&&OPENINGS.has(s.t)&&s.host&&ids.has(s.host.id)) { removed.add(s); changed=true; }
    }
    // حذف البعد إذا فقد أي عنصر أو مرجع قياس يعتمد عليه.
    for (const s of shapes) {
      if (!s||s.t!=='dim') continue;
      const refs=[s.la&&s.la.id,s.lb&&s.lb.id,s.circleId].filter(Boolean);
      if (refs.some(id=>ids.has(id))) { removed.add(s); changed=true; }
    }
    return changed;
  }

  function cleanupOrphans() {
    const live=new Set(shapes.filter(Boolean).map(s=>s.id).filter(Boolean));
    const removed=new Set();
    for (const s of shapes) {
      if (!s) continue;
      if (s.t==='dim') {
        const refs=[s.la&&s.la.id,s.lb&&s.lb.id,s.circleId].filter(Boolean);
        if (refs.some(id=>!live.has(id))) removed.add(s);
      } else if (OPENINGS.has(s.t)&&s.host&&!live.has(s.host.id)) removed.add(s);
    }
    if (!removed.size) return false;
    removeDependents(removed);
    shapes=shapes.filter(s=>!removed.has(s));
    return true;
  }

  function syncAssociative() {
    trackDraggedOpenings();
    const removed=syncOpenings();
    if (removed.size) {
      removeDependents(removed);
      shapes=shapes.filter(s=>!removed.has(s));
      save();
    }
    if (cleanupOrphans()) save();
    syncDims();
  }

  const originalDraw=draw;
  draw=function() {
    syncAssociative();
    return originalDraw.apply(this,arguments);
  };

  function deleteSelectionCascade() {
    if (!sel.length) return;
    snap();
    const removed=new Set(sel.map(i=>shapes[i]).filter(Boolean));
    removeDependents(removed);
    shapes=shapes.filter(s=>!removed.has(s));
    sel=[];
    save();upd();draw();
  }

  // الحذف من زر السياق أو مفتاح Delete/Backspace يستخدم المسار نفسه.
  const delButton=$('#del');
  if (delButton) {
    delButton.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      deleteSelectionCascade();
    },true);
  }
  document.addEventListener('keydown',e=>{
    if ((e.key!=='Delete'&&e.key!=='Backspace') || !sel.length) return;
    const el=e.target;
    if (el&&(/INPUT|TEXTAREA|SELECT/.test(el.tagName)||el.isContentEditable)) return;
    e.preventDefault();e.stopImmediatePropagation();
    deleteSelectionCascade();
  },true);

  // عند نسخ مجموعة من الجدار وفتحاته معًا، تُحوّل روابط الفتحات إلى نسخ الجدران.
  const originalFixLinks=fixLinks;
  fixLinks=function(src,out) {
    originalFixLinks(src,out);
    const ids=new Map();
    src.forEach((s,i)=>{if(s&&s.id&&out[i])ids.set(s.id,out[i].id)});
    out.forEach(s=>{
      if(s&&OPENINGS.has(s.t)&&s.host) {
        if(ids.has(s.host.id)) s.host={...s.host,id:ids.get(s.host.id)};
        else delete s.host;
      }
    });
  };
})();