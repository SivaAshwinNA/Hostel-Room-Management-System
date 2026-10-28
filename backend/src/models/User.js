import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 name:{type:String,required:true,trim:true,maxlength:100},
 email:{type:String,required:true,unique:true,lowercase:true,trim:true},
 studentId:{type:String,trim:true,sparse:true,unique:true},
 passwordHash:{type:String,required:true,select:false},
 role:{type:String,enum:['admin','student'],default:'student',required:true}
},{timestamps:true});
export default mongoose.model('User',schema);
