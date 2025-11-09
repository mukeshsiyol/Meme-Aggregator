# Meme-Aggregator


Realtime meme-coin data aggregator (Node.js + TypeScript). Aggregates data from multiple DEX APIs, caches results in Redis, and emits real-time updates via Socket.io.


## Quick start (local)


Requirements: Node 20+, Docker (for Redis) or a running Redis instance.


1. Copy `.env.example` to `.env` and adjust if needed.
2. Run Redis + app with Docker Compose:


```bash
docker-compose up --build
