const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "rooms.json");
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS || 1000 * 60 * 60 * 24);
const serverStartedAt = Date.now();

const COLORS = ["#e84a5f", "#ff9f1c", "#2ec4b6", "#3a86ff", "#8338ec", "#06d6a0", "#f15bb5", "#ffd166"];
const TOKENS = ["bolt", "rocket", "gem", "crown", "leaf", "anchor", "star", "moon"];
const STARTING_CASH = 1500;
const PASS_GO = 200;

const BOARD = [
  { name: "Launch Square", type: "go" },
  { name: "Lisbon", type: "property", group: "Brown", price: 60, rent: [8, 16, 24, 32, 40, 48], houseCost: 50 },
  { name: "Community Fund", type: "card", deck: "community" },
  { name: "Porto", type: "property", group: "Brown", price: 60, rent: [9, 18, 27, 36, 45, 54], houseCost: 50 },
  { name: "City Tax", type: "tax", amount: 200 },
  { name: "Heathrow Airport", type: "rail", group: "Transit", price: 200, rent: [25, 50, 100, 200] },
  { name: "Austin", type: "property", group: "Cyan", price: 100, rent: [12, 24, 36, 48, 60, 72], houseCost: 50 },
  { name: "Market News", type: "card", deck: "chance" },
  { name: "Denver", type: "property", group: "Cyan", price: 100, rent: [13, 26, 39, 52, 65, 78], houseCost: 50 },
  { name: "Seattle", type: "property", group: "Cyan", price: 120, rent: [15, 30, 45, 60, 75, 90], houseCost: 50 },
  { name: "Jail", type: "jail" },
  { name: "Portland", type: "property", group: "Pink", price: 140, rent: [18, 36, 54, 72, 90, 108], houseCost: 100 },
  { name: "Electric Supply", type: "utility", group: "Utility", price: 150 },
  { name: "Phoenix", type: "property", group: "Pink", price: 140, rent: [19, 38, 57, 76, 95, 114], houseCost: 100 },
  { name: "San Diego", type: "property", group: "Pink", price: 160, rent: [22, 44, 66, 88, 110, 132], houseCost: 100 },
  { name: "Changi Airport", type: "rail", group: "Transit", price: 200, rent: [25, 50, 100, 200] },
  { name: "Toronto", type: "property", group: "Orange", price: 180, rent: [24, 48, 72, 96, 120, 144], houseCost: 100 },
  { name: "Community Fund", type: "card", deck: "community" },
  { name: "Montreal", type: "property", group: "Orange", price: 180, rent: [25, 50, 75, 100, 125, 150], houseCost: 100 },
  { name: "Chicago", type: "property", group: "Orange", price: 200, rent: [30, 60, 90, 120, 150, 180], houseCost: 100 },
  { name: "Vacation", type: "parking" },
  { name: "Dallas", type: "property", group: "Red", price: 220, rent: [30, 60, 90, 120, 150, 180], houseCost: 150 },
  { name: "Market News", type: "card", deck: "chance" },
  { name: "Atlanta", type: "property", group: "Red", price: 220, rent: [31, 62, 93, 124, 155, 186], houseCost: 150 },
  { name: "Miami", type: "property", group: "Red", price: 240, rent: [36, 72, 108, 144, 180, 216], houseCost: 150 },
  { name: "Dubai Airport", type: "rail", group: "Transit", price: 200, rent: [25, 50, 100, 200] },
  { name: "Singapore", type: "property", group: "Yellow", price: 260, rent: [34, 68, 102, 136, 170, 204], houseCost: 150 },
  { name: "Seoul", type: "property", group: "Yellow", price: 260, rent: [36, 72, 108, 144, 180, 216], houseCost: 150 },
  { name: "Water Supply", type: "utility", group: "Utility", price: 150 },
  { name: "Tokyo", type: "property", group: "Yellow", price: 280, rent: [40, 80, 120, 160, 200, 240], houseCost: 150 },
  { name: "Go To Jail", type: "goToJail" },
  { name: "Sydney", type: "property", group: "Green", price: 300, rent: [42, 84, 126, 168, 210, 252], houseCost: 200 },
  { name: "London", type: "property", group: "Green", price: 300, rent: [45, 90, 135, 180, 225, 270], houseCost: 200 },
  { name: "Community Fund", type: "card", deck: "community" },
  { name: "Paris", type: "property", group: "Green", price: 320, rent: [48, 96, 144, 192, 240, 288], houseCost: 200 },
  { name: "JFK Airport", type: "rail", group: "Transit", price: 200, rent: [25, 50, 100, 200] },
  { name: "Market News", type: "card", deck: "chance" },
  { name: "New York", type: "property", group: "Blue", price: 350, rent: [50, 100, 150, 200, 250, 300], houseCost: 200 },
  { name: "Luxury Tax", type: "tax", amount: 100 },
  { name: "Mumbai", type: "property", group: "Blue", price: 400, rent: [60, 120, 180, 240, 300, 360], houseCost: 200 }
].map((tile, index) => ({ ...tile, id: index }));

