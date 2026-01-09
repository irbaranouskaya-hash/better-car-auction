import mongoose, { Schema, Document } from 'mongoose';

export interface IBidDocument extends Document {
  auctionId: mongoose.Types.ObjectId;
  carId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  isWinning: boolean;
  placedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bidSchema = new Schema({
  auctionId: {
    type: Schema.Types.ObjectId,
    ref: 'Auction',
    required: true,
    index: true
  },
  
  carId: {
    type: Schema.Types.ObjectId,
    ref: 'Car',
    required: true,
    index: true
  },
  
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: [1, 'Bid amount must be at least $1'],
    validate: {
      validator: function(value: number) {
        return value > 0 && Number.isInteger(value);
      },
      message: 'Bid amount must be a positive integer'
    }
  },
  
  isWinning: {
    type: Boolean,
    default: false,
    index: true
  },
  
  placedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

bidSchema.index({ auctionId: 1, carId: 1, amount: -1 });
bidSchema.index({ auctionId: 1, userId: 1 });
bidSchema.index({ carId: 1, amount: -1 });

bidSchema.index(
  { auctionId: 1, carId: 1, userId: 1 }, 
  { unique: true }
); // only one bid per user per car per auction

export default mongoose.model<IBidDocument>('Bid', bidSchema);