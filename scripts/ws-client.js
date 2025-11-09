// scripts/ws-client.js
// Run: node scripts/ws-client.js [<WS_URL>]
// Example: node scripts/ws-client.js http://localhost:3000
// If no URL provided, defaults to http://localhost:3000

const { io } = require("socket.io-client");

const url = process.argv[2] || "http://localhost:3000";
const namespace = "/discover";
const fullUrl = `${url}${namespace}`;

console.log(`Connecting to ${fullUrl} ...`);

const socket = io(fullUrl, {
  transports: ["websocket"],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

let updates = 0;
let spikes = 0;
let firstSeen = Date.now();

socket.on("connect", () => {
  console.log(`✅ connected -> id=${socket.id}`);
  // optional: you can send subscribe payload if your server uses it
  socket.emit("subscribe", { interval: "live", filters: {} });
});

socket.on("token_update", (data) => {
  updates++;
  console.log(`[update] ${new Date().toISOString()} ${data.token_ticker || ""} ${data.token_address} price=${data.price_sol} vol=${data.volume_sol}`);
});

socket.on("volume_spike", (data) => {
  spikes++;
  console.log(`\x1b[33m[spike]\x1b[0m ${new Date().toISOString()} ${data.token_address} delta=${data.delta} volume=${data.volume_sol}`);
});

socket.on("connect_error", (err) => {
  console.error("connect_error", err && err.message ? err.message : err);
});

socket.on("disconnect", (reason) => {
  console.log("disconnected:", reason);
});

process.on("SIGINT", () => {
  console.log("\nGraceful shutdown...");
  const elapsedSec = Math.round((Date.now() - firstSeen) / 1000);
  console.log(`Stats: updates=${updates}, spikes=${spikes}, elapsed=${elapsedSec}s`);
  socket.close();
  process.exit(0);
});

// print a periodic summary
setInterval(() => {
  const elapsedSec = Math.round((Date.now() - firstSeen) / 1000);
  console.log(`SUMMARY (elapsed ${elapsedSec}s): updates=${updates}, spikes=${spikes}`);
}, 30_000);
