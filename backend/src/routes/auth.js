import {Router} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {body,validationResult} from 'express-validator';
import User from '../models/User.js';
import {requireAuth} from '../middleware/auth.js';
const router=Router();
const safe=u=>({id:u._id,name:u.name,email:u.email,role:u.role,studentId:u.studentId||''});
const token=u=>jwt.sign({sub:u._id.toString()},process.env.JWT_SECRET||'dev_only_change_me',{expiresIn:process.env.JWT_EXPIRES_IN||'1d'});
router.post('/register',[body('name').trim().isLength({min:2,max:100}),body('email').isEmail().normalizeEmail(),body('password').isLength({min:8}),body('role').isIn(['admin','student'])],async(req,res)=>{
 const v=validationResult(req);if(!v.isEmpty())return res.status(400).json({message:'Enter valid details; password must be at least 8 characters.'});
 try{
  const {name,email,password,role}=req.body;const studentId=(req.body.studentId||'').trim();
  if(role==='admin'&&process.env.ALLOW_ADMIN_SIGNUP==='false')return res.status(403).json({message:'Admin sign-up is disabled.'});
  if(await User.findOne({$or:[{email},...(studentId?[{studentId}]:[])]}))return res.status(409).json({message:'Email or student ID already registered.'});
  const u=await User.create({name,email,passwordHash:await bcrypt.hash(password,12),role,studentId:studentId||undefined});
  res.status(201).json({token:token(u),user:safe(u)});
 }catch(e){res.status(500).json({message:'Could not create account.'});}
});
router.post('/login',[body('email').isEmail().normalizeEmail(),body('password').notEmpty()],async(req,res)=>{
 const v=validationResult(req);if(!v.isEmpty())return res.status(400).json({message:'Enter a valid email and password.'});
 const u=await User.findOne({email:req.body.email}).select('+passwordHash');
 if(!u||!await bcrypt.compare(req.body.password,u.passwordHash))return res.status(401).json({message:'Incorrect email or password.'});
 res.json({token:token(u),user:safe(u)});
});
router.get('/me',requireAuth,(req,res)=>res.json({user:safe(req.user)}));
export default router;
