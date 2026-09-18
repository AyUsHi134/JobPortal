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

// Express reads process.env.NODE_ENV once, at app construction, into its
// own app.get('env') setting — which its built-in default error handler
// (no custom error-handling middleware exists in this app) uses to decide
// whether an error response includes a stack trace. Defaulted here
// (without overriding an already-set value from the real environment or
// .env) so that behavior is always deliberate rather than left to
// whatever fallback Express happens to apply internally.
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

// General limiter: 100 requests/15min per IP, applied to every /api route.
// `skip` mirrors authLimiter's own below — a complete no-op outside
// production, so local development/testing is never blocked by it, while
// production keeps the exact same 100/15min ceiling.
const generalApiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== "production",
});
app.use("/api", generalApiLimiter);

// Stricter limiter for the two credential endpoints — brute-force/
// credential-stuffing protection on top of the general limiter above.
// `skip` makes this a complete no-op outside production (no counting, no
// blocking at all), so local development/testing is never affected by it.
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
      // Only started after MongoDB is connected AND the HTTP server is
      // listening, so a failed/pending Mongo connection can never leave
      // the scheduler fetching and attempting persistence on its own.
      startIngestionScheduler();
    });
  })
  .catch((err) => {
    console.error("❌ 🛑 MongoDB connection failed:", err);
    // Without a database this process can serve nothing real — exiting
    // gives a process manager/deploy pipeline a clear failure signal,
    // instead of a process that stays alive without ever calling
    // app.listen().
    process.exit(1);
  });

function shutdown(signal) {
  console.log(`${signal} received — shutting down.`);
  stopIngestionScheduler();
  if (server) {
    // Stops accepting new connections and waits for in-flight requests to
    // finish before exiting, so a redeploy/restart never cuts one off
    // mid-response. `server` is only ever set once app.listen() has
    // actually succeeded above — if a shutdown signal arrives before that
    // (e.g. still waiting on the Mongo connection), there is no server to
    // close, so this exits immediately instead of hanging.
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
