// index.js
// Node 18+ recommended
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const yf = require('yahoo-finance2').default;

const PORT = process.env.PORT || 3000;
const app = express();

// ---- STATIC FILES ----
// Make sure your client files live in ./public (index.html, app.js, etc.)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server);

// ---- GAME STATE ----
const players = {};               // { socketId: { name, netWorth } }
const subs = {};                  // { "AAPL": Set<socketId>, ... }
const cache = new Map();          // "AAPL" -> { ...fields, ts }

// ---- YAHOO HELPERS ----
async function fetchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {};
  try {
    const raw = await yf.quote(symbols);        // accepts string | string[]
    const items = Array.isArray(raw) ? raw : [raw];
    const out = {};

    for (const q of items) {
      if (!q || !q.symbol) continue;

      const price =
        q.regularMarketPrice ??
        q.postMarketPrice ??
        q.preMarketPrice ??
        q.ask ??
        q.bid ??
        null;

      const sym = q.symbol.toUpperCase();
      out[sym] = {
        price: typeof price === 'number' ? price : null,
        changePct: q.regularMarketChangePercent ?? null,
        currency: q.currency ?? 'USD',
        name: q.shortName ?? q.longName ?? q.symbol,
        previousClose: q.regularMarketPreviousClose ?? null,
        postPrice: q.postMarketPrice ?? null,
        prePrice: q.preMarketPrice ?? null,
        marketState: q.marketState || null    // "PRE" | "REGULAR" | "POST" | etc.
      };

      cache.set(sym, { ...out[sym], ts: Date.now() });
    }
    return out;
  } catch (err) {
    console.error('fetchQuotes error:', err?.message || err);
    return {};
  }
}

function pctMoveForSymbol(q) {
  if (q.marketState === 'REGULAR' && typeof q.changePct === 'number') return q.changePct;

  if (typeof q.postPrice === 'number' && typeof q.previousClose === 'number' && q.previousClose > 0) {
    return ((q.postPrice - q.previousClose) / q.previousClose) * 100;
  }

  if (typeof q.prePrice === 'number' && typeof q.previousClose === 'number' && q.previousClose > 0) {
    return ((q.prePrice - q.previousClose) / q.previousClose) * 100;
  }

  if (typeof q.changePct === 'number') return q.changePct;

  return 0;
}

function marketGuess(quotesObj) {
  const pcts = [];
  for (const sym of Object.keys(quotesObj)) {
    const pct = pctMoveForSymbol(quotesObj[sym]);
    if (Number.isFinite(pct)) pcts.push(pct);
  }
  if (!pcts.length) return { state: 'unknown', score: 0, medianPct: 0 };

  pcts.sort((a,b)=>a-b);
  const mid = Math.floor(pcts.length/2);
  const median = pcts.length % 2 ? pcts[mid] : (pcts[mid-1]+pcts[mid])/2;

  let state = 'flat';
  if (median <= -0.8) state = 'down-hard';
  else if (median <= -0.3) state = 'down';
  else if (median >= 0.8) state = 'up-strong';
  else if (median >= 0.3) state = 'up';

  const score = Math.max(-1, Math.min(1, median / 1.5));
  return { state, score, medianPct: Number(median.toFixed(2)) };
}

// ---- POLLER: every 5s fetch current quotes for subscribed symbols ----
setInterval(async () => {
  const allSymbols = Object.keys(subs);
  if (!allSymbols.length) return;

  const quotes = await fetchQuotes(allSymbols);

  // push per-symbol prices to subscribers
  for (const sym of Object.keys(quotes)) {
    const sockets = subs[sym];
    if (!sockets || sockets.size === 0) continue;
    for (const sid of sockets) {
      io.to(sid).emit('price', { symbol: sym, ...quotes[sym] });
    }
  }

  // push the coarse market guess to everyone
  const guess = marketGuess(quotes);
  io.emit('marketGuess', guess);
}, 5000);

// ---- OPTIONAL: REST sanity check ----
app.get('/api/quote', async (req, res) => {
  const symbols = String(req.query.symbols || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  const data = await fetchQuotes(symbols);
  res.json(data);
});

// ---- SOCKET.IO ----
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register', (name) => {
    players[socket.id] = { name: String(name || 'Player'), netWorth: 10000 };
  });

  socket.on('updateNetWorth', (nw) => {
    if (players[socket.id]) players[socket.id].netWorth = Number(nw) || 0;
  });

  socket.on('subscribeTickers', async (symbols) => {
    const list = (symbols || []).map(s => String(s).toUpperCase()).filter(Boolean);
    for (const sym of list) {
      if (!subs[sym]) subs[sym] = new Set();
      subs[sym].add(socket.id);
    }
    // immediate snapshot so client sees prices before next poll
    const now = await fetchQuotes(list);
    for (const sym of Object.keys(now)) {
      socket.emit('price', { symbol: sym, ...now[sym] });
    }
  });

  socket.on('unsubscribeTickers', (symbols) => {
    const list = (symbols || []).map(s => String(s).toUpperCase());
    for (const sym of list) {
      subs[sym]?.delete(socket.id);
      if (subs[sym] && subs[sym].size === 0) delete subs[sym];
    }
  });

  socket.on('disconnect', () => {
    for (const sym of Object.keys(subs)) {
      subs[sym].delete(socket.id);
      if (subs[sym].size === 0) delete subs[sym];
    }
    delete players[socket.id];
    console.log('Disconnected:', socket.id);
  });
});

// ---- LEADERBOARD TICK ----
setInterval(() => {
  const leaderboard = Object.values(players).sort((a, b) => b.netWorth - a.netWorth);
  io.emit('leaderboard', leaderboard);
}, 2000);

// ---- BOOT ----
server.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
