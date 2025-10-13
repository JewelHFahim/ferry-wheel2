


// Version-001 & 002
// import type { Namespace } from "socket.io";
// import jwt, { JwtPayload } from "jsonwebtoken";
// import cookie from "cookie";

// type Claims = JwtPayload & { userId?: string; id?: string; _id?: string; role?: string };

// function extractToken(socket: any): string | undefined {
//   const a = socket.handshake?.auth?.token;
//   if (typeof a === "string" && a) return a;

//   const authz = socket.handshake?.headers?.authorization || socket.request?.headers?.authorization;
//   if (typeof authz === "string" && authz.startsWith("Bearer ")) return authz.slice(7).trim();

//   const q = socket.handshake?.query;
//   const qt = (q && (q.token as string)) || (q && (q.at as string));
//   if (typeof qt === "string" && qt) return qt;

//   const raw = socket.handshake?.headers?.cookie || socket.request?.headers?.cookie;
//   if (typeof raw === "string") {
//     const p = cookie.parse(raw);
//     return p.at || p.token;
//   }
// }

// function verify(token: string): Claims | null {
//   try {
//     const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "dev_secret";
//     return jwt.verify(token, secret) as Claims;
//   } catch {
//     return null;
//   }
// }

// export function socketAuthMiddleware(nsp: Namespace, opts: { strict?: boolean; joinRooms?: boolean } = {}) {
//   const strict = !!opts.strict;
//   const joinRooms = opts.joinRooms ?? true;

//   nsp.use((socket, next) => {
//     const token = extractToken(socket);

//     if (!token) return strict ? next(new Error("Unauthorized")) : next();

//     const claims = verify(token);
//     const uid = claims?.userId || claims?.id || claims?._id;
//     const role = claims?.role || "user";

//     if (!uid) return strict ? next(new Error("Unauthorized")) : next();

//     socket.data.user = { _id: String(uid), role: String(role) };
//     if (joinRooms) {
//       socket.join(`user:${socket.data.user._id}`);
//       socket.join(`role:${socket.data.user.role}`);
//     }
//     return next();
//   });
// }


// Version-003
import type { Namespace } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";
import cookie from "cookie";

type Claims = JwtPayload & { userId?: string; id?: string; _id?: string; role?: string };

function extractToken(socket: any): string | undefined {
  const a = socket.handshake?.auth?.token;
  if (typeof a === "string" && a) return a;

  const authz = socket.handshake?.headers?.authorization || socket.request?.headers?.authorization;
  if (typeof authz === "string" && authz.startsWith("Bearer ")) return authz.slice(7).trim();

  const q = socket.handshake?.query;
  const qt = (q && (q.token as string)) || (q && (q.at as string));
  if (typeof qt === "string" && qt) return qt;

  const raw = socket.handshake?.headers?.cookie || socket.request?.headers?.cookie;
  if (typeof raw === "string") {
    const p = cookie.parse(raw);
    return p.at || p.token;
  }
}

function verify(token: string): Claims | null {
  try {
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || "dev_secret";
    return jwt.verify(token, secret) as Claims;
  } catch (error) {
    console.error("JWT verification failed", error);
    return null;
  }
}

export function socketAuthMiddleware(nsp: Namespace, opts: { strict?: boolean; joinRooms?: boolean; openEvents?: string[] } = {}) {
  const strict = !!opts.strict;
  const joinRooms = opts.joinRooms ?? true;
  const openEvents = opts.openEvents ?? [];

  nsp.use((socket, next) => {
    const token = extractToken(socket);

    if (!token) {
      if (openEvents.includes(socket.handshake?.url)) {
        return next(); // Allow open events without token
      }
      return strict ? next(new Error("Unauthorized: Token is missing")) : next();
    }

    const claims = verify(token);

    if (!claims) return strict ? next(new Error("Unauthorized: Invalid token")) : next();

    const uid = claims.userId || claims.id || claims._id;
    const role = claims.role || "user";

    if (!uid) return strict ? next(new Error("Unauthorized: No user ID")) : next();

    socket.data.user = { _id: String(uid), role: String(role) };
    if (joinRooms) {
      socket.join(`user:${socket.data.user._id}`);
      socket.join(`role:${socket.data.user.role}`);
    }
    return next();
  });
}
