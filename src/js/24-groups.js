/* ==================================================================
 * 24-groups.js
 * ربط العناصر كمجموعات مستقلة عن هندستها، وتحديد المجموعة كاملة وفك الربط.
 * يُحمّل بعد 23-main.js حتى تكون أدوات الواجهة وأحداث المؤشر جاهزة.
 * ================================================================== */

(() => {
  const GROUP_KEY = 'gid';
  const newGroupId = () => 'grp_' + uid();

  function expandGroupSelection(indices) {
    const picked = new Set(indices);
    const ids = new Set();
    for (const i of picked) {
      const s = shapes[i];
      if (s && s[GROUP_KEY]) ids.add(s[GROUP_KEY]);
    }
    if (!ids.size) return [...picked].sort((a, b) => a - b);
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (s && s[GROUP_KEY] && ids.has(s[GROUP_KEY]) && ed(s)) picked.add(i);
    }
    return [...picked].sort((a, b) => a - b);
  }

  function groupSelected() {
    const chosen = [...new Set(sel)].filter(i => shapes[i] && ed(shapes[i]));
    if (chosen.length < 2) {
      toast('حدّد عنصرين أو أكثر لربطها كمجموعة');
      return false;
    }
    snap();
    const id = newGroupId();
    chosen.forEach(i => { shapes[i][GROUP_KEY] = id });
    sel = expandGroupSelection(chosen);
    save();
    toast(`تم ربط ${chosen.length} عنصرًا في مجموعة واحدة`);
    return true;
  }

  function ungroupSelected() {
    const chosen = expandGroupSelection(sel);
    const ids = new Set(chosen.map(i => shapes[i] && shapes[i][GROUP_KEY]).filter(Boolean));
    if (!ids.size) {
      toast('التحديد لا يحتوي على عناصر مرتبطة');
      return false;
    }
    snap();
    let count = 0;
    for (const s of shapes) {
      if (s && s[GROUP_KEY] && ids.has(s[GROUP_KEY])) {
        delete s[GROUP_KEY];
        count++;
      }
    }
    sel = chosen;
    save();
    upd();
    draw();
    toast(`تم فك الربط عن ${count} عنصرًا`);
    return true;
  }

  // يبقى joinSel الهندسي متاحًا للاختبارات والتوافق؛ زر «ربط» في الواجهة ينفّذ التجميع.
  const previousOpAction = opAction;
  opAction = function (action) {
    if (action === 'join') {
      $$('.gm').forEach(m => m.classList.remove('on'));
      editAction = 'join';
      upd();
      groupSelected();
      editAction = null;
      upd();
      draw();
      return;
    }
    return previousOpAction(action);
  };

  cv.addEventListener('pointerup', () => {
    if (tool !== 'select' || !sel.length) return;
    const expanded = expandGroupSelection(sel);
    if (expanded.length !== sel.length || expanded.some((v, i) => v !== sel[i])) {
      sel = expanded;
      upd();
      draw();
    }
  });

  const menu = $('#gedit');
  if (menu && !menu.querySelector('[data-a="ungroup"]')) {
    const b = document.createElement('button');
    b.dataset.a = 'ungroup';
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 7h6M15 7h6M3 17h6M15 17h6M9 7l3 5 3-5M9 17l3-5 3 5"/></svg>فك الربط';
    b.onclick = ungroupSelected;
    menu.append(b);
  }

  $('#ps').onclick = () => {
    if (!clip.length) return;
    snap();
    const bb = bounds(clip), c = s2w(W / 2, H / 2);
    const dx = grid(c[0] - (bb.x + bb.X) / 2);
    const dy = grid(c[1] - (bb.y + bb.Y) / 2);
    const groupMap = new Map();
    const pasted = clip.map(s => {
      const t = copy(s);
      mv(t, s, dx, dy);
      if (t[GROUP_KEY]) {
        if (!groupMap.has(t[GROUP_KEY])) groupMap.set(t[GROUP_KEY], newGroupId());
        t[GROUP_KEY] = groupMap.get(t[GROUP_KEY]);
      }
      return t;
    });
    fixLinks(clip, pasted);
    const start = shapes.length;
    shapes.push(...pasted);
    sel = pasted.map((_, i) => start + i);
    save();
    upd();
    draw();
  };
})();
