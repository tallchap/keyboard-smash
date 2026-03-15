// POST /api/score — save a new score to KV
// GET /api/score?date=YYYY-MM-DD — get leaderboard (defaults to today)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestPost(context) {
  const KV = context.env.VIEWS;
  if (!KV) return json({ error: 'KV not bound' }, 500);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const smash = String(body.smash || '').slice(0, 500);
  const score = parseInt(body.score) || 0;
  const keys = parseInt(body.keys) || 0;

  if (!smash || score <= 0) {
    return json({ error: 'Missing smash or score' }, 400);
  }

  const date = today();
  const key = `leaderboard:${date}`;

  const existing = await KV.get(key, 'json') || [];

  const entry = {
    smash,
    score,
    keys,
    time: new Date().toISOString(),
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  };

  existing.push(entry);
  existing.sort((a, b) => b.score - a.score);

  // Cap at 500
  if (existing.length > 500) existing.length = 500;

  // Keep for 30 days
  await KV.put(key, JSON.stringify(existing), { expirationTtl: 60 * 60 * 24 * 30 });

  // Track known dates
  const datesRaw = await KV.get('leaderboard_dates', 'json') || [];
  if (!datesRaw.includes(date)) {
    datesRaw.push(date);
    // Keep last 30
    datesRaw.sort().reverse();
    if (datesRaw.length > 30) datesRaw.length = 30;
    await KV.put('leaderboard_dates', JSON.stringify(datesRaw));
  }

  const rank = existing.findIndex(e => e.id === entry.id) + 1;

  return json({ ok: true, rank, total: existing.length, id: entry.id });
}

export async function onRequestGet(context) {
  const KV = context.env.VIEWS;
  if (!KV) return json({ error: 'KV not bound' }, 500);

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || today();

  // If requesting 'dates', return available dates
  if (url.searchParams.get('list') === 'dates') {
    const dates = await KV.get('leaderboard_dates', 'json') || [];
    return json({ dates });
  }

  const key = `leaderboard:${date}`;
  const entries = await KV.get(key, 'json') || [];

  return json({ date, entries, total: entries.length });
}
