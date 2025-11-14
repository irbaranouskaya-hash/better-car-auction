import mongoose, { Document, Schema } from 'mongoose';

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

const PRICE_CONFIG = {
  MIN_PRICE_PERCENTAGE: 0.05,

  SIMILAR_YEAR_RANGE: 2,
  SIMILAR_ODOMETER_RANGE: 0.2,
  SIMILAR_CARS_LIMIT: 10,
};


interface ICarDocument extends Document {
  userId: mongoose.Types.ObjectId;
  VIN: string;
  odometerValue: number;
  year: number;
  exteriorColor: string;
  interiorColor: string;
  haveStrongScratches: boolean;
  haveSmallScratches: boolean;
  haveMalfunctions: boolean;
  haveElectricFailures: boolean;
  msrp: number;
  createdAt: Date;
  updatedAt: Date;
  grade: number;
  optimizedPrice: number;
}

const carSchema = new Schema<ICarDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  VIN: {type: String, required: true, unique: true, index: true},
  odometerValue: {type: Number, required: true, index: true},
  year: {type: Number, required: true, index: true},
  exteriorColor: {type: String, required: true, index: true},
  interiorColor: {type: String, required: true},
  haveStrongScratches: {type: Boolean, required: true},
  haveSmallScratches: {type: Boolean, required: true},
  haveMalfunctions: {type: Boolean, required: true},
  haveElectricFailures: {type: Boolean, required: true},
  msrp: {
    type: Number,
    required: true,
    min: [1, 'MSRP must be positive'],
  },
}, {
  timestamps: true
});

carSchema.index({ userId: 1, year: -1 });
carSchema.index({ userId: 1, createdAt: -1 });
carSchema.index({ year: 1, odometerValue: 1 });
carSchema.index({ year: 1, createdAt: -1 });

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

carSchema.virtual("optimizedPrice").get(function() {
  const grade = this.grade;
  const msrp = this.msrp;
  
  const minPrice = msrp * PRICE_CONFIG.MIN_PRICE_PERCENTAGE;
  
  const priceRange = msrp - minPrice;
  const gradeRatio = grade / GRADE_LIMITS.MAX_GRADE;
  let calculatedPrice = minPrice + (priceRange * gradeRatio);
  
  calculatedPrice = Math.max(minPrice, Math.min(calculatedPrice, msrp));
  
  return Math.round(calculatedPrice);
});

carSchema.methods.calculatePriceWithMarket = async function(this: ICarDocument): Promise<number> {
  let calculatedPrice = this.optimizedPrice;
  
  const similarCars = await mongoose.model('Car').find({
    year: { 
      $gte: this.year - PRICE_CONFIG.SIMILAR_YEAR_RANGE,
      $lte: this.year + PRICE_CONFIG.SIMILAR_YEAR_RANGE
    },
    odometerValue: {
      $gte: this.odometerValue * (1 - PRICE_CONFIG.SIMILAR_ODOMETER_RANGE),
      $lte: this.odometerValue * (1 + PRICE_CONFIG.SIMILAR_ODOMETER_RANGE)
    },
    _id: { $ne: this._id }
  })
  .limit(PRICE_CONFIG.SIMILAR_CARS_LIMIT)
  
  console.log(similarCars);
  if (similarCars.length > 0) {
    const avgMarketPrice = similarCars.reduce((sum, car) => sum + car.optimizedPrice, 0) / similarCars.length;
    calculatedPrice = (calculatedPrice + avgMarketPrice) / 2;
  }
  
  return Math.round(calculatedPrice);
};

export default mongoose.model("Car", carSchema);