const GROUP_COLORS = {
  Brown: "#8d5524",
  Cyan: "#2ec4b6",
  Pink: "#f15bb5",
  Orange: "#ff9f1c",
  Red: "#e84a5f",
  Yellow: "#ffd166",
  Green: "#06d6a0",
  Blue: "#3a86ff",
  Transit: "#3d405b",
  Utility: "#7a6c5d"
};

const CHANCE = [
  { text: "Launch a pop-up shop. Collect $100.", money: 100 },
  { text: "Consulting sprint went long. Pay $75.", money: -75 },
  { text: "Move to Tokyo.", moveTo: 29 },
  { text: "Advance to Launch Square.", moveTo: 0 },
  { text: "Speeding through transit. Pay $50.", money: -50 },
  { text: "Investors love the pitch. Collect $150.", money: 150 },
  { text: "Go directly to Jail.", jail: true },
  { text: "Move back three spaces.", moveBy: -3 }
];

const COMMUNITY = [
  { text: "Neighborhood grant. Collect $50.", money: 50 },
  { text: "Street repairs. Pay $40 per building.", perBuilding: -40 },
  { text: "Birthday dividends. Collect $10 from each rival.", collectFromEach: 10 },
  { text: "Medical bill. Pay $100.", money: -100 },
  { text: "Side hustle paid off. Collect $75.", money: 75 },
  { text: "Charity event. Pay $50.", money: -50 },
  { text: "Get out of Jail pass.", jailCard: true },
  { text: "Advance to Heathrow Airport.", moveTo: 5 }
];

const rooms = new Map();
const clients = new Map();

function id(prefix = "") {
  return prefix + crypto.randomBytes(4).toString("hex");
}

function cleanText(value, fallback, maxLength) {
  const text = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return text || fallback;
}

function roomClientCount(roomId) {
  return clients.get(roomId)?.size || 0;
}

function persistRooms() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const payload = JSON.stringify({
    savedAt: Date.now(),
    rooms: Array.from(rooms.values())
  }, null, 2);
  fs.writeFileSync(`${DATA_FILE}.tmp`, payload);
  fs.renameSync(`${DATA_FILE}.tmp`, DATA_FILE);
}

function schedulePersist() {
  clearTimeout(schedulePersist.timer);
  schedulePersist.timer = setTimeout(() => {
    try {
      persistRooms();
    } catch (error) {
      console.error("Failed to persist rooms:", error);
    }
  }, 150);
}

function loadRooms() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const room of data.rooms || []) {
      if (!room.id || !room.players || !room.ownership) continue;
      rooms.set(room.id, {
        ...room,
        vacationCash: room.vacationCash || 0,
        currentRoll: room.currentRoll || null,
        pendingPurchase: room.pendingPurchase || null,
        auction: room.auction || null,
        trades: room.trades || [],
        log: room.log || [],
        chat: room.chat || [],
        doubles: room.doubles || 0
      });
      clients.set(room.id, new Set());
    }
  } catch (error) {
    console.error("Failed to load persisted rooms:", error);
  }
}

function playerPublic(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    token: player.token,
    cash: player.cash,
    position: player.position,
    jailTurns: player.jailTurns,
    bankrupt: player.bankrupt,
    jailCards: player.jailCards,
    lastRoll: player.lastRoll
  };
}

function publicRoom(room) {
  const ownerByTile = {};
  Object.entries(room.ownership).forEach(([tileId, prop]) => {
    ownerByTile[tileId] = prop;
  });
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    players: room.players.map(playerPublic),
    board: BOARD,
    groupColors: GROUP_COLORS,
    ownership: ownerByTile,
    vacationCash: room.vacationCash || 0,
    activePlayerId: room.activePlayerId,
    currentRoll: room.currentRoll,
    turnMessage: room.turnMessage,
    pendingPurchase: room.pendingPurchase,
    auction: room.auction,
    trades: room.trades,
    log: room.log.slice(-80),
    chat: room.chat.slice(-80),
    winnerId: room.winnerId
  };
}

