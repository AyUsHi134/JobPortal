import 'dotenv/config';
import express  from 'express';
import mongoose from 'mongoose';
import cors     from 'cors';

import authRoutes from './routes/auth.js';
import jobRoutes  from './routes/jobs.js';

const app = express();
app.use(cors(), express.json());

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ MongoDB connected');
    app.listen(process.env.PORT, () =>
      console.log(`🚀 Server running on port ${process.env.PORT}`)
    );
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}
start();
