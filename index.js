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
  console.log("Player connected:", socket.id);

  // register player
  socket.on("register", (player) => {
    players[socket.id] = 
    { 
        player,
        netWorth: 10000 
    };
  });

  // update player networth
  socket.on("updateNetWorth", (netWorth) => {
    if (players[socket.id]) players[socket.id].netWorth = netWorth;
  });

  // disconnect
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

// RUN SERVER
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})