function lobbySummary() {
  return Array.from(rooms.values()).map((room) => ({
    id: room.id,
    name: room.name,
    status: room.status,
    players: room.players.length,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    spectators: roomClientCount(room.id)
  })).sort((a, b) => b.createdAt - a.createdAt);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function createRoom(name, maxPlayers = 6) {
  const room = {
    id: id("R"),
    name: cleanText(name, "Private Table", 40),
    maxPlayers: Math.max(2, Math.min(8, Number(maxPlayers) || 6)),
    createdAt: Date.now(),
    status: "lobby",
    hostId: null,
    players: [],
    ownership: {},
    activePlayerId: null,
    currentRoll: null,
    turnMessage: "Waiting for players.",
    pendingPurchase: null,
    auction: null,
    trades: [],
    log: [],
    chat: [],
    winnerId: null,
    doubles: 0,
    vacationCash: 0
  };
  rooms.set(room.id, room);
  clients.set(room.id, new Set());
  schedulePersist();
  return room;
}

function addPlayer(room, name) {
  const player = {
    id: id("P"),
    name: cleanText(name, `Player ${room.players.length + 1}`, 24),
    color: COLORS[room.players.length % COLORS.length],
    token: TOKENS[room.players.length % TOKENS.length],
    cash: STARTING_CASH,
    position: 0,
    jailTurns: 0,
    jailCards: 0,
    bankrupt: false,
    lastRoll: null
  };
  room.players.push(player);
  if (!room.hostId) room.hostId = player.id;
  room.chat.push({ id: id("C"), playerId: "system", name: "Table", text: `${player.name} joined.`, at: Date.now() });
  addLog(room, `${player.name} joined the room.`, "info");
  return player;
}

function addLog(room, text, tone = "info") {
  room.log.push({ id: id("L"), text, tone, at: Date.now() });
}

function emitRoom(room) {
  const data = `event: state\ndata: ${JSON.stringify(publicRoom(room))}\n\n`;
  const set = clients.get(room.id);
  if (set) {
    for (const res of set) res.write(data);
  }
  schedulePersist();
  emitLobby();
}

function emitLobby() {
  const lobby = clients.get("lobby");
  if (!lobby) return;
  const data = `event: lobby\ndata: ${JSON.stringify(lobbySummary())}\n\n`;
  for (const res of lobby) res.write(data);
}

function pruneRooms() {
  const now = Date.now();
  let changed = false;
  for (const [roomId, room] of rooms) {
    const roomAge = now - (room.createdAt || now);
    const isInactive = roomClientCount(roomId) === 0 && (room.status === "ended" || room.players.length === 0);
    if (roomAge > ROOM_TTL_MS && isInactive) {
      rooms.delete(roomId);
      clients.delete(roomId);
      changed = true;
    }
  }
  if (changed) {
    schedulePersist();
    emitLobby();
  }
}

function findRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("Room not found.");
  return room;
}

function findPlayer(room, playerId) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) throw new Error("Player not found in this room.");
  return player;
}

function activePlayer(room, playerId) {
  if (room.activePlayerId !== playerId) throw new Error("It is not your turn.");
  return findPlayer(room, playerId);
}

function activePlayers(room) {
  return room.players.filter((player) => !player.bankrupt);
}

function nextPlayer(room) {
  const contenders = activePlayers(room);
  if (contenders.length <= 1) {
    room.status = "ended";
    room.winnerId = contenders[0]?.id || null;
    room.turnMessage = contenders[0] ? `${contenders[0].name} wins the table.` : "No winner.";
    addLog(room, room.turnMessage, "win");
    return;
  }
  const currentIndex = room.players.findIndex((player) => player.id === room.activePlayerId);
  for (let i = 1; i <= room.players.length; i += 1) {
    const candidate = room.players[(currentIndex + i + room.players.length) % room.players.length];
    if (!candidate.bankrupt) {
      room.activePlayerId = candidate.id;
      room.currentRoll = null;
      room.pendingPurchase = null;
      room.auction = null;
      room.doubles = 0;
      room.turnMessage = `${candidate.name}'s turn.`;
      return;
    }
  }
}

function tileOwner(room, tileId) {
  const property = room.ownership[tileId];
  return property ? findPlayer(room, property.ownerId) : null;
}

function groupTileIds(group) {
  return BOARD.filter((tile) => tile.group === group && ["property", "rail", "utility"].includes(tile.type)).map((tile) => String(tile.id));
}

