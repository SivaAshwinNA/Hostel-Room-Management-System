import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function requireAuth(req,res,next){
 try{
  const h=req.headers.authorization||''; const token=h.startsWith('Bearer ')?h.slice(7):null;
  if(!token)return res.status(401).json({message:'Please sign in.'});
  const p=jwt.verify(token,process.env.JWT_SECRET||'dev_only_change_me');
  const user=await User.findById(p.sub); if(!user)return res.status(401).json({message:'Account not found.'});
  req.user=user; next();
 }catch{return res.status(401).json({message:'Session expired. Please sign in again.'});}
}
export function requireRole(...roles){return(req,res,next)=>req.user&&roles.includes(req.user.role)?next():res.status(403).json({message:'Administrator access required.'});}
