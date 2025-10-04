import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import appRoutes from "./routes/routes";

const app = express();

// Trust proxy if behind one (nginx, vercel)
app.set("trust proxy", 1);

// Body limit to avoid heavy payload attacks
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// CORS- align with frontned
app.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

//For basic security
app.use( helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

// For cookies
app.use(cookieParser());

// Logger
app.use(morgan("dev"));

// simple landing page for healt check
app.get("/", (req:Request, res: Response) => {
  res.status(200).send("🎡 Ferry Wheel Game API Running...");
});

// ----- Global 404 Handler -----
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

// Api Routes Here
app.use("/api/v1", appRoutes)


export default app;