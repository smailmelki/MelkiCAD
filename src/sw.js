// عامل الخدمة: يجعل التطبيق يعمل بلا إنترنت بعد أول تحميل ناجح.
const VER='plan-v39';
const CORE=[
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'css/base.css',
  'css/components.css',
  'css/nav-overlay.css',
  'js/01-core.js',
  'js/02-geometry.js',
  'js/03-snap.js',
  'js/04-selection.js',
  'js/05-persistence.js',
  'js/06-layers.js',
  'js/07-projects.js',
  'js/08-project-io.js',
  'js/09-render.js',
  'js/10-dimensions.js',
  'js/11-furniture.js',
  'js/12-openings.js',
  'js/13-draw-input.js',
  'js/14-pointer.js',
  'js/15-properties.js',
  'js/16-edit-tools.js',
  'js/17-dxf.js',
  'js/18-print.js',
  'js/19-areas.js',
  'js/21-settings.js',
  'js/22-toolbar.js',
  'js/23-main.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(VER)
      .then(cache=>cache.addAll(CORE))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==VER).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin===location.origin){
    event.respondWith(
      caches.match(request,{ignoreSearch:true}).then(cached=>{
        const fresh=fetch(request).then(response=>{
          if(response&&response.ok)caches.open(VER).then(cache=>cache.put(request,response.clone()));
          return response;
        }).catch(()=>cached);
        return cached||fresh;
      })
    );
  }else if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    event.respondWith(
      caches.match(request).then(cached=>cached||fetch(request).then(response=>{
        caches.open(VER).then(cache=>cache.put(request,response.clone()));
        return response;
      }).catch(()=>cached))
    );
  }
});
