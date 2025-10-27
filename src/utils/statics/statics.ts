// Round Boxes
export const boxDatas = [
  { title: "Meat", icon: "🥩", group: "Pizza", multiplier: 45 },
  { title: "Tomato", icon: "🍅", group: "Salad", multiplier: 5 },
  { title: "Corn", icon: "🌽", group: "Salad", multiplier: 5 },
  { title: "Sausage", icon: "🌭", group: "Pizza", multiplier: 10 },
  { title: "Lettuce", icon: "🥬", group: "Salad", multiplier: 5 },
  { title: "Carrot", icon: "🥕", group: "Salad", multiplier: 5 },
  { title: "Skewer", icon: "🍢", group: "Pizza", multiplier: 15 },
  { title: "Ham", icon: "🍗", group: "Pizza", multiplier: 5 },
  { title: "Pizza", icon: "🍕", group: "Pizza", multiplier: 4.37 },
  { title: "Salad", icon: "🥗", group: "Salad", multiplier: 1.25 },
];

// Game Custom Codes
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
  NOT_FOUND = "NOT_FOUND",
}

//Cors Origins
export const origins = [
  "http://localhost:4173",
  "http://localhost:3000",
  "http://192.168.68.111:3000",
  "http://192.168.68.146:3000",
  "http://localhost:5174",
  "https://ferry-wheel-game.vercel.app",
];

// Roles
export enum Roles {
  BOT = "bot",
  USER = "user",
  ADMIN = "admin",
}

// Phase Status
export enum phaseStatus {
  "BETTING" = "betting",
  "REVEAL" = "reveal",
  "PREPARE" = "prepare",
}

export enum transactionType {
  "BET" = "bet",
  "PAYOUT" = "payout",
  "DEPOSITE" = "deposite",
  "WITHDRAW" = "withdraw",
  "RESERVE_DEPOSIT" = "reserveDeposit",
  "RESERVE_WITHDRAW" = "reserveWithdraw",
  "COMPANY_WALLET" = "companyCut",
}
