import { Server, Socket } from "socket.io";
import { BetService } from "../modules/bet/bet.service";
import { UserService } from "../modules/user/user.service";
import { MetService } from "../modules/met/met.service";
import Round from "../modules/round/round.model";
import { getRoundEngine } from "../jobs/roundEngine.instance";

export const initGameSocket = (io: Server) => {
  io.on("connection", async (socket: Socket) => {
    console.log(`🎮 User connected: ${socket.id}`);

    /**
     * 🟢 Handle bet placement
     */
    socket.on("bet:place",
      async ({ userId, roundId, box, amount }: {
        userId: string;
        roundId: string;
        box: string;
        amount: number;
      }) => {
        try {
          console.log(`📩 Bet received from ${userId}: ${amount} on ${box}`);

          const result = await BetService.placeBet({
            userId,
            roundId,
            box,
            amount,
          });

          if (!result.success) {
            socket.emit("bet:failed", { message: result.message });
            return;
          }

          // ✅ Fetch updated user balance
          const updatedUser = await UserService.getById(userId);

          // ✅ Broadcast bet placed to all users
          io.emit("bet:placed", {
            userId,
            roundId,
            box,
            amount,
            balance: updatedUser?.balance,
          });

          // ✅ Update only this user's balance
          socket.emit("user:balance", {
            balance: updatedUser?.balance,
          });
        } catch (error: any) {
          console.error("❌ bet:place error:", error);
          socket.emit("bet:failed", {
            message: error.message || "Failed to place bet",
          });
        }
      }
    );

    /**
     * 🔁 Client requests current round info
     */
    socket.on("round:status", async () => {
      try {
        const met = await MetService.getMeta();
        if (!met.currentRoundId) {
          socket.emit("round:status", { message: "No active round" });
          return;
        }

        const round = await Round.findById(met.currentRoundId);
        socket.emit("round:status", round);
      } catch (error) {
        console.error("round:status error:", error);
        socket.emit("round:status", { message: "Error fetching round info" });
      }
    });

    /**
     * 🔧 Admin-triggered manual next round (optional)
     */
    socket.on("admin:nextRound", async () => {
      console.log("⏭️ Admin requested new round start");
      const engine = getRoundEngine();
      await engine.startNewRound();
      io.emit("admin:roundRestarted");
    });

    /**
     * 🧾 For debugging / user info
     */
    socket.on("user:info", async (userId: string) => {
      const user = await UserService.getById(userId);
      if (user) socket.emit("user:info", user);
      else socket.emit("user:info", { message: "User not found" });
    });

    /**
     * 🔴 On disconnect
     */
    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });

  console.log("✅ Game socket initialized");
};
