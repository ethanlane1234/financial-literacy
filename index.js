const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public'))); // public folder

// SERVER SIDE LOGIC

const PORT = 3000;

// SOCKET.IO
const server = http.createServer(app);
const io = socketIo(server);

let players = {}; // { socketId: { name, netWorth } }

// broadcast leaderboard every 2s
setInterval(() => {
  const leaderboard = Object.values(players)
    .sort((a, b) => b.netWorth - a.netWorth);
  io.emit("leaderboard", leaderboard);
}, 2000);

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // register player
  socket.on("register", (name) => {
    players[socket.id] = { name, netWorth: 10000 };
  });

  // update player networth
  socket.on("updateNetWorth", (nw) => {
    if (players[socket.id]) players[socket.id].netWorth = nw;
  });

  // remove on disconnect
  socket.on("disconnect", () => {
    delete players[socket.id];
    console.log("Player disconnected:", socket.id);
  });
});

// RUN SERVER
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})