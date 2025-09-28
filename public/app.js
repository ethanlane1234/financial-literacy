// app.js
let socket;
let year = 0, month = 0;
let player = { cash: 10000, stockPositions: {}, indexInvestment: 0 };
let bank = { balance: 0, rate: 0.02 };

// Pick your real tickers here
const TICKERS = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA"];

let stocks = [];           // [{ name, price, currency }]
let indexFund = { nav: 0 };
let history = [];
let chart;

function fmt(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "$0.00";
  return "$" + n.toFixed(2);
}

function render() {
  document.getElementById("year").innerText = "Year: " + year;
  document.getElementById("month").innerText = "Month: " + (month + 1);
  document.getElementById("cash").innerText = "Cash: " + fmt(player.cash);
  document.getElementById("bank").innerText = "Bank: " + fmt(bank.balance);
  document.getElementById("index").innerText =
    `Index NAV: ${fmt(indexFund.nav)} | Investment: ${fmt(player.indexInvestment)}`;
  document.getElementById("networth").innerText = "Net Worth: " + fmt(netWorth());

  // Stocks UI
  const sDiv = document.getElementById("stocks");
  sDiv.innerHTML = "";
  for (const s of stocks) {
    const owned = player.stockPositions[s.name] || 0;
    sDiv.innerHTML += `
      <div class="border p-3 mb-2 rounded bg-white shadow">
        <div class="flex items-center justify-between">
          <div class="font-semibold">${s.name}</div>
          <div>Price: ${fmt(s.price)} <span class="text-gray-500 text-sm">${s.currency || "USD"}</span></div>
        </div>
        <div class="flex flex-wrap gap-2 mt-2">
          <input id="amt_${s.name}" type="number" placeholder="Buy $" class="border px-2 py-1">
          <button onclick="buyStock('${s.name}')" class="px-2 py-1 bg-green-600 text-white rounded">Buy</button>
          <input id="sell_${s.name}" type="number" placeholder="Sell shares" class="border px-2 py-1">
          <button onclick="sellStock('${s.name}')" class="px-2 py-1 bg-yellow-400 text-black rounded">Sell</button>
        </div>
        <div class="mt-1 text-sm">Owned: ${owned.toFixed(4)} shares</div>
      </div>
    `;
  }

  // Chart
  if (!chart) {
    chart = new Chart(document.getElementById("chart"), {
      type: "line",
      data: { labels: [], datasets: [{ label: "Net Worth", data: [] }] },
      options: { responsive: true, animation: false }
    });
  }
  chart.data.labels = history.map(h => h.t);
  chart.data.datasets[0].data = history.map(h => h.value);
  chart.update();

  // Progress bar (month progress in the year)
  document.getElementById("progress").style.width = (month / 12) * 100 + "%";
}

function joinGame() {
  const name = document.getElementById("playerName").value || "Player";
  socket = io();
  socket.emit("register", name);

  // Live leaderboard
  socket.on("leaderboard", (data) => {
    const list = document.getElementById("leaderboard");
    list.innerHTML = "";
    data.forEach((p, i) => {
      list.innerHTML += `<li>${i + 1}. ${p.name} - ${fmt(p.netWorth)}</li>`;
    });
  });

  // Live price updates
  socket.on("price", ({ symbol, price, currency }) => {
    const s = stocks.find(x => x.name === symbol);
    if (s && typeof price === "number") {
      s.price = price;
      s.currency = currency || "USD";
      updateIndex();
      render();
    }
  });

  // Market guess updates
  socket.on('marketGuess', ({ state, score, medianPct }) => {
    const el = document.getElementById('marketBanner');
    let txt = `Market: ${state} (${medianPct}%)`;

    // pick a background tint from score [-1..1]
    const down = 'bg-red-600', up = 'bg-green-600', flat = 'bg-gray-600';
    let cls = flat;
    if (score <= -0.4) cls = 'bg-red-700';
    else if (score < -0.1) cls = down;
    else if (score >= 0.4) cls = 'bg-green-700';
    else if (score > 0.1) cls = up;

    el.className = `mb-3 p-3 rounded text-white ${cls}`;
    el.textContent = txt;
    el.classList.remove('hidden');
  });

  // Subscribe to the tickers we care about
  socket.emit("subscribeTickers", TICKERS);

  // Show game UI
  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  initGame();

  // Game clock: 1 month every 10 seconds
  setInterval(nextMonth, 10000);
}

function buyStock(name) {
  const amt = parseFloat(document.getElementById("amt_" + name).value);
  const stock = stocks.find(s => s.name === name);
  if (!stock || !(amt > 0) || amt > player.cash || !(stock.price > 0)) return;
  const shares = amt / stock.price;
  player.stockPositions[name] = (player.stockPositions[name] || 0) + shares;
  player.cash -= amt;
  render();
}

function sellStock(name) {
  const shares = parseFloat(document.getElementById("sell_" + name).value);
  const stock = stocks.find(s => s.name === name);
  if (!stock || !(shares > 0)) return;
  const owned = player.stockPositions[name] || 0;
  const sAmt = Math.min(shares, owned);
  player.cash += sAmt * (stock.price || 0);
  player.stockPositions[name] = owned - sAmt;
  render();
}

function investIndex() {
  const amt = parseFloat(document.getElementById("indexAmount").value);
  if (amt > 0 && amt <= player.cash) {
    player.indexInvestment += amt;
    player.cash -= amt;
    render();
  }
}

function sellIndex() {
  const amt = parseFloat(document.getElementById("indexAmount").value);
  const take = Math.min(amt, player.indexInvestment);
  player.indexInvestment -= take;
  player.cash += take;
  render();
}

function deposit() {
  const amt = parseFloat(document.getElementById("bankAmount").value);
  if (amt > 0 && amt <= player.cash) {
    player.cash -= amt;
    bank.balance += amt;
    render();
  }
}

function withdraw() {
  const amt = parseFloat(document.getElementById("bankAmount").value);
  const take = Math.min(amt, bank.balance);
  bank.balance -= take;
  player.cash += take;
  render();
}

// Index NAV = simple average of live prices
function updateIndex() {
  const priced = stocks.filter(s => typeof s.price === "number" && s.price > 0);
  indexFund.nav = priced.length
    ? priced.reduce((sum, s) => sum + s.price, 0) / priced.length
    : 0;
}

function netWorth() {
  let nw = player.cash + bank.balance + player.indexInvestment;
  for (const s of stocks) {
    nw += (player.stockPositions[s.name] || 0) * (s.price || 0);
  }
  return nw;
}

function nextMonth() {
  month++;
  if (month >= 12) { month = 0; year++; player.cash += 5000; } // yearly paycheck
  bank.balance *= (1 + bank.rate / 12);        // monthly interest
  player.indexInvestment *= (1 + 0.005);       // ~6%/yr drift
  history.push({ t: year * 12 + month, value: netWorth() });
  if (socket) socket.emit("updateNetWorth", netWorth());
  render();
}

function initGame() {
  year = 0; month = 0;
  player = { cash: 10000, stockPositions: {}, indexInvestment: 0 };
  bank = { balance: 0, rate: 0.02 };
  stocks = TICKERS.map(sym => ({ name: sym, price: 0, currency: "USD" }));
  indexFund = { nav: 0 };
  history = [];
  render();
}

// expose for buttons in index.html
window.joinGame = joinGame;
window.buyStock = buyStock;
window.sellStock = sellStock;
window.investIndex = investIndex;
window.sellIndex = sellIndex;
window.deposit = deposit;
window.withdraw = withdraw;
