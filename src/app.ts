import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import appRoutes from "./routes/routes";
import { origins } from "./utils/statics/statics";
import logger from "./utils/logger";

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Logger
// app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Cors 
app.use(
  cors({
    origin: origins,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middlewares
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cookieParser());
app.use(morgan("dev"));

//Default route checker
app.get("/", (_: Request, res: Response) => {
  res.status(200).send("🎡 Ferry Wheel Game API Running...");
});

//App routes
app.use("/api/v1", appRoutes)

//Not found routes
app.use((_: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;
