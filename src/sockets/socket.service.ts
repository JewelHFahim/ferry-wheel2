import { Namespace } from "socket.io";
import CompanyWallet from "../modules/company/company.model";
import { UserModel } from "../modules/user/user.model";
import { logError } from "../utils/gameEventLogger";
import { EMIT } from "../utils/statics/emitEvents";
import { gameCodes } from "../utils/statics/statics";
import { placeBet } from "../modules/bet/bet.service";
import Bet from "../modules/bet/bet.model";


// Utility function for error responses
const sendErrorResponse = ( ack: any, code: string, message: string, balance = 0) => {
  ack({ success: false, code, message, balance });
};

// Create, Join Room, Count Total, Active user in room
export const handleJoinRoom = (socket: any) => {
  socket.on(
    "join",
    async (data?: { room?: string }, ack?: (res: any) => void) => {
      try {
        let roomName: string | undefined;

        // Join table room if valid
        if (data?.room && /^table:\w{1,32}$/.test(data.room)) {
          roomName = data.room;
          socket.join(roomName);
        }

        // Join personal user room
        if (socket.data?.user) {
          socket.join(`user:${socket.data.user._id}`);
        }

        // Count users in the room
        let joinedTotalUsers = 0;
        if (roomName) {
          const clients = socket.adapter.rooms.get(roomName);
          joinedTotalUsers = clients ? clients.size : 0;

          socket.to(roomName).emit(EMIT.JOINED_TOTAL_USERS, { count: joinedTotalUsers });
          socket.emit(EMIT.JOINED_TOTAL_USERS, { count: joinedTotalUsers });
        }

        // Ack callback for the joining socket
        ack?.({ ok: true, joinedTotalUsers });
      } catch (err) {
        console.error("Error joining room:", err);
        ack?.({ ok: false, error: "Failed to join room" });
      }
    }
  );
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
      const errorMessage =
        e instanceof Error ? e.message : "Could not fetch balance";
      logError(`${errorMessage} || "Could not fetch balance"`);
      sendErrorResponse(ack, "INTERNAL", errorMessage);
    }
  });
};

// Function to get company wallet
export const handleGetCompanyWallet = async (socket: any) => {
  socket.on(
    "get_company_wallet",
    async (payload: any, ack?: (res: any) => void) => {
      // Ensure the admin
      if (!socket.data.user) {
        return sendErrorResponse(
          ack,
          "AUTH_REQUIRED",
          "Authentication required- for admin"
        );
      }

      try {
        const wallet = await CompanyWallet.find({});

        console.log("wallet", wallet);

        socket.emit("get_company_wallet", wallet);
      } catch (error) {
        // Handle errors during the process
        const errorMessage =
          error instanceof Error ? error.message : "Could not fetch balance";
        logError(`${errorMessage} || "Could not fetch wallet"`);
        sendErrorResponse(ack, "INTERNAL", errorMessage);
      }
    }
  );
};

// Function to handle placing a bet
export const handlePlaceBet = (socket: any, nsp: Namespace) => {
  socket.on("place_bet", async (payload: any, ack?: (res: any) => void) => {
    const reply = typeof ack === "function" ? ack : (res: any) => socket.emit("bet_error", res);

    try {
      if (!socket.data?.user) {
        return reply({
          success: false,
          code: gameCodes.AUTH_REQUIRED,
          message: "Authentication required",
        });
      }

      const { roundId, box, amount } = payload || {};
      if (!roundId || !box || typeof amount !== "number") {
        return reply({
          success: false,
          code: gameCodes.INVALID_PAYLOAD,
          message: "Invalid payload",
        });
      }

      // Place the bet
      const bet = await placeBet({
        userId: socket.data.user._id,
        roundId,
        box,
        amount,
        nsp,
      });

      // Emit bet accepted event to the user
      socket.emit("bet_accepted", { bet });

      // Calculate all bets of the user in this round
      const userBets = await Bet.find({
        roundId,
        userId: socket.data.user._id,
      }).lean();

      const totalUserBet = userBets.reduce((sum, b) => sum + b.amount, 0);

      // User round total bet
      socket.emit("user_bet_total", { roundId, totalUserBet });

      reply({ success: true, bet });
    } catch (e: any) {
      return reply({
        success: false,
        code: gameCodes.INTERNAL,
        message: e?.message || "Failed to place bet",
      });
    }
  });
};
