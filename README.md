ferry-wheel-backend/
│── src/
│   │── app.ts                 # Express app setup (middleware, routes)
│   │── server.ts              # Entry point (start server + socket)
│   │
│   ├── config/                # Environment, constants, global configs
│   │   ├── index.ts           # Load env variables, configs
│   │   ├── db.ts              # MongoDB connection
│   │   ├── redis.ts           # Redis connection
│   │   └── socket.ts          # Socket.IO server setup
│   │
│   ├── modules/               # Feature-based modules
│   │   ├── user/              # User domain
│   │   │   ├── user.model.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.controller.ts
│   │   │   └── user.types.ts
│   │   │
│   │   ├── round/             # Game round domain
│   │   │   ├── round.model.ts
│   │   │   ├── round.service.ts
│   │   │   ├── round.controller.ts
│   │   │   └── round.types.ts
│   │   │
│   │   ├── bet/               # Bet domain
│   │   │   ├── bet.model.ts
│   │   │   ├── bet.service.ts
│   │   │   ├── bet.controller.ts
│   │   │   └── bet.types.ts
│   │   │
│   │   ├── wallet/            # Wallet, transactions, payouts
│   │   │   ├── wallet.model.ts
│   │   │   ├── wallet.service.ts
│   │   │   └── wallet.controller.ts
│   │   │
│   │   └── admin/             # Admin APIs & logic
│   │       ├── admin.controller.ts
│   │       ├── admin.service.ts
│   │       └── admin.types.ts
│   │
│   ├── sockets/               # Real-time socket events
│   │   ├── game.socket.ts     # Events for game (join, bet, results)
│   │   ├── round.socket.ts    # Round lifecycle events
│   │   └── index.ts           # Aggregate socket handlers
│   │
│   ├── jobs/                  # Background workers / schedulers
│   │   ├── roundEngine.job.ts # Handles round start/end
│   │   ├── payout.job.ts      # Distributes winnings
│   │   └── reconcile.job.ts   # Sync balances with hosted app
│   │
│   ├── utils/                 # Helpers & utilities
│   │   ├── logger.ts
│   │   ├── errorHandler.ts
│   │   ├── response.ts
│   │   └── validators.ts
│   │
│   ├── middlewares/           # Express middlewares
│   │   ├── auth.middleware.ts # Verify hosted token
│   │   └── error.middleware.ts
│   │
│   └── types/                 # Global shared types
│       ├── index.d.ts
│       └── socket.d.ts
│
│── tests/                     # Unit & integration tests
│   ├── user.test.ts
│   ├── round.test.ts
│   ├── bet.test.ts
│   └── payout.test.ts
│
│── .env.example               # Example env variables
│── docker-compose.yml         # Local dev with Redis & Mongo
│── Dockerfile                 # App container
│── package.json
│── tsconfig.json
│── README.md
