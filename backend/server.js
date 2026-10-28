import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './src/routes/auth.js';
import roomRoutes from './src/routes/rooms.js';
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.get('/api/health', (_req,res)=>res.json({status:'ok'}));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use((err,_req,res,_next)=>{ console.error(err); res.status(500).json({message:'Server error'}); });
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hostel_room_management')
 .then(()=>{ console.log('Connected to MongoDB'); app.listen(process.env.PORT||5000,()=>console.log('API listening on port '+(process.env.PORT||5000))); })
 .catch(e=>{ console.error('MongoDB connection failed:',e.message); process.exit(1); });
