// POST /api/view — record a page view
// GET /api/view — return all stats
//
// KV schema:
//   views:{page}:{YYYY-MM-DD} = count (number)
//   views:country:{country}:{YYYY-MM-DD} = count
//   views:referrer:{referrer}:{YYYY-MM-DD} = count
//   views:device:{device}:{YYYY-MM-DD} = count
//   pages = JSON array of known page names
//   countries = JSON array of known country codes
//   referrers = JSON array of known referrer sources
//   devices = JSON array of known device types

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

function parseReferrer(ref) {
  if (!ref) return 'direct';
  try {
    const host = new URL(ref).hostname.replace('www.', '');
    if (host.includes('google')) return 'google';
    if (host.includes('bing')) return 'bing';
    if (host.includes('yahoo')) return 'yahoo';
    if (host.includes('duckduckgo')) return 'duckduckgo';
    if (host.includes('twitter') || host.includes('t.co') || host.includes('x.com')) return 'twitter';
    if (host.includes('facebook') || host.includes('fb.com')) return 'facebook';
    if (host.includes('reddit')) return 'reddit';
    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('youtube')) return 'youtube';
    if (host.includes('tiktok')) return 'tiktok';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('discord')) return 'discord';
    if (host.includes('slack')) return 'slack';
    if (host.includes('smashyourkeyboard.com') || host.includes('keyboard-smash.pages.dev')) return 'internal';
    return host;
  } catch {
    return 'direct';
  }
}

function parseDevice(ua) {
  if (!ua) return 'unknown';
  if (/bot|crawl|spider|slurp|googlebot/i.test(ua)) return 'bot';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Mobile/i.test(ua)) return 'mobile-other';
  return 'desktop';
}

async function trackDimension(KV, prefix, value, date, listKey) {
  const key = `views:${prefix}:${value}:${date}`;
  const current = parseInt(await KV.get(key)) || 0;
  await KV.put(key, String(current + 1));

  const listRaw = await KV.get(listKey);
  const list = listRaw ? JSON.parse(listRaw) : [];
  if (!list.includes(value)) {
    list.push(value);
    await KV.put(listKey, JSON.stringify(list));
  }
}

export async function onRequestPost(context) {
  const KV = context.env.VIEWS;

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

  // Page view count
  const key = `views:${page}:${date}`;
  const current = parseInt(await KV.get(key)) || 0;
  await KV.put(key, String(current + 1));

  // Track known pages
  const pagesRaw = await KV.get('pages');
  const pages = pagesRaw ? JSON.parse(pagesRaw) : [];
  if (!pages.includes(page)) {
    pages.push(page);
    await KV.put('pages', JSON.stringify(pages));
  }

  // Country (Cloudflare provides this header for free)
  const country = context.request.headers.get('cf-ipcountry') || 'XX';
  await trackDimension(KV, 'country', country, date, 'countries');

  // Referrer
  const rawRef = context.request.headers.get('referer') || '';
  const referrer = parseReferrer(rawRef);
  if (referrer !== 'internal') {
    await trackDimension(KV, 'referrer', referrer, date, 'referrers');
  }

  // Device
  const ua = context.request.headers.get('user-agent') || '';
  const device = parseDevice(ua);
  await trackDimension(KV, 'device', device, date, 'devices');

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet(context) {
  const KV = context.env.VIEWS;

  if (!KV) {
    return new Response(JSON.stringify({ error: 'KV not bound' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const pages = JSON.parse(await KV.get('pages') || '[]');
  const countries = JSON.parse(await KV.get('countries') || '[]');
  const referrers = JSON.parse(await KV.get('referrers') || '[]');
  const devices = JSON.parse(await KV.get('devices') || '[]');

  const stats = {};
  const countryStats = {};
  const referrerStats = {};
  const deviceStats = {};
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);

    for (const page of pages) {
      const count = parseInt(await KV.get(`views:${page}:${date}`)) || 0;
      if (count > 0) {
        if (!stats[date]) stats[date] = {};
        stats[date][page] = count;
      }
    }

    for (const c of countries) {
      const count = parseInt(await KV.get(`views:country:${c}:${date}`)) || 0;
      if (count > 0) {
        countryStats[c] = (countryStats[c] || 0) + count;
      }
    }

    for (const r of referrers) {
      const count = parseInt(await KV.get(`views:referrer:${r}:${date}`)) || 0;
      if (count > 0) {
        referrerStats[r] = (referrerStats[r] || 0) + count;
      }
    }

    for (const dev of devices) {
      const count = parseInt(await KV.get(`views:device:${dev}:${date}`)) || 0;
      if (count > 0) {
        deviceStats[dev] = (deviceStats[dev] || 0) + count;
      }
    }
  }

  return new Response(JSON.stringify({
    pages, stats,
    countryStats, referrerStats, deviceStats,
  }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
