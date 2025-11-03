import mongoose, { Schema, Types } from "mongoose";

export interface UserBetsType {
  box: string;
  boxTotal: number;
}

export interface IUserEvent {
  _id: Types.ObjectId;
  gameId: Types.ObjectId;
  userName: string;
  identification: string;
  userConsumption: number;
  userRewardAmount: number;
  platformRevenue: number;
  platformReserve: number;
  userVictoryResult: UserBetsType[];
  winnerBox: string;
  date: Date;
}

const UserEventSchema = new Schema<IUserEvent>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    gameId: { type: Schema.Types.ObjectId, required: true, index: true },
    userName: { type: String, required: true },
    identification: { type: String, required: true },
    userConsumption: { type: Number, required: true, default: 0 },
    userRewardAmount: { type: Number, required: true, default: 0 },
    platformRevenue: { type: Number, required: true, default: 0 },
    platformReserve: { type: Number, required: true, default: 0 },
    userVictoryResult: [
      {
        box: { type: String },
        boxTotal: { type: Number },
      },
    ],
    winnerBox:{ type: String, required: true },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true, versionKey: false, collection: "user_events" }
);

// fast queries by (gameId, date)
UserEventSchema.index({ gameId: 1, date: -1 });
UserEventSchema.index({ date: -1 });

export const UserEvent = mongoose.models.UserEvent || mongoose.model<IUserEvent>("UserEvent", UserEventSchema);
