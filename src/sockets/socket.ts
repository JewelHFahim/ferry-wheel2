import http from "http";
import { Server } from "socket.io";
import { EMIT } from "../utils/statics/emitEvents";
import { origins } from "../utils/statics/statics";
import { socketAuthMiddleware } from "../middlewares/socket.auth.middleware";
import {
  handleGetBalance,
  handleGetCompanyWallet,
  handleJoinRoom,
  handlePlaceBet,
} from "./socket.service";

// Function to handle user disconnect
export const handleDisconnect = (socket: any) => {
  socket.on("disconnect", (reason: string) => {
    console.log(
      `❌ [game] Disconnected [socket.id: ${socket.id}], Reason: ${reason}`
    );
    if (socket.data?.user) {
    }
  });
};

// Main function to initialize the socket
export const initSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: { origin: origins, methods: ["GET", "POST"], credentials: false },
  });

  // Namespace
  const game = io.of("/game");

  // Socket authentication middleware
  socketAuthMiddleware(game, { strict: true, joinRooms: true });

  // Socket connections and events
  game.on("connection", (socket) => {
    console.log("🔌 [game]", socket.id, socket.data?.user || "(guest)");

    //ping server
    socket.on(EMIT.PING_SERVER, (_data, callback) => {
      callback({ ok: true });
    });

    // Socket event listeners
    handleJoinRoom(socket);
    handleGetBalance(socket);
    handlePlaceBet(socket, game);
    handleDisconnect(socket);
    handleGetCompanyWallet(socket);
  });

  return { io, game };
};
