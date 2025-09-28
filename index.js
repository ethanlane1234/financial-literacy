// index.js
// Node 18+ recommended
const express = require('express');
const http = require('http');
// ⬇️ Either destructure Server...
const { Server } = require('socket.io');  // <-- FIXED
const path = require('path');

const yf = require('yahoo-finance2').default;

const PORT = process.env.PORT || 3000;
const app = express();

// Serve the repo root (where index.html & app.js live)
const PUBLIC_DIR = path.join(__dirname, 'public');   // ✅ build the full path
app.use(express.static(PUBLIC_DIR)); 
// Explicit root route (safe)
app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html')); // ✅ no stray "public" here
});

const server = http.createServer(app);
// ...and use new Server(server)
const io = new Server(server);           // <-- FIXED

// ---- GAME STATE (leaderboard) ----
const players = {}; // { socketId: { name, netWorth } }

// ---- TICKER SUBSCRIPTIONS ----
// subs: { "AAPL": Set<socketId>, ... }
const subs = {};
const cache = new Map(); // "AAPL" -> { price, change, changePct, currency, name, ts }

// Fetch quotes for 1+ symbols and normalize
async function fetchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {};
  try {
    const raw = await yf.quote(symbols); // accepts string | string[]
    const items = Array.isArray(raw) ? raw : [raw];
    const out = {};
    for (const q of items) {
      if (!q || !q.symbol) continue;
      const price =
        q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice ?? q.ask ?? q.bid ?? null;
      out[q.symbol.toUpperCase()] = {
        price: typeof price === 'number' ? price : null,
        change: q.regularMarketChange ?? null,
        changePct: q.regularMarketChangePercent ?? null,
        currency: q.currency ?? 'USD',
        name: q.shortName ?? q.longName ?? q.symbol,
      };
      cache.set(q.symbol.toUpperCase(), { ...out[q.symbol.toUpperCase()], ts: Date.now() });
    }
    return out;
  } catch (err) {
    console.error('fetchQuotes error:', err?.message || err);
    return {};
  }
}

// Poll all subscribed symbols every 5s and emit fresh prices to only those listeners
setInterval(async () => {
  const allSymbols = Object.keys(subs);
  if (!allSymbols.length) return;
  const quotes = await fetchQuotes(allSymbols);
  for (const sym of Object.keys(quotes)) {
    const sockets = subs[sym];
    if (!sockets || sockets.size === 0) continue;
    for (const sid of sockets) {
      io.to(sid).emit('price', { symbol: sym, ...quotes[sym] });
    }
  }
}, 5000);

// Optional: quick REST endpoint to test quotes
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
    // Immediate snapshot so the user doesn't see 0.00 until next poll
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

// Broadcast leaderboard every 2s
setInterval(() => {
  const leaderboard = Object.values(players).sort((a, b) => b.netWorth - a.netWorth);
  io.emit('leaderboard', leaderboard);
}, 2000);

// BOOT
server.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
