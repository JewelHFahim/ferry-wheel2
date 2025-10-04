// import { NextFunction, Request, Response } from "express";
// import jwt from "jsonwebtoken";
// import { env } from "../config/env";
// import { UserServices } from "../modules/user/user.service";

// interface JwtPayload {
//   hostedUserId: string;
//   username: string;
//   role?: "user" | "bot" | "admin";
// }

// export const authMiddleware = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const authHeader = req.headers["authorization"];
//     if (!authHeader && !authHeader?.startsWith("Bearer ")) {
//       return res.status(401).json({ status: false, message: "Unauthorized: token missing" });
//     }

//     const token = authHeader.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({ status: false, message: "Token formate wrong" });
//     }

//     const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

//     let user = await UserServices.findByHostedId(payload.hostedUserId);
    
//     if (!user) {
//       user = await UserServices.createUser({
//         hostedUserId: payload.hostedUserId,
//         username: payload.username,
//         role: payload.role ?? "user",
//       });
//     }

//     (req as any).user = user;
//     next();
//   } catch (error) {
//     console.error("Auth error:", error);
//     return res.status(401).json({ status: false, message: "Unauthorized" });
//   }
// };



// // optional role-based middleware
// export const requireRole = (roles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (!req.user || !roles.includes(req.user.role)) {
//       return res.status(403).json({ message: "Forbidden: insufficient role" });
//     }
//     next();
//   };
// };

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface JwtPayload {
  userId: string;
  role: "user" | "bot" | "admin";
  iat: number;
  exp: number;
}

// Extend Express Request to include user
declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token missing" });

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};
