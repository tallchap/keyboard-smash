// GET /s/:smash — permanent smash page (server-rendered, indexable)

export async function onRequestGet(context) {
  const KV = context.env.VIEWS;
  const smash = decodeURIComponent(context.params.smash);

  if (!KV) {
    return new Response('KV not bound', { status: 500 });
  }

  const data = await KV.get(`smash:${smash}`, 'json');

  if (!data || !data.permanent) {
    return new Response(notFoundPage(smash), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(renderPage(data), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPage(data) {
  const { smash, count, bestScore, bestKeys } = data;
  const escaped = escHtml(smash);
  const desc = `"${escaped}" has been smashed ${count} times. Best score: ${bestScore} points. Play the keyboard smash game at smashyourkeyboard.com`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escaped} - Keyboard Smash</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="https://smashyourkeyboard.com/s/${encodeURIComponent(smash)}">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a1a;
    color: #e0e0e0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 20px;
  }
  .smash-label {
    font-size: 9px;
    color: #383838;
    margin-bottom: 4px;
    letter-spacing: 0.3px;
  }
  .smash-text {
    font-family: 'Courier New', monospace;
    font-size: clamp(28px, 5vw, 56px);
    color: #ff8844;
    word-break: break-all;
    line-height: 1.3;
    max-width: 800px;
    font-weight: bold;
    text-shadow: 0 0 30px rgba(255,100,50,0.3);
  }
  .score-line {
    margin-top: 24px;
    font-size: 18px;
    color: #999;
  }
  .score-line .pts {
    color: #ffcc00;
    font-weight: bold;
    font-size: 22px;
  }
  .position-line {
    margin-top: 12px;
    font-size: 16px;
    color: #aaa;
    font-style: italic;
    max-width: 500px;
  }
  .stats {
    margin-top: 16px;
    font-size: 13px;
    color: #555;
  }
  .play-btn {
    display: inline-block;
    margin-top: 40px;
    padding: 16px 40px;
    background: rgba(255,80,40,0.85);
    color: #fff;
    text-decoration: none;
    border-radius: 10px;
    font-weight: bold;
    font-size: 18px;
    letter-spacing: 1px;
    transition: background 0.2s, transform 0.1s;
  }
  .play-btn:hover { background: rgba(255,80,40,1); transform: scale(1.03); }
  .back-link {
    margin-top: 20px;
    font-size: 13px;
    color: #555;
  }
  .back-link a { color: #666; text-decoration: underline; }
  .back-link a:hover { color: #999; }
</style>
</head>
<body>

<div class="smash-label">Someone smashed out</div>
<h1 class="smash-text">${escaped}</h1>
<div class="score-line">Best keyboard smash score: <span class="pts">${bestScore}</span> points</div>
<div class="position-line">Smashed ${count} time${count !== 1 ? 's' : ''} by players around the world.</div>
<div class="stats">${bestKeys} keys</div>
<a class="play-btn" href="/">Play The Keyboard Smash Game</a>
<div class="back-link"><a href="/leaderboard.html">Back to leaderboard</a></div>

<script>
navigator.sendBeacon('/api/view', JSON.stringify({ page: 'smash-permanent' }));
</script>
</body>
</html>`;
}

function notFoundPage(smash) {
  const escaped = escHtml(smash);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Not Found - Keyboard Smash</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a1a; color: #e0e0e0;
    font-family: 'Segoe UI', system-ui, sans-serif;
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    padding: 40px 20px;
  }
  h1 { color: #ff8844; font-size: 28px; margin-bottom: 16px; }
  p { color: #666; margin-bottom: 24px; }
  a { color: #ffcc00; }
</style>
</head>
<body>
<h1>"${escaped}" hasn't earned a permanent page yet.</h1>
<p>A smash becomes permanent when two different people type the same thing. Be the first — <a href="/">play now</a>.</p>
</body>
</html>`;
}
