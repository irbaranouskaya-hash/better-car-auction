import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin'
}

const userSchema = new Schema({
  name: {type: String, required: true, trim: true, minlength: 3, maxlength: 50},
  email: {type: String, required: true, unique: true, trim: true, lowercase: true},
  password: {type: String, required: true, minlength: 8},
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
  }
}, {timestamps: true});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isAdmin = function(): boolean {
  return this.role === UserRole.ADMIN;
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model("User", userSchema);