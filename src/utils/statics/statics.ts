export const boxDatas = [
  { title: "Meat", icon: "🥩", group: "Pizza", multiplier: 45 },
  { title: "Tomato", icon: "🍅", group: "Salad", multiplier: 5 },
  { title: "Corn", icon: "🌽", group: "Salad", multiplier: 5 },
  { title: "Sausage", icon: "🌭", group: "Pizza", multiplier: 10 },
  { title: "Lettuce", icon: "🥬", group: "Salad", multiplier: 5 },
  { title: "Carrot", icon: "🥕", group: "Salad", multiplier: 5 },
  { title: "Skewer", icon: "🍢", group: "Pizza", multiplier: 15 },
  { title: "Ham", icon: "🍗", group: "Pizza", multiplier: 5 },
  { title: "Pizza", icon: "🍕", multiplier: 4.37 },
  { title: "Salad", icon: "🥗", multiplier: 1.25 },
];

export enum gameCodes {
  AUTH_REQUIRED = "AUTH_REQUIRED",

  BETTING_CLOSED = "BETTING_CLOSED",
  BET_NOT_PLACED = "BET_NOT_PLACED",

  INTERNAL = "INTERNAL",
  INVALID_BOX = "INVALID_BOX",
  INVALID_ROUND = "INVALID_ROUND",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  INVALID_BET_AMOUNT = "INVALID_BET_AMOUNT",

  NO_WINNER = "NO_WINNER",
}

export const origins = [
  "http://192.168.1.100:3000",
  "http://192.168.68.121:3000",
  "http://192.168.1.122:3000",
  "http://192.168.68.125:5174",
  "http://localhost:3000",
  "http://localhost:5174",
  "http://192.168.68.130:3000",
];


export enum Roles {
  BOT = "bot",
  USER = "user",
  ADMIN = "admin",
}