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
import { MetService } from "../modules/met/met.service";
import { getUserPerboxTotal } from "../modules/bet/userTotals.service";

const emitUserPerboxTotal = async (nsp: ReturnType<Server["of"]>, userId: string, roundId?: string) => {
  let rid = roundId;
  if (!rid) {
    const meta = await MetService.getMeta();
    rid = meta.currentRoundId ? String(meta.currentRoundId) : undefined;
  }
  if (!rid) return;

  const userPerBoxTotal = await getUserPerboxTotal(userId, rid);
  nsp.to(`user:${userId}`).emit(EMIT.USER_PERBOX_TOTAL, {
    roundId: rid,
    userId,
    userPerBoxTotal,
  });
};

// Function to handle user disconnect
export const handleDisconnect = (socket: any) => {
  socket.on("disconnect", (reason: string) => {
    console.log(
      `[fw] Disconnected [socket.id: ${socket.id}], Reason: ${reason}`
    );
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
    console.log("🔌 [fw]", socket.id, socket.data?.user || "(guest)");

    const userId: string | undefined = socket.data?.user?._id;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    // ping
    socket.on(EMIT.PING_SERVER, (_data, callback) => {
      callback({ ok: true });
    });

    // Get current round snapshot (public) + user's private per-box totals
    socket.on(EMIT.GET_CURRENT_ROUND, async (_payload, ack) => {
      try {
        const snap = await MetService.getCurrentRoundSnapshot();
        if (!snap) {
          ack?.({ success: false, message: "No active round", round: null, userPerBoxTotal: [] });
          return;
        }

        let userPerBoxTotal: any[] = [];
        if (userId) {
          userPerBoxTotal = await getUserPerboxTotal(userId, snap._id);
        }

        let phaseEndTime = snap.endTime;
        if (snap.roundStatus === "revealing") phaseEndTime = snap.revealTime;
        else if (snap.roundStatus === "prepare") phaseEndTime = snap.prepareTime;

        ack?.({
          success: true,
          round: snap,               
          userPerBoxTotal,          
          phaseEndTime,
        });

        if (userId) await emitUserPerboxTotal(game, userId, snap._id);
      } catch (e: any) {
        ack?.({ success: false, message: e?.message || "server error" });
      }
    });

    // current per-box totals immediately
    socket.on("join", async (payload, ack) => {
      try {
        handleJoinRoom(socket);

        if (userId) await emitUserPerboxTotal(game, userId);

        ack && ack({ success: true });
      } catch (e: any) {
        ack && ack({ success: false, message: e?.message || "join failed" });
      }
    });

    // other service handlers
    handleGetBalance(socket);
    handlePlaceBet(socket, game);
    handleDisconnect(socket);
    handleGetCompanyWallet(socket);
  });

  return { io, game };
};
