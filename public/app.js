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