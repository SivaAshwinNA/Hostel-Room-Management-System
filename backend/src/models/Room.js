import mongoose from 'mongoose';

const occupantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },
    studentId: { type: String, default: '' },
    email: { type: String, required: true }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    roomType: { type: String, required: true, trim: true },
    // Optional: no automatic AC/Non-AC selection.
    acType: { type: String, enum: ['AC', 'Non-AC'], default: undefined },
    capacity: { type: Number, required: true, min: 1, max: 100 },
    occupants: { type: [occupantSchema], default: [] },
    availabilityStatus: {
      type: String,
      enum: ['Available', 'Full'],
      default: 'Available'
    }
  },
  { timestamps: true }
);

schema.pre('save', function (next) {
  this.availabilityStatus =
    this.occupants.length >= this.capacity ? 'Full' : 'Available';
  next();
});

export default mongoose.model('Room', schema);
