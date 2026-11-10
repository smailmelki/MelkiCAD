/* ==================================================================
 * 00-storage.js
 * طبقة التخزين: IndexedDB مع ذاكرة مؤقتة متزامنة. القراءة والكتابة من بقية الكود تبقى
 * متزامنة (kvGet/kvSet/kvDel) بينما الكتابة الفعلية إلى IndexedDB تتم في الخلفية دفعات.
 *  - بدء التشغيل: Store.init() يحمّل كل السجلات إلى الذاكرة (نصوص JSON) قبل أول load().
 *  - الترحيل: أول تشغيل ينسخ مفاتيح localStorage القديمة (plan3:*) إلى IndexedDB ويتحقق منها،
 *    ثم يعلّم الترحيل مكتملًا ويحذف النسخ القديمة؛ أي فشل يُبقي localStorage سليمًا ويعمل به.
 *  - الوضع الاحتياطي: إن لم يتوفر IndexedDB (بعض المتصفحات الخاصة) نعمل على localStorage كما كان.
 *  - ما لم يُكتب بعد (فشل/امتلاء) يبقى معلّقًا ويُعاد كل 5 ثوانٍ ومع كل حفظ، وينبَّه المستخدم.
 *  - لا نكتب قيمة لم تتغيّر (مقارنة النص)، فحفظ العرض وحده يكتب سجلًّا واحدًا.
 *
 * يعرّف: Store، kvGet، kvSet، kvDel
 * يعتمد على: 01-core.js وقت التشغيل فقط (toast)
 * ================================================================== */

