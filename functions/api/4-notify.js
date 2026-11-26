// Telegram order notifications. Bot token lives only in the TELEGRAM_BOT_TOKEN secret.
// Destination chat id is stored in the public store config (admin editable): telegramChatId.
const API_KEY = 'AIzaSyCDj7uwEHPtw-PtOayhSPdpcaGyZpJHcJ4';
const PROJECT = 'alameer-hypermarket-store';
const ADMIN_EMAIL = 'admin@alameer-hypermarket.app';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function lookup(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4000) return null;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.users && d.users[0]) || null;
}

async function configChatId(env) {
  const cache = caches.default;
  const ck = new Request('https://cache.internal/tg-chat-id');
  try {
    const hit = await cache.match(ck);
    if (hit) { const v = (await hit.text()).trim(); if (v) return v; }
  } catch (e) {}
  try {
    const u = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/artifacts/al-ameer-hypermarket/public/data/config/main?key=${API_KEY}`;
    const r = await fetch(u);
    if (r.ok) {
      const d = await r.json();
      const v = d.fields && d.fields.telegramChatId && d.fields.telegramChatId.stringValue;
      if (v) {
        try { await cache.put(ck, new Response(v.trim(), { headers: { 'cache-control': 'max-age=300' } })); } catch (e) {}
        return v.trim();
      }
    }
  } catch (e) {}
  return (env.TELEGRAM_CHAT_ID || '').trim();
}

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return r.json().catch(() => ({ ok: false }));
}

// Telegram allows ~1 message/second per chat; on a burst it answers 429 with retry_after. Wait and retry once.
async function tgSend(env, body) {
  let res = await tg(env, 'sendMessage', body);
  if (!res.ok && res.error_code === 429) {
    const wait = Math.min(Number(res.parameters && res.parameters.retry_after) || 1, 5);
    await new Promise(r => setTimeout(r, wait * 1000));
    res = await tg(env, 'sendMessage', body);
  }
  return res;
}

export async function onRequestPost({ request, env }) {
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok: false, error: 'not_configured' }, 500);
  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, error: 'bad_json' }, 400); }
  const user = await lookup(b.idToken);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);
  const isAdmin = (user.email || '').toLowerCase() === ADMIN_EMAIL;

  if (b.type === 'order') {
    const text = String(b.text || '').replace(/\*/g, '').slice(0, 3500);
    if (text.length < 20) return json({ ok: false, error: 'empty' }, 400);
    const chat = await configChatId(env);
    if (!chat) return json({ ok: false, error: 'no_chat' }, 200);
    const res = await tgSend(env, { chat_id: chat, text: '🛒 ' + text });
    return json({ ok: !!res.ok });
  }
  if (!isAdmin) return json({ ok: false, error: 'forbidden' }, 403);

  if (b.type === 'test') {
    const chat = String(b.chatId || '').trim() || await configChatId(env);
    if (!chat) return json({ ok: false, error: 'no_chat' }, 200);
    const res = await tg(env, 'sendMessage', { chat_id: chat, text: '✅ تجربة: إشعارات الأوردرات الجديدة شغالة على الشات ده.' });
    return json({ ok: !!res.ok, description: res.description || '' });
  }
  if (b.type === 'detect') {
    const res = await tg(env, 'getUpdates', { limit: 20, timeout: 0 });
    const seen = {};
    for (const u of (res.result || [])) {
      const m = u.message || u.channel_post || (u.my_chat_member && { chat: u.my_chat_member.chat });
      if (m && m.chat) seen[m.chat.id] = { id: String(m.chat.id), name: m.chat.title || [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.username || '' };
    }
    return json({ ok: !!res.ok, chats: Object.values(seen) });
  }
  return json({ ok: false, error: 'bad_type' }, 400);
}
