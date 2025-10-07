// import { Server } from "socket.io";
// import http from "http";
// import { UserModel } from "../modules/user/user.model";
// import { BetService } from "../modules/bet/bet.service";
// import { socketAuthMiddleware } from "../middlewares/socket.auth.middleware";
// import { logBetAccepted, logError } from "../utils/gameEventLogger";

// // Initialize socket server
// export function initSocket(server: http.Server) {
//   // Declare 'game' first before using it
//   const io = new Server(server, {
//     cors: { origin: "*", methods: ["GET", "POST"], credentials: false },
//   });

//   // Dedicated namespace for game
//   const game = io.of("/game");

//   // Check Authentication
//   socketAuthMiddleware(game, { strict: false, joinRooms: true });

//   // Handling connection to the game namespace
//   game.on("connection", (socket) => {
//     console.log("🔌 [game]", socket.id, socket.data?.user || "(guest)");

//     // Join Room
//     socket.on("join", (data?: { room?: string }, ack?: (res: any) => void) => {
//       if (data?.room && /^table:\w{1,32}$/.test(data.room)) {
//         socket.join(data.room);
//       }
//       if (socket.data?.user) socket.join(`user:${socket.data.user._id}`);
//       ack?.({ ok: true });
//     });

//     // Get Balance
//     socket.on("get_balance", async (_payload, ack?: (res: any) => void) => {
//       const reply = typeof ack === "function" ? ack : () => {};
//       try {
//         if (!socket.data?.user) {
//           logError("Authentication required");
//           return reply({ success: false, code: "AUTH_REQUIRED", message: "Authentication required", });
//         }

//         const doc = await UserModel.findById(socket.data.user._id).select({ balance: 1 }).lean();

//         if (!doc) return reply({ success: false, code: "NOT_FOUND", message: "User not found",});

//         reply({ success: true, balance: doc.balance ?? 0 });

//         socket.emit("balance:update", { balance: doc.balance ?? 0 });
//       } catch (e: any) {
//         logError(`${e?.message} || "Could not fetch balance"`);
//         reply({ success: false, code: "INTERNAL", message: e?.message || "Could not fetch balance", });
//       }
//     });

//     // Place bet
//     socket.on("place_bet", async (payload: any, ack?: (res: any) => void) => {
//       const reply =
//         typeof ack === "function"
//           ? ack
//           : (res: any) => socket.emit("bet_error", res);
//       try {
//         if (!socket.data?.user) {
//           return reply({
//             success: false,
//             code: "AUTH_REQUIRED",
//             message: "Authentication required",
//           });
//         }

//         const { roundId, box, amount } = payload || {};
//         if (!roundId || !box || typeof amount !== "number") {
//           return reply({
//             success: false,
//             code: "INVALID_PAYLOAD",
//             message: "Invalid payload",
//           });
//         }

//         const bet = await BetService.placeBet({
//           userId: socket.data.user._id,
//           roundId,
//           box,
//           amount,
//           nsp: game,
//         });

//         // Emit success and provide bet details to the client
//         socket.emit("bet_accepted", { bet });
//         logBetAccepted(
//           bet.id,
//           bet.userId.toString(),
//           bet.roundId.toString(),
//           bet.box,
//           bet.amount
//         );

//         // Refresh balance
//         const me = await UserModel.findById(socket.data.user._id).select({ balance: 1 }).lean();
//         if (me) {
//           socket.emit("balance:update", {
//             balance: me.balance,
//             delta: -Math.abs(amount),
//             reason: "bet",
//             roundId,
//           });

//           socket.to(`user:${socket.data.user._id}`).emit("balance:update", {
//               balance: me.balance,
//               delta: -Math.abs(amount),
//               reason: "bet",
//               roundId,
//             });
//         }

//         // Optional public feed
//         game.emit("public_bet", {
//           user: socket.data.user._id.slice(-4),
//           box,
//           amount,
//         });

//         return reply({ success: true, bet });
//       } catch (e: any) {
//         const msg = String(e?.message || "Failed to place bet");
//         let code = "INTERNAL";
//         if (/Insufficient balance/i.test(msg)) code = "INSUFFICIENT_BALANCE";
//         else if (/Bet amount must be between/.test(msg)) code = "AMOUNT_RANGE";

//         try {
//           if (socket.data?.user) {
//             const doc = await UserModel.findById(socket.data.user._id)
//               .select({ balance: 1 })
//               .lean();
//             return reply({
//               success: false,
//               code,
//               message: msg,
//               balance: doc?.balance ?? 0,
//             });
//           }
//         } catch {}
//         return reply({ success: false, code, message: msg });
//       }
//     });

//     socket.on("disconnect", (reason) => {
//       console.log("❌ [game] disconnect", socket.id, reason);
//     });
//   });

//   return { io, game };
// }
import { Server } from "socket.io";
import { UserModel } from "../modules/user/user.model";
import { logBetAccepted, logError } from "../utils/gameEventLogger";
import { Namespace } from "socket.io";
import http from "http";
import { placeBet } from "../modules/bet/bet.service";
import { socketAuthMiddleware } from "../middlewares/socket.auth.middleware";

