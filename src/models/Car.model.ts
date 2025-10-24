import mongoose, { Schema } from 'mongoose';

const carSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  VIN: {type: String, required: true, unique: true},
  odometerValue: {type: Number, required: true},
  year: {type: Number, required: true},
  exteriorColor: {type: String, required: true},
  interiorColor: {type: String, required: true},
  haveScratches: {type: Boolean, required: true},
  haveMalfunctions: {type: Boolean, required: true},
  haveElectricFailures: {type: Boolean, required: true},
}, {
  timestamps: true
});

export default mongoose.model("Car", carSchema);