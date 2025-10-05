// import express, { Request, Response, NextFunction } from "express";
// import cors from "cors";
// import helmet from "helmet";
// import cookieParser from "cookie-parser";
// import morgan from "morgan";
// import appRoutes from "./routes/routes";

// const app = express();

// // If you're behind a proxy/load balancer
// app.set("trust proxy", 1);

// // Body parsers
// app.use(express.json({ limit: "1mb" }));
// app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// // CORS: choose ONE of these blocks ↓↓↓

// // 1) Allow-all for quick testing (no cookies)
// app.use(
//   cors({
//     origin: "*",
//     credentials: false, // must be false when origin is "*"
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

// // 2) If you need cookies/withCredentials from the browser, use this instead:
// /*
// app.use(cors({
//   origin: (origin, cb) => cb(null, true), // reflect any origin
//   credentials: true,                       // now allowed by browsers
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));
// */

// // Security headers
// app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

// // Cookies
// app.use(cookieParser());

// // Logger
// app.use(morgan("dev"));

// // Health
// app.get("/", (_req: Request, res: Response) => {
//   res.status(200).send("🎡 Ferry Wheel Game API Running...");
// });

// // ✅ Register your API routes BEFORE the 404 handler
// app.use("/api/v1", appRoutes);

// // 404 (after routes)
// app.use((req: Request, res: Response) => {
//   res.status(404).json({ message: "Route not found" });
// });

// // (optional) Central error handler
// app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
//   console.error("Unhandled error:", err);
//   res.status(500).json({ message: "Internal server error" });
// });

// export default app;


// New App.ts
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use(
  cors({
    origin: "*",
    credentials: false,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (_: Request, res: Response) => {
  res.status(200).send("🎡 Ferry Wheel Game API Running...");
});

app.use((_: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;