function colorPropertyTileIds(group) {
  return BOARD.filter((tile) => tile.group === group && tile.type === "property").map((tile) => String(tile.id));
}

function ownsGroup(room, playerId, group) {
  return groupTileIds(group).every((tileId) => room.ownership[tileId]?.ownerId === playerId && !room.ownership[tileId]?.mortgaged);
}

function ownsColorGroup(room, playerId, group) {
  const tileIds = colorPropertyTileIds(group);
  return tileIds.length > 0 && tileIds.every((tileId) => room.ownership[tileId]?.ownerId === playerId && !room.ownership[tileId]?.mortgaged);
}

function colorGroupBuildings(room, group) {
  return colorPropertyTileIds(group).map((tileId) => room.ownership[tileId]?.houses || 0);
}

function canBuildEvenly(room, tile, prop) {
  const buildings = colorGroupBuildings(room, tile.group);
  return prop.houses === Math.min(...buildings);
}

function canSellEvenly(room, tile, prop) {
  const buildings = colorGroupBuildings(room, tile.group);
  return prop.houses === Math.max(...buildings);
}

function playerAssets(room, playerId) {
  return Object.entries(room.ownership)
    .filter(([, prop]) => prop.ownerId === playerId)
    .map(([tileId, prop]) => ({ tile: BOARD[Number(tileId)], prop }));
}

function buildingCount(room, playerId) {
  return playerAssets(room, playerId).reduce((total, item) => total + (item.prop.houses || 0), 0);
}

function rentFor(room, tile, ownerId, rollTotal) {
  const prop = room.ownership[tile.id];
  if (!prop || prop.mortgaged) return 0;
  if (tile.type === "rail") {
    const count = groupTileIds("Transit").filter((tileId) => room.ownership[tileId]?.ownerId === ownerId).length;
    return tile.rent[Math.max(0, count - 1)] || 25;
  }
  if (tile.type === "utility") {
    const count = groupTileIds("Utility").filter((tileId) => room.ownership[tileId]?.ownerId === ownerId).length;
    return rollTotal * (count === 2 ? 10 : 4);
  }
  const base = tile.rent[prop.houses || 0] || tile.rent[0];
  return base;
}

function transfer(room, from, to, amount, reason) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!amount) return;
  if (from) from.cash -= amount;
  if (to) to.cash += amount;
  const fromName = from ? from.name : "Bank";
  const toName = to ? to.name : "Bank";
  addLog(room, `${fromName} paid $${amount} to ${toName}${reason ? ` for ${reason}` : ""}.`, "money");
  if (from && from.cash < 0) bankrupt(room, from);
}

function payTaxToVacation(room, player, tile) {
  const amount = Math.max(0, Math.floor(Number(tile.amount) || 0));
  if (!amount) return;
  player.cash -= amount;
  room.vacationCash = (room.vacationCash || 0) + amount;
  addLog(room, `${player.name} paid $${amount} for ${tile.name}. Vacation cash is now $${room.vacationCash}.`, "money");
  if (player.cash < 0) bankrupt(room, player);
}

function collectVacationCash(room, player) {
  const amount = Math.max(0, Math.floor(Number(room.vacationCash) || 0));
  if (!amount) {
    addLog(room, `${player.name} landed on Vacation. No tax cash is waiting yet.`, "info");
    return;
  }
  player.cash += amount;
  room.vacationCash = 0;
  addLog(room, `${player.name} collected $${amount} in Vacation cash.`, "money");
}

function bankrupt(room, player) {
  if (player.bankrupt) return;
  player.bankrupt = true;
  player.cash = 0;
  Object.keys(room.ownership).forEach((tileId) => {
    if (room.ownership[tileId].ownerId === player.id) delete room.ownership[tileId];
  });
  room.trades = room.trades.filter((trade) => trade.fromId !== player.id && trade.toId !== player.id);
  addLog(room, `${player.name} is bankrupt and leaves the economy.`, "danger");
  if (room.activePlayerId === player.id) nextPlayer(room);
}

function buyTile(room, player, tileId) {
  const tile = BOARD[Number(tileId)];
  if (!tile || !["property", "rail", "utility"].includes(tile.type)) throw new Error("That tile cannot be purchased.");
  if (room.ownership[tile.id]) throw new Error("That tile is already owned.");
  if (player.cash < tile.price) throw new Error("Not enough cash.");
  player.cash -= tile.price;
  room.ownership[tile.id] = { ownerId: player.id, houses: 0, mortgaged: false };
  room.pendingPurchase = null;
  addLog(room, `${player.name} bought ${tile.name} for $${tile.price}.`, "buy");
}

