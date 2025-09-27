const express = require('express');
const { createServer } = require('http');
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
const server = createServer(app);
const io = socketIo(server);

io.on('connection', (socket) => {
    console.log('A user connected');
});

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})