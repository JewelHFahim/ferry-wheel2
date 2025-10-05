import "socket.io";

declare module "socket.io" {
  interface Socket {
    data: {
      user?: { _id: string; role: string };
      [key: string]: any;
    };
  }
}
