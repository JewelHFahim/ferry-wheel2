// 1) What you can do with WalletLedger

// User statement (My transactions): show bets, payouts, deposits/withdraws, running balance.

// Round statement: every delta tied to a round (bets, payouts, company cut, reserve moves).

// Daily P&L: total user losses vs payouts, company cut, reserve in/out.

// Company wallet snapshot: current balances, reserve timeline.

// Dispute/audit trail: exact balanceAfter after every operation.

// Anomaly detection: negative balances, duplicate payouts, large deltas.

// 2) Indexes (do this first)
// // In WalletLedger schema
// WalletLedgerSchema.index({ entityTypes: 1, entityId: 1, createdAt: -1 });
// WalletLedgerSchema.index({ roundId: 1, createdAt: -1 });
// WalletLedgerSchema.index({ type: 1, createdAt: -1 });
// WalletLedgerSchema.index({ createdAt: -1 });

// 3) API endpoints (server)
// a) User transaction history (paginated, newest first)
// // GET /api/v1/wallet-ledger/my?cursor=ISO&limit=50
// export async function getMyLedger(req, res) {
//   const userId = req.user?.userId;
//   const limit = Math.min(Number(req.query.limit) || 20, 100);
//   const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

//   const q:any = { entityTypes: "user", entityId: userId };
//   if (cursor) q.createdAt = { $lt: cursor };

//   const rows = await WalletLedger.find(q)
//     .sort({ createdAt: -1 })
//     .limit(limit + 1)
//     .lean();

//   const nextCursor = rows.length > limit ? rows[limit - 1].createdAt : null;
//   const page = rows.slice(0, limit);

//   res.json({ status: true, count: page.length, nextCursor, rows: page });
// }

// b) Round statement (everything that happened in a round)
// // GET /api/v1/wallet-ledger/round/:roundId
// export async function getRoundLedger(req, res) {
//   const { roundId } = req.params;
//   const rows = await WalletLedger.find({ roundId })
//     .sort({ createdAt: 1 })
//     .lean();
//   res.json({ status: true, count: rows.length, rows });
// }

// c) Daily P&L summary (admin)
// // GET /api/v1/wallet-ledger/admin/daily-pnl?from=2025-10-01&to=2025-10-30
// export async function getDailyPnL(req, res) {
//   const from = new Date(req.query.from);
//   const to = new Date(req.query.to);

//   const rows = await WalletLedger.aggregate([
//     { $match: { createdAt: { $gte: from, $lt: to } } },
//     { $addFields: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } } },
//     {
//       $group: {
//         _id: "$day",
//         // Bets are negative for users
//         totalBets: { $sum: { $cond: [{ $eq: ["$type", "BET"] }, "$delta", 0] } },
//         totalPayouts: { $sum: { $cond: [{ $eq: ["$type", "PAYOUT"] }, "$delta", 0] } },
//         companyCut: { $sum: { $cond: [{ $eq: ["$type", "COMPANY_CUT"] }, "$delta", 0] } },
//         reserveIn: { $sum: { $cond: [{ $eq: ["$type", "RESERVE_DEPOSIT"] }, "$delta", 0] } },
//         reserveOut: { $sum: { $cond: [{ $eq: ["$type", "RESERVE_WITHDRAW"] }, "$delta", 0] } },
//       }
//     },
//     { $sort: { _id: 1 } }
//   ]);

//   res.json({ status: true, days: rows });
// }

// d) Company reserve timeline
// // GET /api/v1/wallet-ledger/admin/reserve-timeline?days=14
// export async function getReserveTimeline(req, res) {
//   const days = Math.min(Number(req.query.days) || 14, 90);
//   const since = new Date(Date.now() - days*24*60*60*1000);

//   const rows = await WalletLedger.aggregate([
//     { $match: { entityTypes: "company", type: { $in: ["RESERVE_DEPOSIT", "RESERVE_WITHDRAW"] }, createdAt: { $gte: since } } },
//     { $sort: { createdAt: 1 } },
//     {
//       $project: {
//         createdAt: 1,
//         delta: 1,
//         balanceAfter: 1,
//         type: 1,
//         roundId: 1,
//       }
//     }
//   ]);

//   res.json({ status: true, rows });
// }

// e) Reconciliation check per round (sanity)
// // GET /api/v1/wallet-ledger/admin/reconcile/:roundId
// export async function reconcileRound(req, res) {
//   const { roundId } = req.params;
//   const rows = await WalletLedger.aggregate([
//     { $match: { roundId } },
//     {
//       $group: {
//         _id: "$type",
//         total: { $sum: "$delta" },
//         count: { $sum: 1 }
//       }
//     }
//   ]);

//   // Quick invariants (interpret delta signs according to your model):
//   // sum(BET) + sum(PAYOUT) + sum(COMPANY_CUT) + sum(RESERVE_DEPOSIT) + sum(RESERVE_WITHDRAW) ~ 0 (depending on flows)
//   res.json({ status: true, roundId, byType: rows });
// }

// 4) UI uses
// a) “My Transactions” table

// Fields: createdAt, type (BET/PAYOUT/…), roundNumber, box (if payout), delta, balanceAfter.

// Add a filter by type and date, and a Load more using nextCursor.

// Running balance is already available via balanceAfter—no client math needed.

// b) “Round Statement” modal (from round history or admin screen)

// Show a compact ledger list + subtotals by type.

// Quick insights: total bets, total payouts, company cut, reserve in/out for that round.

// c) Admin Dashboard widgets

// Today: total bets, payouts, company cut, net (bets + payouts + cut).

// Reserve balance chart: plot balanceAfter on each reserve movement.

// Suspicious: users with >N payouts in M minutes, or deltas exceeding thresholds.

// 5) Helpful aggregations you’ll likely reuse
// User net over a window
// // net = sum(user deltas)
// await WalletLedger.aggregate([
//   { $match: { entityTypes: "user", entityId: userId, createdAt: { $gte: from, $lt: to } } },
//   { $group: { _id: "$entityId", net: { $sum: "$delta" } } }
// ]);

// Top earners (payouts) today
// await WalletLedger.aggregate([
//   { $match: { type: "PAYOUT", createdAt: { $gte: new Date(new Date().toDateString()) } } },
//   { $group: { _id: "$entityId", totalWon: { $sum: "$delta" } } },
//   { $sort: { totalWon: -1 } },
//   { $limit: 10 }
// ]);

// Most loss (bets) today
// await WalletLedger.aggregate([
//   { $match: { type: "BET", createdAt: { $gte: new Date(new Date().toDateString()) } } },
//   { $group: { _id: "$entityId", totalBet: { $sum: "$delta" } } }, // delta is negative
//   { $sort: { totalBet: 1 } }, // most negative first
//   { $limit: 10 }
// ]);

// 6) Small gotchas / best practices

// Always write balanceAfter for user entries (you already do). It makes disputes trivial.

// For company entries, if you don’t store a running “main balance”, set balanceAfter to the reserve balance for reserve rows, and keep a separate field in metaData when the balance refers to reserve vs main treasury.

// Keep roundId on every round-related ledger row. For pure deposits/withdrawals, leave it null or attach an admin operation id.

// Prefer append-only ledger. If you must correct, add an ADJUSTMENT row instead of editing old rows.