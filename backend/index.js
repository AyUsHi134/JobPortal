import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import jobRoutes from "./routes/job.js";
import userRoutes from "./routes/user.js";

dotenv.config();

const app = express();


app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/user", userRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ 🚀  mongodb is running");
    app.listen(PORT, () => {
      console.log(`✅ 🌐  Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ 🛑 MongoDB connection failed:", err);
  });