import mongoose, { Schema } from 'mongoose';

const GRADE_LIMITS = {
  EXTREME_MILEAGE_THRESHOLD: 300000,
  EXTREME_MILEAGE_MAX_GRADE: 30,
  MAX_GRADE: 50
};

const CONDITION_PENALTIES = {
  STRONG_SCRATCHES: 1.08,
  SMALL_SCRATCHES: 1.04,
  MALFUNCTIONS: 1.04,
  ELECTRIC_FAILURES: 1.08
};

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
  haveStrongScratches: {type: Boolean, required: true},
  haveSmallScratches: {type: Boolean, required: true},
  haveMalfunctions: {type: Boolean, required: true},
  haveElectricFailures: {type: Boolean, required: true},
}, {
  timestamps: true
});

carSchema.virtual("grade").get(function() {
  let grade = GRADE_LIMITS.MAX_GRADE;
  
  if (this.haveStrongScratches) grade /= CONDITION_PENALTIES.STRONG_SCRATCHES;
  if(this.haveSmallScratches) grade /= CONDITION_PENALTIES.SMALL_SCRATCHES;
  if(this.haveMalfunctions) grade /= CONDITION_PENALTIES.MALFUNCTIONS;
  if(this.haveElectricFailures) grade /= CONDITION_PENALTIES.ELECTRIC_FAILURES;

  grade -= (new Date().getFullYear() - this.year);

  if (this.odometerValue > GRADE_LIMITS.EXTREME_MILEAGE_THRESHOLD) {
    grade = Math.min(grade, GRADE_LIMITS.EXTREME_MILEAGE_MAX_GRADE);
  }

  return grade; // should i round it?
});

export default mongoose.model("Car", carSchema);