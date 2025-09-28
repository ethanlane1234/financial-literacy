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