/* MelkiCAD cloud accounts and manual project sync.
 * Keeps IndexedDB as the local source of truth; Supabase is an explicit backup/restore target.
 * Requires the public Supabase URL + anon key configured by the user in the Cloud panel.
 */
(()=>{
  'use strict';
  const CONFIG_KEY='melkicad:cloud-config';
  let client=null, user=null, busy=false;
  const $id=id=>document.getElementById(id);
  const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config=()=>{try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||'{}')}catch(_){return {}}};
  const say=m=>{if(typeof toast==='function')toast(m);else alert(m)};
  const getClient=()=>{
    const c=config();
    if(!c.url||!c.key)throw new Error('أدخل رابط مشروع Supabase ومفتاح anon أولاً');
    if(!window.supabase||!window.supabase.createClient)throw new Error('مكتبة الاتصال السحابي غير متاحة. اتصل بالإنترنت ثم أعد المحاولة');
    if(!client)client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  };
  const currentUser=async()=>{const {data,error}=await getClient().auth.getUser();if(error)throw error;user=data.user;return user};
  const snapshot=id=>({
    shapes:kvGet('p:'+id)?.shapes||[],
    layers:kvGet('p:'+id)?.LY||[],
    currentLayer:kvGet('p:'+id)?.cl||'',
    view:kvGet('v:'+id)||{x:24,y:24,s:40},
    meta:kvGet('m:'+id)||{}
  });
  async function open(){
    const sh=$id('sheet'),c=config();
    sh.innerHTML='<b>الحساب والمزامنة السحابية</b>'+
      '<div class="hint">تبقى مشاريعك محفوظة محلياً في IndexedDB. لا يحدث أي رفع أو تنزيل إلا عند ضغطك على الزر.</div>'+
      '<label>رابط مشروع Supabase<input id="cloudUrl" type="url" dir="ltr" placeholder="https://....supabase.co" value="'+esc(c.url)+'"></label>'+
      '<label>مفتاح anon / publishable<input id="cloudKey" type="text" dir="ltr" autocomplete="off" placeholder="مفتاح Supabase العام" value="'+esc(c.key)+'"></label>'+
      '<div class="chips"><button class="chip" id="cloudConfigSave">حفظ إعداد الاتصال</button></div>'+
      '<div class="hint" id="cloudState">جارٍ التحقق من حالة الحساب…</div>'+
      '<label>البريد الإلكتروني<input id="cloudEmail" type="email" dir="ltr" autocomplete="username" placeholder="name@example.com"></label>'+
      '<label>كلمة المرور<input id="cloudPassword" type="password" dir="ltr" autocomplete="current-password" placeholder="كلمة المرور"></label>'+
      '<div class="chips"><button class="chip" id="cloudSignIn">دخول</button><button class="chip" id="cloudSignUp">إنشاء حساب</button><button class="chip" id="cloudGoogle">الدخول عبر Google</button><button class="chip" id="cloudOut">خروج</button></div>'+
      '<div class="divider"></div><b>المزامنة اليدوية</b>'+
      '<div class="hint">ارفع المشاريع المحلية إلى حسابك، أو نزّل مشاريع الحساب إلى هذا الجهاز. عند وجود مشروع بالمعرّف نفسه سيطلب التطبيق تأكيد استبداله.</div>'+
      '<div class="chips"><button class="chip" id="cloudUpload">رفع مشاريعي</button><button class="chip" id="cloudDownload">تنزيل مشاريعي</button></div>'+
      '<div class="hint" id="cloudResult" aria-live="polite"></div>'+
      '<button id="ok">إغلاق</button>';
    const state=$id('cloudState'),result=$id('cloudResult');
    const status=m=>{if(state)state.textContent=m};
    const output=m=>{if(result)result.textContent=m};
    $id('cloudConfigSave').onclick=()=>{
      const url=$id('cloudUrl').value.trim().replace(/\/$/,'');
      const key=$id('cloudKey').value.trim();
      if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url)||!key){status('تحقق من رابط Supabase والمفتاح العام');return}
      localStorage.setItem(CONFIG_KEY,JSON.stringify({url,key}));client=null;user=null;
      status('تم حفظ الإعدادات على هذا الجهاز. يمكنك الآن تسجيل الدخول.');
    };
    const authAction=async fn=>{
      if(busy)return;busy=true;output('جارٍ التنفيذ…');
      try{await fn();await refresh();output('تمت العملية بنجاح')}
      catch(e){output('تعذّرت العملية: '+(e.message||e))}
      finally{busy=false}
    };
    const emailPass=()=>{const email=$id('cloudEmail').value.trim(),password=$id('cloudPassword').value;if(!email||!password)throw new Error('أدخل البريد الإلكتروني وكلمة المرور');return {email,password}};
    $id('cloudSignIn').onclick=()=>authAction(async()=>{const {email,password}=emailPass();const {error}=await getClient().auth.signInWithPassword({email,password});if(error)throw error});
    $id('cloudSignUp').onclick=()=>authAction(async()=>{const {email,password}=emailPass();if(password.length<8)throw new Error('اجعل كلمة المرور 8 أحرف على الأقل');const {data,error}=await getClient().auth.signUp({email,password});if(error)throw error;if(!data.session)output('أُنشئ الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.')});
    $id('cloudGoogle').onclick=()=>authAction(async()=>{const {error}=await getClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});if(error)throw error});
    $id('cloudOut').onclick=()=>authAction(async()=>{const {error}=await getClient().auth.signOut();if(error)throw error;user=null});
    $id('cloudUpload').onclick=()=>authAction(upload);
    $id('cloudDownload').onclick=()=>authAction(download);
    $id('ok').onclick=()=>{sh.classList.remove('on');upd()};
    sh.classList.add('on');$('#ctx').style.display='none';
    async function refresh(){
      try{const u=await currentUser();status(u?'مسجّل الدخول: '+u.email:'لم يتم تسجيل الدخول');}
      catch(e){status(e.message||'أدخل إعدادات Supabase ثم سجّل الدخول')}
    }
    await refresh();
  }
  async function upload(){
    const u=await currentUser();
    save();
    if(!await Store.flush())throw new Error('تعذّر إنهاء الحفظ المحلي. لم نرفع أي مشروع.');
    const rows=PJ.map(p=>({user_id:u.id,local_id:p.id,name:String(p.name||'مشروع بدون اسم').slice(0,200),data:snapshot(p.id)}));
    if(!rows.length){say('لا توجد مشاريع محلية لرفعها');return}
    const {error}=await getClient().from('projects').upsert(rows,{onConflict:'user_id,local_id'});
    if(error)throw error;
    say('تم رفع '+rows.length+' مشروعاً إلى السحابة');
  }
  async function download(){
    const u=await currentUser();
    save();
    if(!await Store.flush())throw new Error('تعذّر إنهاء الحفظ المحلي.');
    const {data,error}=await getClient().from('projects').select('local_id,name,data,updated_at').eq('user_id',u.id).order('updated_at',{ascending:true});
    if(error)throw error;
    if(!data||!data.length){say('لا توجد مشاريع محفوظة في الحساب');return}
    const collisions=data.filter(r=>PJ.some(p=>p.id===r.local_id));
    if(collisions.length&&!confirm('يوجد '+collisions.length+' مشروع محلي له المعرّف نفسه. هل تريد استبدال النسخ المحلية بهذه النسخ السحابية؟ يُنصح بتصدير نسخة احتياطية أولاً.'))return;
    let added=0,replaced=0;
    for(const r of data){
      const exists=PJ.some(p=>p.id===r.local_id);
      const d=r.data||{};
      if(!r.local_id||!Array.isArray(d.shapes))continue;
      kvSet('p:'+r.local_id,{shapes:d.shapes,LY:d.layers||[],cl:d.currentLayer||''});
      kvSet('v:'+r.local_id,d.view||{x:24,y:24,s:40});
      kvSet('m:'+r.local_id,d.meta||{});
      if(exists)replaced++;else{PJ.push({id:r.local_id,name:r.name||'مشروع سحابي'});added++}
    }
    kvSet('idx',{PJ,pid:PJ.some(p=>p.id===pid)?pid:(PJ[0]?.id||'')});
    if(typeof load==='function'){load();upd();draw()}
    say('اكتمل التنزيل: '+added+' جديد، '+replaced+' تم تحديثه');
  }
  window.MelkiCloud={open,upload,download};
  const originalSettings=window.settingsSheet;
  if(typeof originalSettings==='function'){
    window.settingsSheet=function(){
      originalSettings();
      const sh=$id('sheet'),ok=$id('ok');
      if(!sh||!ok||$id('cloudOpen'))return;
      const b=document.createElement('div');b.className='chips';
      b.innerHTML='<button class="chip" id="cloudOpen">الحساب والمزامنة السحابية</button>';
      sh.insertBefore(b,ok);
      $id('cloudOpen').onclick=open;
    };
  }
})();