const Store=(()=>{
  const DB_NAME='melkicad',OS='kv',LEGACY='plan3:',META='@migrated';
  let kind='none',ready=false,db=null,cache=new Map(),pending=new Map(),flushing=null,scheduled=false,retryTimer=0,warnAt=0,initP=null;

  // فشل الكتابة (امتلاء التخزين أو منعه) يُنبَّه عنه مرة كل 15 ثانية بدل ابتلاعه بصمت
  const warn=()=>{if(Date.now()-warnAt>15000){warnAt=Date.now();toast('تعذّر الحفظ التلقائي: التخزين ممتلئ أو غير متاح. صدّر المشروع من الإعدادات الآن')}};

  // ---- IndexedDB ----
  const idbOpen=()=>new Promise((res,rej)=>{
    if(typeof indexedDB==='undefined'||!indexedDB){rej(new Error('IndexedDB غير متاح'));return}
    let r;try{r=indexedDB.open(DB_NAME,1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{r.result.createObjectStore(OS)};
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error||new Error('فشل فتح IndexedDB'));
    r.onblocked=()=>rej(new Error('فتح IndexedDB محجوب'));
  });

  const idbReadAll=d=>new Promise((res,rej)=>{
    const m=new Map();let c;
    try{c=d.transaction(OS,'readonly').objectStore(OS).openCursor()}catch(e){rej(e);return}
    c.onsuccess=()=>{const cur=c.result;if(cur){if(typeof cur.value==='string')m.set(cur.key,cur.value);cur.continue()}else res(m)};
    c.onerror=()=>rej(c.error);
  });

  // entries: [[key, نص JSON أو null للحذف]] في معاملة واحدة (إما تُكتب كلها أو لا شيء)
  const idbCommit=entries=>new Promise((res,rej)=>{
    let tx;
    try{
      tx=db.transaction(OS,'readwrite');
      const os=tx.objectStore(OS);
      for(const [k,v] of entries)v===null?os.delete(k):os.put(v,k);
    }catch(e){try{tx&&tx.abort()}catch(_){}rej(e);return}
    tx.oncomplete=()=>res();
    tx.onerror=()=>rej(tx.error||new Error('فشل الكتابة'));
    tx.onabort=()=>rej(tx.error||new Error('أُلغيت الكتابة'));
  });

  // ---- localStorage (الترحيل والوضع الاحتياطي) ----
  const lsReadAll=()=>{
    const m=new Map();
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(LEGACY)){const v=localStorage.getItem(k);if(typeof v==='string')m.set(k.slice(LEGACY.length),v)}}}catch(e){}
    return m;
  };
  const flushLS=()=>{
    try{for(const [k,v] of pending){v===null?localStorage.removeItem(LEGACY+k):localStorage.setItem(LEGACY+k,v);pending.delete(k)}return true}
    catch(e){warn();return false}
  };

  // ---- الكتابة الدفعية ----
  // محاولة واحدة لكتابة كل المعلّق؛ تعيد وعدًا بنجاحها. ما كُتب يُزال من المعلّق فقط إن لم يتغيّر أثناء الكتابة.
  function runFlush(){
    if(flushing)return flushing;
    if(!pending.size)return Promise.resolve(true);
    const batch=[...pending];
    flushing=idbCommit(batch).then(
      ()=>{for(const [k,v] of batch)if(pending.get(k)===v)pending.delete(k);clearTimeout(retryTimer);retryTimer=0;return true},
      e=>{console.warn('تعذّرت الكتابة إلى IndexedDB:',e);warn();if(!retryTimer)retryTimer=setTimeout(()=>{retryTimer=0;runFlush()},5000);return false}
    ).then(ok=>{flushing=null;if(ok&&pending.size)runFlush();return ok});
    return flushing;
  }
  // استدعاءات set المتتالية في نفس الدورة (save تكتب 3 سجلات) تُجمَّع في معاملة واحدة
  function schedule(){
    if(kind==='ls'){flushLS();return}
    if(scheduled||flushing)return;
    scheduled=true;Promise.resolve().then(()=>{scheduled=false;runFlush()});
  }

  // ---- الواجهة ----
  function get(k){
    const s=cache.get(k);if(s==null)return null;
    try{return JSON.parse(s)}catch(e){return null}
  }
  function set(k,v){
    if(!ready)return false;
    const s=JSON.stringify(v);
    if(cache.get(k)===s&&!pending.has(k)){if(pending.size)schedule();return true}
    cache.set(k,s);pending.set(k,s);schedule();
    return kind==='ls'?!pending.has(k):true;
  }
  function del(k){
    if(!ready)return false;
    cache.delete(k);pending.set(k,null);schedule();
    return kind==='ls'?!pending.has(k):true;
  }
  // يكتب كل المعلّق ويعيد وعدًا (true إن لم يبقَ شيء)
  async function flush(){
    if(kind==='ls')return flushLS();
    for(let i=0;i<5&&(flushing||pending.size);i++){if(!(await runFlush()))return false}
    return !pending.size;
  }
  // عند إخفاء الصفحة/إغلاقها: يبدأ المعاملة الآن (بشكل متزامن) دون انتظار
  function flushNow(){return kind==='ls'?flushLS():runFlush()}

  async function doInit(){
    const legacy=lsReadAll();
    try{
      db=await idbOpen();
      cache=await idbReadAll(db);
      if(!cache.has(META)){
        // ترحيل: النسخ القديمة هي المرجع (بيانات IndexedDB بلا META تعني ترحيلًا لم يكتمل فتُستبدل)
        if(legacy.size)await idbCommit([...legacy]);
        const back=await idbReadAll(db);
        for(const k of legacy.keys())if(!back.has(k))throw new Error('فشل التحقق من الترحيل: '+k);
        await idbCommit([[META,'1']]);
        back.set(META,'1');cache=back;
        try{for(const k of legacy.keys())localStorage.removeItem(LEGACY+k)}catch(e){}
      }
      kind='idb';
      // اطلب تخزينًا دائمًا كي لا يمسحه المتصفح عند ضيق المساحة (لا يُظهر نافذة في أغلب المتصفحات)
      try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}
    }catch(e){
      console.warn('IndexedDB غير متاح، سيُستخدم localStorage:',e);
      db=null;kind='ls';cache=legacy;pending=new Map();
    }
    ready=true;
  }
  const init=()=>initP||(initP=doInit());

  const size=b=>b<1048576?`${Math.max(1,Math.round(b/1024))} ك.ب`:b<1073741824?`${(b/1048576).toFixed(1)} م.ب`:`${(b/1073741824).toFixed(1)} ج.ب`;
  // سطر وصفي للإعدادات: نوع التخزين وحجم المشاريع والمساحة المتاحة
  async function describe(){
    let bytes=0;for(const s of cache.values())bytes+=s.length;
    let q='';try{const e=await navigator.storage.estimate();if(e&&e.quota)q=` · المساحة المتاحة ≈ ${size(e.quota)}`}catch(e){}
    const where=kind==='idb'?'IndexedDB':'localStorage (وضع احتياطي، حدّه نحو 5 م.ب)';
    return `${where} · المشاريع ${size(bytes)}${q}${pending.size?' · بانتظار الحفظ':''}`;
  }

  return{init,get,set,del,flush,flushNow,describe,get ready(){return ready},get kind(){return kind},get pendingCount(){return pending.size}};
})();

const kvGet=k=>Store.get(k),kvSet=(k,v)=>Store.set(k,v),kvDel=k=>Store.del(k);
