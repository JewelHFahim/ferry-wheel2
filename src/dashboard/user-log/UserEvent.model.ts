import mongoose, { Schema, Types } from "mongoose";

export interface UserBetsType {
  box: string;
  boxTotal: number;
}

export interface IUserEvent {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  roundId: Types.ObjectId;
  userId: Types.ObjectId;
  userName: string;
  gameName: string;
  identification: string;
  userConsumption: number;
  userRewardAmount: number;
  userBetHistory: UserBetsType[];
  winnerBox: string;
  date: Date;
}

const UserBetHistorySchema = new Schema<UserBetsType>({
  box: { type: String, required: true },
  boxTotal: { type: Number, required: true, default: 0 },
}, { _id: false });

const UserEventSchema = new Schema<IUserEvent>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    gameId: { type: Schema.Types.ObjectId, required: true, index: true },
    roundId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    userName: { type: String, required: true, index: true },
    gameName: { type: String, required: true, index: true },
    identification: { type: String, required: true },
    userConsumption: { type: Number, required: true, default: 0 },
    userRewardAmount: { type: Number, required: true, default: 0 },
    userBetHistory: { type: [UserBetHistorySchema], default: [] },
    winnerBox: { type: String, required: true },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: "user_events" }
);

// Idempotency + speed
UserEventSchema.index({ roundId: 1, userId: 1 }, { unique: true });
UserEventSchema.index({ gameId: 1, date: -1 });
UserEventSchema.index({ userId: 1, date: -1 });
UserEventSchema.index({ date: -1 });
UserEventSchema.index({ roundId: 1 });
UserEventSchema.index({ userName: 1 });
UserEventSchema.index({ identification: 1 });


export const UserEvent =
  mongoose.models.UserEvent || mongoose.model<IUserEvent>("UserEvent", UserEventSchema);
