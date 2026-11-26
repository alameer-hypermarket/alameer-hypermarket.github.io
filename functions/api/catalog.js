// Public catalog + settings in ONE cached JSON. Source: a single Firestore doc (config/catalog)
// that the admin panel republishes after every edit. Edge-cached, so visitor traffic never
// turns into Firestore reads (at most a handful of reads per hour in total).
const API_KEY = 'AIzaSyCDj7uwEHPtw-PtOayhSPdpcaGyZpJHcJ4';
const URL_ = 'https://firestore.googleapis.com/v1/projects/alameer-hypermarket-store/databases/(default)/documents/artifacts/al-ameer-hypermarket/public/data/config/catalog?key=' + API_KEY;
const TTL = 300;
const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=120, s-maxage=' + TTL };

export async function onRequestGet(context) {
  const cache = caches.default;
  const key = new Request(new URL('/api/catalog', context.request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  let body = null;
  try {
    const r = await fetch(URL_);
    if (r.ok) {
      const d = await r.json();
      const f = d.fields || {};
      const js = f.json && f.json.stringValue;
      if (js) body = js;
    }
  } catch (e) {}
  if (!body) return new Response(JSON.stringify({ error: 'no_catalog' }), { status: 404, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const res = new Response(body, { headers: H });
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}
