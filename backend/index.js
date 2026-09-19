import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.js";
import jobRoutes from "./routes/job.js";
import userRoutes from "./routes/user.js";
import { startIngestionScheduler, stopIngestionScheduler } from "./services/ingestionScheduler.js";

dotenv.config();

// Default NODE_ENV deliberately
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const app = express();


app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// General limiter: 100 per 15min
const generalApiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});
app.use("/api", generalApiLimiter);

// Stricter limiter for credential endpoints
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});
app.use(["/api/auth/login", "/api/auth/signup"], authLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

const PORT = process.env.PORT || 5000;

let server;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ 🚀  mongodb is running");
    server = app.listen(PORT, () => {
      console.log(`✅ 🌐  Server is running on port ${PORT}`);
      // Start only after DB connects
      startIngestionScheduler();
    });
  })
  .catch((err) => {
    console.error("❌ 🛑 MongoDB connection failed:", err);
    // Exit without database
    process.exit(1);
  });

function shutdown(signal) {
  console.log(`${signal} received — shutting down.`);
  stopIngestionScheduler();
  if (server) {
    // Graceful shutdown on signal
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
