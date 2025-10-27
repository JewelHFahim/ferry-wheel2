import mongoose from "mongoose"


export const runMaybeTx = async (fn: any) =>{
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await fn(session);
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally{
        session.endSession();
    }
}