function resolveLanding(room, player, rollTotal = 0) {
  const tile = BOARD[player.position];
  room.pendingPurchase = null;
  room.turnMessage = `${player.name} landed on ${tile.name}.`;

  if (["property", "rail", "utility"].includes(tile.type)) {
    const owned = room.ownership[tile.id];
    if (!owned) {
      room.pendingPurchase = { playerId: player.id, tileId: tile.id };
      addLog(room, `${player.name} can buy ${tile.name} for $${tile.price}.`, "buy");
      return;
    }
    if (owned.ownerId !== player.id) {
      const owner = findPlayer(room, owned.ownerId);
      if (!owner.bankrupt) {
        transfer(room, player, owner, rentFor(room, tile, owner.id, rollTotal), `rent on ${tile.name}`);
      }
    }
    return;
  }

  if (tile.type === "tax") {
    payTaxToVacation(room, player, tile);
    return;
  }

  if (tile.type === "parking") {
    collectVacationCash(room, player);
    return;
  }

  if (tile.type === "goToJail") {
    sendToJail(room, player);
    return;
  }

  if (tile.type === "card") {
    drawCard(room, player, tile.deck);
  }
}

function drawCard(room, player, deckName) {
  const deck = deckName === "chance" ? CHANCE : COMMUNITY;
  const card = deck[Math.floor(Math.random() * deck.length)];
  addLog(room, `${player.name} drew: ${card.text}`, "card");
  if (card.money) transfer(room, card.money < 0 ? player : null, card.money > 0 ? player : null, Math.abs(card.money), "card");
  if (card.perBuilding) {
    const amount = Math.abs(card.perBuilding) * buildingCount(room, player.id);
    transfer(room, card.perBuilding < 0 ? player : null, card.perBuilding > 0 ? player : null, amount, "building fees");
  }
  if (card.collectFromEach) {
    room.players.filter((p) => p.id !== player.id && !p.bankrupt).forEach((other) => transfer(room, other, player, card.collectFromEach, "community dividend"));
  }
  if (card.jailCard) {
    player.jailCards += 1;
    addLog(room, `${player.name} keeps a Jail pass.`, "card");
  }
  if (card.jail) {
    sendToJail(room, player);
  }
  if (typeof card.moveBy === "number") {
    player.position = (player.position + card.moveBy + BOARD.length) % BOARD.length;
    resolveLanding(room, player, 0);
  }
  if (typeof card.moveTo === "number") {
    moveTo(room, player, card.moveTo, 0);
  }
}

function moveTo(room, player, position, rollTotal) {
  if (position < player.position) {
    player.cash += PASS_GO;
    addLog(room, `${player.name} passed Launch Square and collected $${PASS_GO}.`, "money");
  }
  player.position = position;
  resolveLanding(room, player, rollTotal);
}

function sendToJail(room, player) {
  player.position = 10;
  player.jailTurns = 3;
  room.doubles = 0;
  addLog(room, `${player.name} was sent to Jail.`, "danger");
}

function startAuction(room, player, tileId) {
  const tile = BOARD[Number(tileId)];
  if (!tile || room.ownership[tile.id]) throw new Error("Auction cannot start for this tile.");
  room.pendingPurchase = null;
  room.auction = {
    tileId: tile.id,
    highBid: 0,
    highBidderId: null,
    active: activePlayers(room).map((p) => p.id),
    createdBy: player.id
  };
  addLog(room, `${player.name} sent ${tile.name} to auction.`, "auction");
}

function finishAuction(room) {
  const auction = room.auction;
  if (!auction) return;
  const tile = BOARD[auction.tileId];
  if (auction.highBidderId && auction.highBid > 0) {
    const winner = findPlayer(room, auction.highBidderId);
    if (winner.cash >= auction.highBid) {
      winner.cash -= auction.highBid;
      room.ownership[tile.id] = { ownerId: winner.id, houses: 0, mortgaged: false };
      addLog(room, `${winner.name} won ${tile.name} for $${auction.highBid}.`, "auction");
    }
  } else {
    addLog(room, `${tile.name} stayed with the bank.`, "auction");
  }
  room.auction = null;
}

function tradePublic(trade) {
  return trade;
}

