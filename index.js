const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public'))); // public folder

// SERVER SIDE LOGIC

const PORT = 3000;

const playerStats = 
{
    cash: 0,
    bank: 0,
    stock1: 0,
    stock2: 0,
    stock3: 0,
    stock4: 0,
    stock5: 0,
};
let players = 
[
    playerStats
];

// SOCKET.IO
const server = http.createServer(app);
const io = socketIo(server);

setInterval(() => {
  const leaderboard = Object.values(players).sort((a, b) => b.netWorth - a.netWorth);
  io.emit("leaderboard", leaderboard);
}, 2000);

// THIS IS THE SOCKET
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Create a new player
  players[socket.id] = {
    cash: 500,
    bank: 0,
    income: 100,    // paycheck per round
    expenses: 50,   // rent/expenses per round
    stocks: { stock1: 0, stock2: 0 }
  };

  // Send all players to everyone
  io.emit("players", players);

  // Handle income
  socket.on("collectIncome", () => {
    players[socket.id].cash += players[socket.id].income;
    io.emit("players", players);
  });

  // Handle expenses
  socket.on("payExpenses", () => {
    const player = players[socket.id];
    if (player.cash >= player.expenses) {
      player.cash -= player.expenses;
      io.emit("players", players);
    }
  });

  // Buy stock (simple)
  socket.on("buyStock", (stock) => {
    const player = players[socket.id];
    if (player.cash >= 100) {
      player.cash -= 100;
      player.stocks[stock]++;
      io.emit("players", players);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("players", players);
  });
});

// RUN SERVER
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})