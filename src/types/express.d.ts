import { IUser } from "../modules/user/user.model";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
