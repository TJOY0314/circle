const CACHE='circle-shell-search-v4';
const ASSETS=['./','./index.html','./app.js','./style.css','./config.js','./store.js','./offline.js','./plans.js','./cloud-plans.js','./policies.js','./profile.js','./color.js','./messages.js','./circleIcon.png'];
const SDK=['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(name=>'https://www.gstatic.com/firebasejs/11.10.0/'+name);
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await Promise.allSettled(SDK.map(url=>cache.add(url)));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('circle-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||!(url.origin===self.location.origin||url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/')))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response}catch{const cached=await cache.match(event.request);if(cached)return cached;if(event.request.mode==='navigate')return cache.match('./index.html');return Response.error()}})());
});
