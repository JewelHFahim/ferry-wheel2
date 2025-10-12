import { Request, Response } from "express";
import { MetModel } from "./met.model";



// Function for met services
export const handleGetMetService = async (req: Request, res: Response) => {
    try {
        const metServices = await MetModel.find();
        if(!metServices){
            return res.status(401).json({ status: false, message: "Something went wrong, try again later"})
        }
        return res.status(200).json({status: true, message: "Met services retrive success", metServices})
    
    } catch (error) {
        console.log("Failed to retrive met services", error);
        return res.status(500).json({ status: false, message: "Internal server error", error })
    }
}
