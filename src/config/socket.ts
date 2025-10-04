import { Server } from "socket.io";
import http from "http";

export const initSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connect ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`❌ Socket disconnect ${socket.id}`);
    });
  });

  return io;
};
