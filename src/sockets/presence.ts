import type { Namespace } from "socket.io";

export type Presence = {
  hasActiveUsers: () => boolean;
  wireSocket: (socket: any) => void;
};

export function createPresence(nsp: Namespace): Presence {
  const counts = new Map<string, number>();

  const inc = (uid: string) => counts.set(uid, (counts.get(uid) || 0) + 1);
  const dec = (uid: string) => {
    const next = (counts.get(uid) || 1) - 1;
    if (next <= 0) counts.delete(uid);
    else counts.set(uid, next);
  };

  return {
    hasActiveUsers: () => counts.size > 0,
    wireSocket(socket: any) {
      const uid: string | undefined = socket.data?.user?._id;
      if (!uid) return;
      inc(uid);
      socket.on("disconnect", () => dec(uid));
    },
  };
}
