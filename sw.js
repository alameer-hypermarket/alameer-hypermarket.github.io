const C='alameer-v16';
const SWR=u=>u.pathname.startsWith('/img/');
const NF=u=>u.pathname==='/products.json'||u.pathname==='/images.json';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['/'])).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
if(NF(u)){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r)));return}
if(SWR(u)){
e.respondWith(caches.open(C).then(c=>c.match(r).then(m=>{const net=fetch(r).then(res=>{if(res.ok&&!(u.pathname.startsWith('/img/')&&!(res.headers.get('content-type')||'').startsWith('image/')))c.put(r,res.clone());return res}).catch(()=>m);e.waitUntil(net.catch(()=>{}));return m||net})));
return}
e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res}).catch(()=>caches.match(r).then(m=>m||caches.match('/'))))});
