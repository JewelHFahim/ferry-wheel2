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

  INVALID_BOX = "INVALID_BOX",
  INVALID_ROUND = "INVALID_ROUND",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",

  NO_WINNER = "NO_WINNER",

  // Add more error codes as needed...
}
