import { Namespace } from "socket.io";

export function attachPresenceGate(nsp: Namespace) {
  // userId -> socket count (supports multi-tab)
  const counts = new Map<string, number>();

  const inc = (userId: string) => counts.set(userId, (counts.get(userId) || 0) + 1);
  const dec = (userId: string) => {
    const left = (counts.get(userId) || 1) - 1;
    if (left <= 0) counts.delete(userId);
    else counts.set(userId, left);
  };

  const hasActiveUsers = () => counts.size > 0;

  // optional: expose numbers for dashboards/metrics
  const stats = () => ({
    uniqueUsers: counts.size,
    totalSockets: [...counts.values()].reduce((a, b) => a + b, 0),
  });

  // helpers to wire on connection/disconnect
  const wireSocket = (socket: any) => {
    const userId: string | undefined = socket.data?.user?._id;
    if (userId) {
      inc(userId);
      socket.join(`user:${userId}`);

      socket.on("disconnect", () => {
        dec(userId);
        nsp.emit("presence:stats", stats()); // optional broadcast
      });

      nsp.emit("presence:stats", stats());   // optional broadcast
    }
  };

  return { hasActiveUsers, stats, wireSocket };
}
