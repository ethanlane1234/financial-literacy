let socket;
let player_name;
let year = 0, month = 0;
let player = { cash: 10000, stockPositions: {}, indexInvestment: 0 };
let bank = { balance: 0, rate: 0.02 };
let stocks = [];
let indexFund = { nav: 0 };
let history = [];
let chart;
let progress = 0;

function fmt(x) {
   return "$" + x.toFixed(2);
}
function rnd(min, max) { 
  return Math.random() * (max - min) + min; 
}
function gaussian() {
  let u1 = Math.random(), u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function render() {
  document.getElementById("year").innerText = "Year: " + year;
  document.getElementById("month").innerText = "Month: " + (month + 1);
  document.getElementById("cash").innerText = "Cash: " + fmt(player.cash);
  document.getElementById("bank").innerText = "Bank: " + fmt(bank.balance);
  document.getElementById("index").innerText =
    `Index NAV: ${fmt(indexFund.nav)} | Investment: ${fmt(player.indexInvestment)}`;
  document.getElementById("networth").innerText = "Net Worth: " + fmt(netWorth());

  // stocks UI
  let sDiv = document.getElementById("stocks");
  sDiv.innerHTML = "";
  for (let s of stocks) {
    let owned = player.stockPositions[s.name] || 0;
    sDiv.innerHTML += `
      <div class="border p-2 mb-2 rounded bg-white shadow">
        <strong>${s.name}</strong> Price: ${fmt(s.price)} | Owned: ${owned.toFixed(2)} shares
        <div class="flex space-x-2 mt-2">
          <input id="amt_${s.name}" type="number" placeholder="Buy $" class="border px-2 py-1">
          <button onclick="buyStock('${s.name}')" class="px-2 py-1 bg-green-500 text-white rounded">Buy</button>
          <input id="sell_${s.name}" type="number" placeholder="Sell shares" class="border px-2 py-1">
          <button onclick="sellStock('${s.name}')" class="px-2 py-1 bg-yellow-500 text-black rounded">Sell</button>
        </div>
      </div>
    `;
  }

  // chart
  if (!chart) {
    chart = new Chart(document.getElementById("chart"), {
      type: "line",
      data: { labels: [], datasets: [{ label: "Net Worth", data: [] }] },
      options: { responsive: true }
    });
  }
  chart.data.labels = history.map(h => h.t);
  chart.data.datasets[0].data = history.map(h => h.value);
  chart.update();

  // progress bar
  progress = (month / 12) * 100;
  document.getElementById("progress").style.width = progress + "%";
}

function joinGame() {
  name = document.getElementById("playerName").value || "Player";
  socket = io();
  socket.emit("register", name);

  socket.on("leaderboard", (data) => {
    let list = document.getElementById("leaderboard");
    list.innerHTML = "";
    data.forEach((p, i) => {
      list.innerHTML += `<li>${i + 1}. ${p.name} - ${fmt(p.netWorth)}</li>`;
    });
  });

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  initGame();

  // start timer → 1 month every 2s
  setInterval(nextMonth, 2000);
}

function buyStock(name) {
  let amt = parseFloat(document.getElementById("amt_" + name).value);
  let stock = stocks.find(s => s.name === name);
  if (amt > 0 && amt <= player.cash) {
    let shares = amt / stock.price;
    player.stockPositions[name] = (player.stockPositions[name] || 0) + shares;
    player.cash -= amt;
    render();
  }
}
function sellStock(name) {
  let shares = parseFloat(document.getElementById("sell_" + name).value);
  let stock = stocks.find(s => s.name === name);
  let owned = player.stockPositions[name] || 0;
  let sAmt = Math.min(shares, owned);
  player.cash += sAmt * stock.price;
  player.stockPositions[name] = owned - sAmt;
  render();
}
function investIndex() {
  let amt = parseFloat(document.getElementById("indexAmount").value);
  if (amt > 0 && amt <= player.cash) {
    player.indexInvestment += amt;
    player.cash -= amt;
    render();
  }
}
function sellIndex() {
  let amt = parseFloat(document.getElementById("indexAmount").value);
  let take = Math.min(amt, player.indexInvestment);
  player.indexInvestment -= take;
  player.cash += take;
  render();
}
function deposit() {
  let amt = parseFloat(document.getElementById("bankAmount").value);
  if (amt > 0 && amt <= player.cash) {
    player.cash -= amt;
    bank.balance += amt;
    render();
  }
}
function withdraw() {
  let amt = parseFloat(document.getElementById("bankAmount").value);
  let take = Math.min(amt, bank.balance);
  bank.balance -= take;
  player.cash += take;
  render();
}
function updateIndex() {
  let avg = stocks.reduce((s, st) => s + st.price, 0) / stocks.length;
  indexFund.nav = avg;
}

function netWorth() {
  let nw = player.cash + bank.balance + player.indexInvestment;
  for (let s of stocks) {
    nw += (player.stockPositions[s.name] || 0) * s.price;
  }
  return nw;
}

function nextMonth() {
  month++;
  if (month >= 12) {
    month = 0;
    year++;
    player.cash += 5000;
  }

  for (let s of stocks) {
    let shock = gaussian() * s.vol;
    s.price = Math.max(1, s.price * Math.exp(s.drift + shock));
  }

  bank.balance *= (1 + bank.rate / 12);

  // index update
  updateIndex();
  // index investments grow
  player.indexInvestment *= (1 + 0.005); // ~6% annualized

  history.push({ t: year * 12 + month, value: netWorth() });

  // report to server
  socket.emit("updateNetWorth", netWorth());

  render();
}