// Utility function for error responses
const sendErrorResponse = (ack: any, code: string, message: string, balance = 0) => {
  ack({ success: false, code, message, balance });
};

// Function to handle user joining a room
export const handleJoinRoom = (socket: any) => {
  socket.on("join", (data?: { room?: string }, ack?: (res: any) => void) => {
    if (data?.room && /^table:\w{1,32}$/.test(data.room)) {
      socket.join(data.room);
    }
    if (socket.data?.user) socket.join(`user:${socket.data.user._id}`);
    ack?.({ ok: true });
  });
};

// Function to get user balance
export const handleGetBalance = (socket: any) => {
  socket.on("get_balance", async (_payload: any, ack?: (res: any) => void) => {
    // Ensure the user is authenticated
    if (!socket.data?.user) {
      return sendErrorResponse(ack, "AUTH_REQUIRED", "Authentication required");
    }

    try {
      // Find the user's balance
      const user = await UserModel.findById(socket.data.user._id)
        .select({ balance: 1 })
        .lean();
      
      // Handle case where the user is not found
      if (!user) {
        return sendErrorResponse(ack, "NOT_FOUND", "User not found");
      }

      // Respond with the balance
      const balance = user.balance ?? 0;
      ack && ack({ success: true, balance });
      socket.emit("balance:update", { balance });

    } catch (e) {
      // Handle errors during the process
      const errorMessage = e instanceof Error ? e.message : "Could not fetch balance";
      logError(`${errorMessage} || "Could not fetch balance"`);
      sendErrorResponse(ack, "INTERNAL", errorMessage);
    }
  });
};

// Function to handle placing a bet
export const handlePlaceBet = (socket: any, nsp: Namespace) => {
  socket.on("place_bet", async (payload: any, ack?: (res: any) => void) => {
    const reply = typeof ack === "function" ? ack : (res: any) => socket.emit("bet_failed", res);

    try {
      if (!socket.data?.user) {
        return sendErrorResponse(reply, "AUTH_REQUIRED", "Authentication required");
      }

      const { roundId, box, amount } = payload || {};
      if (!roundId || !box || typeof amount !== "number") {
        return sendErrorResponse(reply, "INVALID_PAYLOAD", "Invalid payload");
      }

      // Place the bet
      const bet = await placeBet({
        userId: socket.data.user._id,
        roundId,
        box,
        amount,
        nsp,
      });

      // Emit success and provide bet details to the client
      socket.emit("betPlaced", { bet });
      logBetAccepted(
        bet.id,
        bet.userId.toString(),
        bet.roundId.toString(),
        bet.box,
        bet.amount
      );

      // Refresh balance
      const user = await UserModel.findById(socket.data.user._id)
        .select({ balance: 1 })
        .lean();
      if (user) {
        socket.emit("balance:update", {
          balance: user.balance,
          delta: -Math.abs(amount),
          reason: "bet",
          roundId,
        });

        socket.to(`user:${socket.data.user._id}`).emit("balance:update", {
          balance: user.balance,
          delta: -Math.abs(amount),
          reason: "bet",
          roundId,
        });
      }

      // Optional public feed
      nsp.emit("public_bet", {
        user: socket.data.user._id.slice(-4),
        box,
        amount,
      });

      return reply({ success: true, bet });
    } catch (e: any) {
      const msg = String(e?.message || "Failed to place bet");
      let code = "INTERNAL";
      if (/Insufficient balance/i.test(msg)) code = "INSUFFICIENT_BALANCE";
      else if (/Bet amount must be between/.test(msg)) code = "AMOUNT_RANGE";

      try {
        if (socket.data?.user) {
          const doc = await UserModel.findById(socket.data.user._id)
            .select({ balance: 1 })
            .lean();
          return reply({
            success: false,
            code,
            message: msg,
            balance: doc?.balance ?? 0,
          });
        }
      } catch {}
      return reply({ success: false, code, message: msg });
    }
  });
};

// Function to handle user disconnect
export const handleDisconnect = (socket: any) => {
  socket.on("disconnect", (reason: string) => {
    console.log(`❌ [game] Disconnected [socket.id: ${socket.id}], Reason: ${reason}`);
    if (socket.data?.user) {
      // Handle user-specific disconnection logic
    }
  });
};

// Main function to initialize the socket server and events
export const initSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: false },
  });

  const game = io.of("/game");

  // Apply socket authentication middleware
  socketAuthMiddleware(game, { strict: true, joinRooms: true });

  // Handle socket connections and events
  game.on("connection", (socket) => {
    console.log("🔌 [game]", socket.id, socket.data?.user || "(guest)");

    // Register socket event listeners
    handleJoinRoom(socket);
    handleGetBalance(socket);
    handlePlaceBet(socket, game);
    handleDisconnect(socket);
  });

  return { io, game };
};
