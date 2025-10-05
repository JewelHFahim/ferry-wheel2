import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import appRoutes from "./routes/routes";

const app = express();

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
// Use Morgan for logging HTTP requests
// app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));


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

app.use("/api/v1", appRoutes)

app.use((_: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;
