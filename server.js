const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// Create an Express app
const app = express();
const server = http.createServer(app);

// Attach Socket.IO to the server
const io = new Server(server);

// Serve static files (like index.html)
app.use(express.static("public"));

// When a client connects
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Listen for messages from client
  socket.on("chat message", (msg) => {
    console.log("Message:", msg);

    // Send message to ALL clients
    io.emit("chat message", msg);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});