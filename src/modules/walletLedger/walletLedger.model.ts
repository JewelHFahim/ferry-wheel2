import mongoose, { Schema, Types } from "mongoose";


export interface IWalletLedger{
    entityTypes: "user" | "company";
    entityId: Types.ObjectId;
    roundId?: Types.ObjectId;
    betId: Types.ObjectId;
    type: "bet" | "payout" | "deposite" | "withdraw" | "reserveDeposit" | "reserveWithdraw" | "companyCut";
    delta: number;       // positive or negative (smallest unit)
    balanceAfter?: number;
    metaData?:  any;
    createdAt: Date
}


const WalletLedgerSchema = new Schema<IWalletLedger>(
    {
        entityTypes: { type: String, required: true },
        entityId: { type: Schema.Types.Mixed, required: true },
        roundId: { type: Schema.Types.ObjectId, ref: "Round" },
        betId: { type: Schema.Types.ObjectId, ref: "Bet" },
        type: { type: String, required: true },
        delta: { type: Number, required: true },
        balanceAfter: { type: Number },
        metaData: { type: Schema.Types.Mixed }
    },
    {
        timestamps: true
    }
);

WalletLedgerSchema.index({ entityTypes: 1, entityId: 1, createdAt: -1 });
WalletLedgerSchema.index({ roundId: 1 });
WalletLedgerSchema.index({ type: 1, createdAt: -1 });

const WalletLedger = mongoose.model<IWalletLedger>("WalletLedger", WalletLedgerSchema);
export default WalletLedger;