async function api(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        rooms: rooms.size,
        uptime: Math.round(process.uptime()),
        startedAt: serverStartedAt
      });
    }

    if (req.method === "GET" && url.pathname === "/api/rooms") {
      return sendJson(res, 200, lobbySummary());
    }

    if (req.method === "GET" && url.pathname === "/api/lobby/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff"
      });
      res.write(`event: lobby\ndata: ${JSON.stringify(lobbySummary())}\n\n`);
      if (!clients.has("lobby")) clients.set("lobby", new Set());
      clients.get("lobby").add(res);
      req.on("close", () => clients.get("lobby")?.delete(res));
      return;
    }

    const eventMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/events$/);
    if (req.method === "GET" && eventMatch) {
      const room = findRoom(eventMatch[1]);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff"
      });
      res.write(`event: state\ndata: ${JSON.stringify(publicRoom(room))}\n\n`);
      clients.get(room.id).add(res);
      req.on("close", () => clients.get(room.id)?.delete(res));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/rooms") {
      const body = await parseBody(req);
      const room = createRoom(body.name, body.maxPlayers);
      let playerId = null;
      if (body.playerName) {
        const player = addPlayer(room, body.playerName);
        playerId = player.id;
      }
      emitLobby();
      return sendJson(res, 201, playerId ? { room: publicRoom(room), playerId } : publicRoom(room));
    }

    const stateMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)$/);
    if (req.method === "GET" && stateMatch) {
      return sendJson(res, 200, publicRoom(findRoom(stateMatch[1])));
    }

    const actionMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/([^/]+)$/);
    if (req.method !== "POST" || !actionMatch) return false;

    const [, roomId, action] = actionMatch;
    const room = findRoom(roomId);
    const body = await parseBody(req);
    let payload = null;
    const validActions = new Set([
      "join", "start", "chat", "roll", "buy", "auction", "bid", "passbid", "endturn",
      "build", "sellbuilding", "mortgage", "unmortgage", "trade", "trade-response"
    ]);
    if (!validActions.has(action)) throw new Error("Unknown action.");

    if (action === "join") {
      if (room.status !== "lobby") throw new Error("This game has already started.");
      if (room.players.length >= room.maxPlayers) throw new Error("Room is full.");
      const player = addPlayer(room, body.name);
      payload = { room: publicRoom(room), playerId: player.id };
    }

    if (action === "start") {
      const host = findPlayer(room, body.playerId);
      if (room.hostId !== host.id) throw new Error("Only the host can start.");
      if (room.players.length < 2) throw new Error("At least two players are required.");
      room.status = "playing";
      room.activePlayerId = room.players[0].id;
      room.turnMessage = `${room.players[0].name}'s turn.`;
      addLog(room, `${host.name} started the game.`, "info");
    }

    if (action === "chat") {
      const player = findPlayer(room, body.playerId);
      const text = cleanText(body.text, "", 240);
      if (text) room.chat.push({ id: id("C"), playerId: player.id, name: player.name, text, at: Date.now() });
    }

    if (action === "roll") {
      if (room.status !== "playing") throw new Error("Game has not started.");
      const player = activePlayer(room, body.playerId);
      if (room.pendingPurchase || room.auction) throw new Error("Resolve the purchase or auction first.");
      if (room.currentRoll?.rolledBy === player.id && !room.currentRoll?.canRollAgain) throw new Error("You already rolled.");

      if (player.jailTurns > 0) {
        if (player.jailCards > 0 && body.useJailCard) {
          player.jailCards -= 1;
          player.jailTurns = 0;
          addLog(room, `${player.name} used a Jail pass.`, "card");
        } else if (body.payFine) {
          transfer(room, player, null, 50, "Jail fine");
          player.jailTurns = 0;
        }
      }

      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const total = d1 + d2;
      player.lastRoll = [d1, d2];
      room.currentRoll = { rolledBy: player.id, dice: [d1, d2], total, canRollAgain: d1 === d2 };
      addLog(room, `${player.name} rolled ${d1} + ${d2}.`, "roll");

      if (player.jailTurns > 0) {
        if (d1 === d2) {
          player.jailTurns = 0;
          addLog(room, `${player.name} rolled doubles and left Jail.`, "roll");
        } else {
          player.jailTurns -= 1;
          if (player.jailTurns <= 0) {
            player.jailTurns = 0;
            room.turnMessage = `${player.name} served three Jail turns and is free next turn.`;
            addLog(room, `${player.name} served three Jail turns and is free next turn.`, "roll");
          } else {
            room.turnMessage = `${player.name} remains in Jail.`;
          }
          nextPlayer(room);
          emitRoom(room);
          return sendJson(res, 200, publicRoom(room));
        }
      }

      if (d1 === d2) {
        room.doubles += 1;
        if (room.doubles >= 3) {
          sendToJail(room, player);
          nextPlayer(room);
          emitRoom(room);
          return sendJson(res, 200, publicRoom(room));
        }
      } else {
        room.doubles = 0;
      }

      const oldPosition = player.position;
      player.position = (player.position + total) % BOARD.length;
      if (player.position < oldPosition) {
        player.cash += PASS_GO;
        addLog(room, `${player.name} passed Launch Square and collected $${PASS_GO}.`, "money");
      }
      resolveLanding(room, player, total);
      if (d1 !== d2 && !room.pendingPurchase && !room.auction) room.currentRoll.canRollAgain = false;
    }

    if (action === "buy") {
      const player = activePlayer(room, body.playerId);
      if (!room.pendingPurchase || room.pendingPurchase.playerId !== player.id) throw new Error("No pending purchase for you.");
      buyTile(room, player, room.pendingPurchase.tileId);
    }

    if (action === "auction") {
      const player = activePlayer(room, body.playerId);
      if (!room.pendingPurchase || room.pendingPurchase.playerId !== player.id) throw new Error("No pending purchase for you.");
      startAuction(room, player, room.pendingPurchase.tileId);
    }

    if (action === "bid") {
      const player = findPlayer(room, body.playerId);
      const auction = room.auction;
      if (!auction || !auction.active.includes(player.id)) throw new Error("No active auction for you.");
      const amount = Math.floor(Number(body.amount) || 0);
      if (amount <= auction.highBid) throw new Error("Bid must be higher than the current bid.");
      if (amount > player.cash) throw new Error("You do not have enough cash.");
      auction.highBid = amount;
      auction.highBidderId = player.id;
      addLog(room, `${player.name} bid $${amount}.`, "auction");
    }

    if (action === "passbid") {
      const player = findPlayer(room, body.playerId);
      const auction = room.auction;
      if (!auction) throw new Error("No active auction.");
      auction.active = auction.active.filter((idValue) => idValue !== player.id);
      addLog(room, `${player.name} passed the auction.`, "auction");
      const remaining = auction.active.filter((idValue) => idValue !== auction.highBidderId);
      if (auction.active.length <= 1 || remaining.length === 0) finishAuction(room);
    }

    if (action === "endturn") {
      const player = activePlayer(room, body.playerId);
      if (room.pendingPurchase || room.auction) throw new Error("Resolve the purchase or auction first.");
      if (room.currentRoll?.canRollAgain && player.jailTurns === 0) {
        room.currentRoll.canRollAgain = false;
        addLog(room, `${player.name} skipped the bonus roll.`, "roll");
      }
      nextPlayer(room);
    }

    if (action === "build") {
      const player = findPlayer(room, body.playerId);
      const tile = BOARD[Number(body.tileId)];
      const prop = room.ownership[tile?.id];
      if (!tile || tile.type !== "property" || !prop || prop.ownerId !== player.id) throw new Error("You do not own that property.");
      if (!ownsColorGroup(room, player.id, tile.group)) throw new Error("You need the full color set.");
      if (prop.houses >= 5) throw new Error("Already has a hotel.");
      if (!canBuildEvenly(room, tile, prop)) throw new Error("Build evenly across the color set.");
      if (player.cash < tile.houseCost) throw new Error("Not enough cash to build.");
      player.cash -= tile.houseCost;
      prop.houses += 1;
      addLog(room, `${player.name} built ${prop.houses === 5 ? "a hotel" : "a house"} on ${tile.name}.`, "build");
    }

    if (action === "sellbuilding") {
      const player = findPlayer(room, body.playerId);
      const tile = BOARD[Number(body.tileId)];
      const prop = room.ownership[tile?.id];
      if (!tile || tile.type !== "property" || !prop || prop.ownerId !== player.id) throw new Error("You do not own that property.");
      if (!prop.houses) throw new Error("There are no buildings to sell.");
      if (!canSellEvenly(room, tile, prop)) throw new Error("Sell evenly across the color set.");
      prop.houses -= 1;
      player.cash += Math.floor(tile.houseCost / 2);
      addLog(room, `${player.name} sold ${prop.houses === 4 ? "a hotel" : "a building"} on ${tile.name}.`, "build");
    }

    if (action === "mortgage") {
      const player = findPlayer(room, body.playerId);
      const tile = BOARD[Number(body.tileId)];
      const prop = room.ownership[tile?.id];
      if (!tile || !prop || prop.ownerId !== player.id) throw new Error("You do not own that asset.");
      if (prop.houses > 0) throw new Error("Sell buildings before mortgaging.");
      if (prop.mortgaged) throw new Error("Already mortgaged.");
      prop.mortgaged = true;
      player.cash += Math.floor(tile.price / 2);
      addLog(room, `${player.name} mortgaged ${tile.name}.`, "money");
    }

    if (action === "unmortgage") {
      const player = findPlayer(room, body.playerId);
      const tile = BOARD[Number(body.tileId)];
      const prop = room.ownership[tile?.id];
      const cost = Math.ceil((tile.price / 2) * 1.1);
      if (!tile || !prop || prop.ownerId !== player.id) throw new Error("You do not own that asset.");
      if (!prop.mortgaged) throw new Error("This asset is not mortgaged.");
      if (player.cash < cost) throw new Error("Not enough cash.");
      player.cash -= cost;
      prop.mortgaged = false;
      addLog(room, `${player.name} unmortgaged ${tile.name}.`, "money");
    }

    if (action === "trade") {
      const from = findPlayer(room, body.playerId);
      const to = findPlayer(room, body.toId);
      const trade = {
        id: id("T"),
        fromId: from.id,
        toId: to.id,
        offerCash: Math.max(0, Math.floor(Number(body.offerCash) || 0)),
        requestCash: Math.max(0, Math.floor(Number(body.requestCash) || 0)),
        offerTiles: (body.offerTiles || []).map(String),
        requestTiles: (body.requestTiles || []).map(String),
        status: "pending",
        at: Date.now()
      };
      if (trade.offerCash > from.cash) throw new Error("Offer cash is too high.");
      if (trade.requestCash > to.cash) throw new Error("Requested cash is too high.");
      trade.offerTiles.forEach((tileId) => {
        if (room.ownership[tileId]?.ownerId !== from.id) throw new Error("You can only offer your own assets.");
      });
      trade.requestTiles.forEach((tileId) => {
        if (room.ownership[tileId]?.ownerId !== to.id) throw new Error("You can only request their assets.");
      });
      room.trades.push(tradePublic(trade));
      addLog(room, `${from.name} offered a trade to ${to.name}.`, "trade");
    }

    if (action === "trade-response") {
      const player = findPlayer(room, body.playerId);
      const trade = room.trades.find((item) => item.id === body.tradeId && item.status === "pending");
      if (!trade || trade.toId !== player.id) throw new Error("Trade not found.");
      if (body.accept) {
        const from = findPlayer(room, trade.fromId);
        const to = findPlayer(room, trade.toId);
        if (from.cash < trade.offerCash || to.cash < trade.requestCash) throw new Error("Cash changed; trade cannot complete.");
        trade.offerTiles.forEach((tileId) => {
          if (room.ownership[tileId]?.ownerId !== from.id) throw new Error("Offered assets changed.");
        });
        trade.requestTiles.forEach((tileId) => {
          if (room.ownership[tileId]?.ownerId !== to.id) throw new Error("Requested assets changed.");
        });
        transfer(room, from, to, trade.offerCash, "trade");
        transfer(room, to, from, trade.requestCash, "trade");
        trade.offerTiles.forEach((tileId) => { room.ownership[tileId].ownerId = to.id; });
        trade.requestTiles.forEach((tileId) => { room.ownership[tileId].ownerId = from.id; });
        trade.status = "accepted";
        addLog(room, `${to.name} accepted a trade from ${from.name}.`, "trade");
      } else {
        trade.status = "declined";
        addLog(room, `${player.name} declined a trade.`, "trade");
      }
    }

    emitRoom(room);
    return sendJson(res, 200, payload || publicRoom(room));
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = path.normalize(decodeURIComponent(url.pathname));
  if (filePath === "/") filePath = "/index.html";
  if (filePath.includes("..")) return sendJson(res, 403, { error: "Forbidden" });
  const fullPath = path.join(PUBLIC_DIR, filePath);
  fs.readFile(fullPath, (error, data) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) return sendJson(res, 404, { error: "Not found" });
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
}

loadRooms();
setInterval(pruneRooms, 1000 * 60 * 10).unref();

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const handled = await api(req, res);
    if (handled === false) sendJson(res, 404, { error: "Not found" });
    return;
  }
  serveStatic(req, res);
});

function shutdown(signal) {
  try {
    persistRooms();
  } catch (error) {
    console.error("Failed to persist rooms during shutdown:", error);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
  console.log(`Received ${signal}; shutting down.`);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, HOST, () => {
  console.log(`WarLand running on http://${HOST}:${PORT}`);
});
