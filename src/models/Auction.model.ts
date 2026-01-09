import mongoose, { Schema, Document } from 'mongoose';

export interface IAuctionDocument extends Document {
  name: string;
  startDate: Date;
  endDate: Date;
  createdBy: mongoose.Types.ObjectId;
  cars: mongoose.Types.ObjectId[];
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;

  status: 'upcoming' | 'active' | 'ended' | 'closed';
  durationHours: number;
  timeUntilStart: number;

  isCurrentlyActive(): boolean;
  canBeEdited(): boolean;
}

interface IAuctionModel extends mongoose.Model<IAuctionDocument> {
  findOverlapping(startDate: Date, endDate: Date, excludeId?: mongoose.Types.ObjectId): Promise<IAuctionDocument | null>;
}

const auctionSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Auction name is required'],
    trim: true,
    minlength: [3, 'Auction name must be at least 3 characters'],
    maxlength: [100, 'Auction name must not exceed 100 characters'],
    index: true
  },
  
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    index: true,
    validate: {
      validator: function(value: Date) {
        if (this.isNew) {
          return value >= new Date();
        }
        return true;
      },
      message: 'Start date cannot be in the past'
    }
  },
  
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    index: true,
    validate: {
      validator: function(this: IAuctionDocument, value: Date) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  cars: [{
    type: Schema.Types.ObjectId,
    ref: 'Car'
  }],
  
  isClosed: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

auctionSchema.index({ startDate: 1, endDate: 1 });
auctionSchema.index({ isClosed: 1, endDate: 1 });
auctionSchema.index({ createdBy: 1, createdAt: -1 });

auctionSchema.virtual('status').get(function(this: IAuctionDocument) {
  if (this.isClosed) {
    return 'closed';
  }
  
  const now = new Date();
  
  if (now < this.startDate) {
    return 'upcoming';
  } else if (now >= this.startDate && now <= this.endDate) {
    return 'active';
  } else {
    return 'ended';
  }
});

auctionSchema.virtual('durationHours').get(function(this: IAuctionDocument) {
  const diff = this.endDate.getTime() - this.startDate.getTime();
  return Math.round(diff / (1000 * 60 * 60));
});

auctionSchema.virtual('timeUntilStart').get(function(this: IAuctionDocument) {
  const now = new Date();
  if (now >= this.startDate) return 0;
  
  const diff = this.startDate.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60));
});

auctionSchema.methods.isCurrentlyActive = function(this: IAuctionDocument): boolean {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
};

auctionSchema.methods.canBeEdited = function(this: IAuctionDocument): boolean {
  return new Date() < this.startDate;
};

auctionSchema.statics.findOverlapping = function(
  startDate: Date, 
  endDate: Date, 
  excludeId?: mongoose.Types.ObjectId
) {
  const query: any = {
    $or: [
      {
        startDate: { $lte: startDate },
        endDate: { $gte: startDate }
      },
      {
        startDate: { $lte: endDate },
        endDate: { $gte: endDate }
      },
      {
        startDate: { $gte: startDate },
        endDate: { $lte: endDate }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.findOne(query);
};

export default mongoose.model<IAuctionDocument, IAuctionModel>('Auction', auctionSchema);