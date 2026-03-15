// POST /api/view — record a page view
// GET /api/view — return all stats
//
// KV schema:
//   views:{page}:{YYYY-MM-DD} = count (number)
//   pages = JSON array of known page names

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function onRequestPost(context) {
  const { env } = context;
  const KV = env.VIEWS;

  if (!KV) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let page = 'index';
  try {
    const body = await context.request.json();
    if (body.page) page = String(body.page).slice(0, 50);
  } catch {}

  const date = today();
  const key = `views:${page}:${date}`;

  // Increment count
  const current = parseInt(await KV.get(key)) || 0;
  await KV.put(key, String(current + 1));

  // Track known pages
  const pagesRaw = await KV.get('pages');
  const pages = pagesRaw ? JSON.parse(pagesRaw) : [];
  if (!pages.includes(page)) {
    pages.push(page);
    await KV.put('pages', JSON.stringify(pages));
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const KV = env.VIEWS;

  if (!KV) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const pagesRaw = await KV.get('pages');
  const pages = pagesRaw ? JSON.parse(pagesRaw) : [];

  // Gather last 30 days of data
  const stats = {};
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);

    for (const page of pages) {
      const key = `views:${page}:${date}`;
      const count = parseInt(await KV.get(key)) || 0;
      if (count > 0) {
        if (!stats[date]) stats[date] = {};
        stats[date][page] = count;
      }
    }
  }

  return new Response(JSON.stringify({ pages, stats }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
