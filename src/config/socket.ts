// import { Server } from "socket.io";
// import type http from "http";
// import { UserModel } from "../modules/user/user.model";
// import { socketAuthMiddleware } from "../middlewares/socket.auth.middleware";

// export function initSocket(server: http.Server) {
//   const io = new Server(server, {
//     cors: { origin: "*", methods: ["GET","POST"], credentials: false },
//   });

//   // IMPORTANT: Create the /game namespace
//   const game = io.of("/game");

//   // Attach auth middleware ON THIS NAMESPACE
//   socketAuthMiddleware(game, { strict: false, joinRooms: true });

//   // Register handlers ON THIS NAMESPACE
//   game.on("connection", (socket) => {
//     console.log("🔌 [game]", socket.id, socket.data?.user || "(guest)");

//     socket.on("get_balance", async (_payload, ack?: (res:any)=>void) => {
//       const reply = typeof ack === "function" ? ack : () => {};
//       try {
//         if (!socket.data?.user) {
//           return reply({ success:false, code:"AUTH_REQUIRED", message:"Authentication required" });
//         }
//         const doc = await UserModel.findById(socket.data.user._id).select({ balance:1 }).lean();
//         if (!doc) return reply({ success:false, code:"NOT_FOUND", message:"User not found" });

//         reply({ success:true, balance: doc.balance ?? 0 });

//         // optional push
//         socket.emit("balance:update", { balance: doc.balance ?? 0 });
//       } catch (e:any) {
//         console.error("get_balance failed:", e?.message || e);
//         reply({ success:false, code:"INTERNAL", message:"Could not fetch balance" });
//       }
//     });

//     // … your other events: join, place_bet, etc.
//     socket.on("disconnect", (reason) => {
//       console.log("❌ [game] disconnect", socket.id, reason);
//     });
//   });

//   return { io, game };
// }


// New Socket

import { Server } from "socket.io";
import type http from "http";
import { UserModel } from "../modules/user/user.model";
import { BetService } from "../modules/bet/bet.service";
import { socketAuthMiddleware } from "../middlewares/socket.auth.middleware";

export function initSocket(server: http.Server) {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: false }
  });

  const game = io.of("/game");
  socketAuthMiddleware(game, { strict: false, joinRooms: true });

  game.on("connection", (socket) => {
    console.log("🔌 [game]", socket.id, socket.data?.user || "(guest)");

    socket.on("join", (data?: { room?: string }, ack?: (res: any) => void) => {
      if (data?.room && /^table:\w{1,32}$/.test(data.room)) socket.join(data.room);
      if (socket.data?.user) socket.join(`user:${socket.data.user._id}`);
      ack?.({ ok: true });
    });

    socket.on("get_balance", async (_payload, ack?: (res: any) => void) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (!socket.data?.user) {
          return reply({ success: false, code: "AUTH_REQUIRED", message: "Authentication required" });
        }
        const doc = await UserModel.findById(socket.data.user._id).select({ balance: 1 }).lean();
        if (!doc) return reply({ success: false, code: "NOT_FOUND", message: "User not found" });
        reply({ success: true, balance: doc.balance ?? 0 });
        socket.emit("balance:update", { balance: doc.balance ?? 0 });
      } catch (e: any) {
        reply({ success: false, code: "INTERNAL", message: e?.message || "Could not fetch balance" });
      }
    });

    // socket.on("place_bet", async (payload: any, ack?: (res: any) => void) => {
    //   const reply = typeof ack === "function" ? ack : (res: any) => socket.emit("bet_error", res);
    //   try {
    //     if (!socket.data?.user) return reply({ success: false, code: "AUTH_REQUIRED", message: "Authentication required" });

    //     const { roundId, box, amount } = payload || {};
    //     if (!roundId || !box || typeof amount !== "number") {
    //       return reply({ success: false, code: "INVALID_PAYLOAD", message: "Invalid payload" });
    //     }

    //     const bet = await BetService.placeBet({
    //       userId: socket.data.user._id,
    //       roundId,
    //       box,
    //       amount
    //     });

    //     socket.emit("bet_accepted", { bet });
    //     game.emit("public_bet", { user: socket.data.user._id.slice(-4), box, amount });
    //     return reply({ success: true, bet });
    //   } catch (e: any) {
    //     const msg = String(e?.message || "Failed to place bet");
    //     let code = "INTERNAL";
    //     if (/Insufficient balance/i.test(msg)) code = "INSUFFICIENT_BALANCE";
    //     else if (/Bet amount must be between/.test(msg)) code = "AMOUNT_RANGE";

    //     // include balance snapshot for reconciliation
    //     try {
    //       if (socket.data?.user) {
    //         const doc = await UserModel.findById(socket.data.user._id).select({ balance: 1 }).lean();
    //         return reply({ success: false, code, message: msg, balance: doc?.balance ?? 0 });
    //       }
    //     } catch {}
    //     return reply({ success: false, code, message: msg });
    //   }
    // });


    // Place bet
    socket.on("place_bet", async (payload: any, ack?: (res: any) => void) => {
  const reply = typeof ack === "function" ? ack : (res: any) => socket.emit("bet_error", res);
  try {
    if (!socket.data?.user) {
      return reply({ success: false, code: "AUTH_REQUIRED", message: "Authentication required" });
    }

    const { roundId, box, amount } = payload || {};
    if (!roundId || !box || typeof amount !== "number") {
      return reply({ success: false, code: "INVALID_PAYLOAD", message: "Invalid payload" });
    }

    const bet = await BetService.placeBet({
      userId: socket.data.user._id,
      roundId,
      box,
      amount
    });

    // Let client append bet
    socket.emit("bet_accepted", { bet });

    // Push the post-deduction balance (authoritative)
    const me = await UserModel.findById(socket.data.user._id).select({ balance: 1 }).lean();
    if (me) {
      // to caller socket
      socket.emit("balance:update", { balance: me.balance, delta: -Math.abs(amount), reason: "bet", roundId });
      // to other tabs/devices of same user
      socket.to(`user:${socket.data.user._id}`).emit("balance:update", { balance: me.balance, delta: -Math.abs(amount), reason: "bet", roundId });
    }

    // optional public feed
    const game = socket.nsp;
    game.emit("public_bet", { user: socket.data.user._id.slice(-4), box, amount });

    return reply({ success: true, bet });
  } catch (e: any) {
    const msg = String(e?.message || "Failed to place bet");
    let code = "INTERNAL";
    if (/Insufficient balance/i.test(msg)) code = "INSUFFICIENT_BALANCE";
    else if (/Bet amount must be between/.test(msg)) code = "AMOUNT_RANGE";

    try {
      if (socket.data?.user) {
        const doc = await UserModel.findById(socket.data.user._id).select({ balance: 1 }).lean();
        return reply({ success: false, code, message: msg, balance: doc?.balance ?? 0 });
      }
    } catch {}
    return reply({ success: false, code, message: msg });
  }
});



    socket.on("disconnect", (reason) => {
      console.log("❌ [game] disconnect", socket.id, reason);
    });
  });

  return { io, game };
}
