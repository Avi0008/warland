const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  room: null,
  playerId: localStorage.getItem("cc_player_id") || "",
  roomId: new URLSearchParams(location.search).get("room") || "",
  roomEvents: null,
  lobbyEvents: null,
  selectedPanel: "assets",
  tradeOfferTiles: new Set(),
  tradeRequestTiles: new Set(),
  diceRolling: false,
  rollingDice: [1, 1],
  rollingTimer: null,
  rollSettleTimer: null
};

const THEME_KEY = "warland_theme";

const views = {
  lobby: $("#lobbyView"),
  game: $("#gameView"),
  rules: $("#rulesView")
};

function applyTheme(theme) {
  const mode = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(THEME_KEY, mode);
  const toggle = $("#themeToggle");
  const label = $("#themeLabel");
  const icon = $(".theme-icon");
  if (toggle) toggle.setAttribute("aria-pressed", String(mode === "dark"));
  if (label) label.textContent = mode === "dark" ? "Dark" : "Light";
  if (icon) icon.textContent = mode === "dark" ? "☾" : "☀";
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(saved || preferred);
}

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function roomUrl(roomId) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;
}

function extractRoomId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.searchParams.get("room") || raw;
  } catch {
    return raw.replace(/^#/, "").replace(/^room:/i, "");
  }
}

function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function pipsFor(value) {
  return {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  }[value] || [];
}

function dieFace(value, className) {
  const numericValue = Number(value);
  const rolling = state.diceRolling ? " rolling" : "";
  if (!numericValue) {
    return `<span class="${className}" aria-label="Dice waiting"><span class="die-symbol">?</span></span>`;
  }
  const activePips = pipsFor(numericValue);
  return `
    <span class="${className}${rolling}" aria-label="Dice ${numericValue}">
      ${Array.from({ length: 9 }, (_, index) => `<span class="pip ${activePips.includes(index + 1) ? "active" : ""}"></span>`).join("")}
    </span>
  `;
}

function currentPlayer() {
  return state.room?.players.find((player) => player.id === state.playerId);
}

function tileById(id) {
  return state.room?.board.find((tile) => String(tile.id) === String(id));
}

function ownerOf(tileId) {
  const ownerId = state.room?.ownership?.[tileId]?.ownerId;
  return state.room?.players.find((player) => player.id === ownerId);
}

function showView(name) {
  Object.entries(views).forEach(([key, element]) => element.classList.toggle("hidden", key !== name));
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
}

function toast(message) {
  const element = document.createElement("div");
  element.className = "notice";
  element.textContent = message;
  element.style.position = "fixed";
  element.style.left = "50%";
  element.style.top = "78px";
  element.style.transform = "translateX(-50%)";
  element.style.zIndex = "100";
  element.style.boxShadow = "var(--shadow)";
  document.body.appendChild(element);
  setTimeout(() => element.remove(), 2600);
}

async function request(path, body = null) {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function roomAction(action, body = {}) {
  return request(`/api/rooms/${state.room.id}/${action}`, { playerId: state.playerId, ...body }).catch((error) => toast(error.message));
}

function startDiceRoll() {
  clearInterval(state.rollingTimer);
  clearTimeout(state.rollSettleTimer);
  state.diceRolling = true;
  state.rollingDice = [randomDie(), randomDie()];
  state.rollingTimer = setInterval(() => {
    state.rollingDice = [randomDie(), randomDie()];
    renderGame();
  }, 85);
  renderGame();
}

function stopDiceRoll() {
  clearInterval(state.rollingTimer);
  state.rollingTimer = null;
  state.diceRolling = false;
  renderGame();
}

async function rollDice(body = {}) {
  if (state.diceRolling) return;
  startDiceRoll();
  const startedAt = Date.now();
  const result = await roomAction("roll", body);
  const remaining = Math.max(0, 950 - (Date.now() - startedAt));
  clearTimeout(state.rollSettleTimer);
  state.rollSettleTimer = setTimeout(() => {
    if (result) state.room = result;
    stopDiceRoll();
  }, remaining);
}

function connectLobby() {
  if (state.lobbyEvents) state.lobbyEvents.close();
  state.lobbyEvents = new EventSource("/api/lobby/events");
  state.lobbyEvents.addEventListener("lobby", (event) => renderRooms(JSON.parse(event.data)));
}

function connectRoom(roomId) {
  state.roomId = roomId;
  if (state.roomEvents) state.roomEvents.close();
  state.roomEvents = new EventSource(`/api/rooms/${roomId}/events`);
  state.roomEvents.addEventListener("state", (event) => {
    state.room = JSON.parse(event.data);
    renderGame();
  });
}

async function openRoom(roomId) {
  history.pushState({}, "", `?room=${roomId}`);
  showView("game");
  const room = await request(`/api/rooms/${roomId}`);
  state.room = room;
  connectRoom(roomId);
  renderGame();
}

function renderRooms(rooms) {
  const list = $("#roomsList");
  list.innerHTML = "";
  if (!rooms.length) {
    list.innerHTML = `<div class="room-row"><div><h3>No active rooms</h3><p>Create a private table to get started.</p></div></div>`;
    return;
  }
  const template = $("#roomTemplate");
  rooms.forEach((room) => {
    const node = template.content.firstElementChild.cloneNode(true);
    $("h3", node).textContent = room.name;
    $("p", node).textContent = `${room.players}/${room.maxPlayers} players · ${room.status}`;
    $("button", node).addEventListener("click", () => openRoom(room.id));
    list.appendChild(node);
  });
}

function boardPosition(index) {
  if (index <= 10) return { gridColumn: 11 - index, gridRow: 11 };
  if (index <= 20) return { gridColumn: 1, gridRow: 21 - index };
  if (index <= 30) return { gridColumn: index - 19, gridRow: 1 };
  return { gridColumn: 11, gridRow: index - 29 };
}

function tileClass(tile) {
  return ["go", "jail", "parking", "goToJail"].includes(tile.type) ? "tile corner" : "tile";
}

function tileDetail(tile) {
  if (tile.type === "go") return `<div class="tile-price launch-price">Collect $200</div>`;
  if (tile.type === "tax") return `<div class="tile-price tax-price">Pay ${money(tile.amount)}</div>`;
  if (tile.type === "parking") return `<div class="tile-price vacation-price">Cash ${money(state.room.vacationCash || 0)}</div>`;
  if (tile.type === "card" && tile.deck === "community") return `<div class="tile-note" title="Draw a Community Fund card">Draw card</div>`;
  if (tile.type === "card" && tile.deck === "chance") return `<div class="tile-note" title="Draw a Market News card">Draw card</div>`;
  if (tile.type === "rail") {
    return `
      <div class="tile-value-stack" title="Airport rent: 1 airport $25, 2 airports $50, 3 airports $100, 4 airports $200">
        <div class="tile-price">${money(tile.price)}</div>
        <div class="tile-price rent-price">Rent $25+</div>
      </div>
    `;
  }
  if (tile.type === "utility") {
    return `
      <div class="tile-value-stack" title="Utility rent: one utility charges 4x dice roll, both utilities charge 10x dice roll">
        <div class="tile-price">${money(tile.price)}</div>
        <div class="tile-note">Rent 4x/10x</div>
      </div>
    `;
  }
  if (tile.price) {
    const prop = state.room.ownership?.[tile.id];
    const rent = tile.rent?.[prop?.houses || 0] || tile.rent?.[0] || 0;
    return `
      <div class="tile-value-stack">
        <div class="tile-price">${money(tile.price)}</div>
        <div class="tile-price rent-price">Rent ${money(rent)}</div>
      </div>
    `;
  }
  return "";
}

function renderBoardDice() {
  const dice = state.diceRolling ? state.rollingDice : state.room.currentRoll?.dice || [];
  if (!dice.length) {
    return `
      <div class="board-dice" aria-label="Dice waiting to roll">
        ${dieFace(null, "board-die")}
        ${dieFace(null, "board-die")}
      </div>
    `;
  }
  return `
    <div class="board-dice" aria-label="Current dice roll ${dice[0]} and ${dice[1]}">
      ${dice.map((die) => dieFace(die, "board-die")).join("")}
    </div>
    ${state.diceRolling ? `<div class="roll-status">Rolling...</div>` : ""}
  `;
}

function renderBoard() {
  const board = $("#board");
  board.innerHTML = `
    <div class="board-center">
      <div class="center-card">
        <p class="eyebrow">WarLand</p>
        <h2>${state.room.status === "ended" ? "Game over" : "Own the board"}</h2>
        ${renderBoardDice()}
        <p>${escapeHTML(state.room.turnMessage || "Waiting for the next move.")}</p>
      </div>
    </div>
  `;

  state.room.board.forEach((tile) => {
    const position = boardPosition(tile.id);
    const tileElement = document.createElement("div");
    tileElement.className = tileClass(tile);
    tileElement.style.gridColumn = position.gridColumn;
    tileElement.style.gridRow = position.gridRow;
    const owner = ownerOf(tile.id);
    const prop = state.room.ownership[tile.id];
    const groupColor = state.room.groupColors[tile.group] || "#d8dedb";
    const playersHere = state.room.players.filter((player) => player.position === tile.id && !player.bankrupt);
    const tileLabel = escapeHTML(tile.name);
    tileElement.innerHTML = `
      ${tile.group ? `<div class="color-bar" style="background:${groupColor}"></div>` : ""}
      <div class="tile-name" title="${tileLabel}">${tileLabel}</div>
      <div class="tile-footer">
        ${tileDetail(tile)}
        <div class="houses">${Array.from({ length: prop?.houses || 0 }, (_, index) => `<span class="house" title="${index === 4 ? "Hotel" : "House"}"></span>`).join("")}</div>
        <div class="tile-owner" style="background:${owner?.color || "transparent"}"></div>
      </div>
      <div class="token-stack">
        ${playersHere.map((player) => `<span class="token" style="background:${player.color}" title="${escapeHTML(player.name)}">${escapeHTML(player.name.slice(0, 1).toUpperCase())}</span>`).join("")}
      </div>
    `;
    board.appendChild(tileElement);
  });
}

function renderPlayers() {
  const panel = $("#playersPanel");
  panel.innerHTML = `<p class="eyebrow">Players</p>`;
  state.room.players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <span class="dot" style="background:${player.color}"></span>
      <div>
        <div class="player-name">${escapeHTML(player.name)}${player.id === state.room.hostId ? " · host" : ""}${player.id === state.room.activePlayerId ? " · turn" : ""}</div>
        <div class="meta-line">${player.bankrupt ? "Bankrupt" : `Tile ${player.position} · ${player.jailTurns ? `${player.jailTurns} Jail turn${player.jailTurns > 1 ? "s" : ""} left` : "Active"}`}</div>
      </div>
      <div class="player-money">${money(player.cash)}</div>
    `;
    panel.appendChild(row);
  });
}

function renderActions() {
  const panel = $("#actionsPanel");
  const me = currentPlayer();
  const active = me && state.room.activePlayerId === me.id;
  if (!me) {
    const message = state.room.status === "lobby" ? "Join this room to play." : "This game has already started.";
    panel.innerHTML = `<p class="eyebrow">Actions</p><div class="notice">${message}</div>`;
    return;
  }

  if (state.room.status === "lobby") {
    panel.innerHTML = `<p class="eyebrow">Actions</p><div class="notice">Waiting for the host to start the table.</div>`;
    return;
  }

  const pending = state.room.pendingPurchase && state.room.pendingPurchase.playerId === me.id;
  const tile = pending ? tileById(state.room.pendingPurchase.tileId) : null;
  panel.innerHTML = `
    <p class="eyebrow">Actions</p>
    ${active ? "" : `<div class="notice">Waiting for your turn.</div>`}
    ${me.jailTurns ? `<div class="notice">You are in Jail. Pay $50 to leave now, or roll doubles within ${me.jailTurns} turn${me.jailTurns > 1 ? "s" : ""}.</div>` : ""}
    ${pending ? `<div class="notice">${escapeHTML(tile.name)} is available for ${money(tile.price)}.</div>` : ""}
    <div class="action-grid">
      <button id="rollButton" class="primary-button">Roll dice</button>
      <button id="endTurnButton" class="secondary-button">End turn</button>
      ${pending ? `<button id="buyButton" class="primary-button">Buy</button><button id="auctionButton" class="secondary-button">Auction</button>` : ""}
      ${me.jailTurns ? `<button id="payFineButton" class="secondary-button">Pay $50</button><button id="jailCardButton" class="secondary-button">Use pass</button>` : ""}
    </div>
  `;
  $("#rollButton")?.toggleAttribute("disabled", !active || state.diceRolling || Boolean(state.room.pendingPurchase || state.room.auction));
  $("#endTurnButton")?.toggleAttribute("disabled", !active || Boolean(state.room.pendingPurchase || state.room.auction));
  $("#rollButton")?.addEventListener("click", () => rollDice());
  $("#endTurnButton")?.addEventListener("click", () => roomAction("endturn"));
  $("#buyButton")?.addEventListener("click", () => roomAction("buy"));
  $("#auctionButton")?.addEventListener("click", () => roomAction("auction"));
  $("#payFineButton")?.addEventListener("click", () => rollDice({ payFine: true }));
  $("#jailCardButton")?.addEventListener("click", () => rollDice({ useJailCard: true }));
}

function renderAuction() {
  const panel = $("#auctionPanel");
  const auction = state.room.auction;
  panel.classList.toggle("hidden", !auction);
  if (!auction) return;
  const tile = tileById(auction.tileId);
  const bidder = state.room.players.find((player) => player.id === auction.highBidderId);
  panel.innerHTML = `
    <p class="eyebrow">Live auction</p>
    <h3>${escapeHTML(tile.name)}</h3>
    <p class="meta-line">High bid: ${money(auction.highBid)}${bidder ? ` by ${escapeHTML(bidder.name)}` : ""}</p>
    <input id="bidAmountInput" type="number" min="${auction.highBid + 1}" step="10" value="${Math.max(tile.price / 2, auction.highBid + 10)}" />
    <div class="action-grid">
      <button id="bidButton" class="primary-button">Bid</button>
      <button id="passBidButton" class="secondary-button">Pass</button>
    </div>
  `;
  $("#bidButton").addEventListener("click", () => roomAction("bid", { amount: Number($("#bidAmountInput").value) }));
  $("#passBidButton").addEventListener("click", () => roomAction("passbid"));
}

function assetsFor(playerId) {
  return Object.entries(state.room.ownership)
    .filter(([, prop]) => prop.ownerId === playerId)
    .map(([tileId, prop]) => ({ tile: tileById(tileId), prop }));
}

function ownsGroup(playerId, group) {
  const groupTiles = state.room.board.filter((tile) => tile.group === group && ["property", "rail", "utility"].includes(tile.type));
  return groupTiles.length > 0 && groupTiles.every((tile) => state.room.ownership[tile.id]?.ownerId === playerId && !state.room.ownership[tile.id]?.mortgaged);
}

function colorGroupTiles(group) {
  return state.room.board.filter((tile) => tile.group === group && tile.type === "property");
}

function ownsColorGroup(playerId, group) {
  const tiles = colorGroupTiles(group);
  return tiles.length > 0 && tiles.every((tile) => state.room.ownership[tile.id]?.ownerId === playerId && !state.room.ownership[tile.id]?.mortgaged);
}

function colorGroupBuildingCounts(group) {
  return colorGroupTiles(group).map((tile) => state.room.ownership[tile.id]?.houses || 0);
}

function canBuildEvenly(tile, prop) {
  const counts = colorGroupBuildingCounts(tile.group);
  return prop.houses === Math.min(...counts);
}

function canSellEvenly(tile, prop) {
  const counts = colorGroupBuildingCounts(tile.group);
  return prop.houses === Math.max(...counts);
}

function renderAssets() {
  const panel = $("#assetsPanel");
  const me = currentPlayer();
  if (!me) {
    panel.innerHTML = `<div class="notice">Join to manage assets.</div>`;
    return;
  }
  const assets = assetsFor(me.id);
  panel.innerHTML = assets.length ? "" : `<div class="notice">No assets yet.</div>`;
  assets.forEach(({ tile, prop }) => {
    const card = document.createElement("article");
    card.className = "asset-card";
    const canBuild = tile.type === "property" && ownsColorGroup(me.id, tile.group) && prop.houses < 5 && canBuildEvenly(tile, prop);
    const canSellBuilding = tile.type === "property" && prop.houses > 0 && canSellEvenly(tile, prop);
    card.innerHTML = `
      <header>
        <span class="dot" style="background:${state.room.groupColors[tile.group] || "#d8dedb"}"></span>
        <h3>${escapeHTML(tile.name)}</h3>
        <strong>${prop.mortgaged ? "M" : prop.houses === 5 ? "Hotel" : prop.houses ? `${prop.houses}H` : money(tile.price)}</strong>
      </header>
      <div class="meta-line">${tile.group || tile.type} · ${prop.mortgaged ? "Mortgaged" : "Active"}</div>
      <div class="asset-actions">
        ${canBuild ? `<button class="chip-button" data-build="${tile.id}">${prop.houses === 4 ? "Build hotel" : "Build house"} ${money(tile.houseCost)}</button>` : ""}
        ${canSellBuilding ? `<button class="chip-button" data-sellbuilding="${tile.id}">${prop.houses === 5 ? "Sell hotel" : "Sell building"}</button>` : ""}
        ${prop.mortgaged ? `<button class="chip-button" data-unmortgage="${tile.id}">Unmortgage</button>` : `<button class="chip-button" data-mortgage="${tile.id}">Mortgage</button>`}
      </div>
    `;
    panel.appendChild(card);
  });
  $$("[data-build]", panel).forEach((button) => button.addEventListener("click", () => roomAction("build", { tileId: button.dataset.build })));
  $$("[data-sellbuilding]", panel).forEach((button) => button.addEventListener("click", () => roomAction("sellbuilding", { tileId: button.dataset.sellbuilding })));
  $$("[data-mortgage]", panel).forEach((button) => button.addEventListener("click", () => roomAction("mortgage", { tileId: button.dataset.mortgage })));
  $$("[data-unmortgage]", panel).forEach((button) => button.addEventListener("click", () => roomAction("unmortgage", { tileId: button.dataset.unmortgage })));
}

function renderTradePick(container, assets, set) {
  container.innerHTML = "";
  if (!assets.length) {
    container.innerHTML = `<span class="meta-line">No assets available.</span>`;
    return;
  }
  assets.forEach(({ tile }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip-button ${set.has(String(tile.id)) ? "active" : ""}`;
    button.textContent = tile.name;
    button.addEventListener("click", () => {
      const idValue = String(tile.id);
      if (set.has(idValue)) set.delete(idValue);
      else set.add(idValue);
      renderTrade();
    });
    container.appendChild(button);
  });
}

function describeTrade(trade) {
  const from = state.room.players.find((player) => player.id === trade.fromId);
  const to = state.room.players.find((player) => player.id === trade.toId);
  const offered = [
    trade.offerCash ? money(trade.offerCash) : "",
    ...trade.offerTiles.map((tileId) => tileById(tileId)?.name)
  ].filter(Boolean).join(", ") || "nothing";
  const requested = [
    trade.requestCash ? money(trade.requestCash) : "",
    ...trade.requestTiles.map((tileId) => tileById(tileId)?.name)
  ].filter(Boolean).join(", ") || "nothing";
  return `${from?.name} offers ${offered} for ${requested} from ${to?.name}.`;
}

function renderTrade() {
  const panel = $("#tradePanel");
  const me = currentPlayer();
  if (!me) {
    panel.innerHTML = `<div class="notice">Join to trade.</div>`;
    return;
  }
  const rivals = state.room.players.filter((player) => player.id !== me.id && !player.bankrupt);
  const selectedRivalId = $("#tradeTarget")?.value || rivals[0]?.id || "";
  const rival = state.room.players.find((player) => player.id === selectedRivalId);
  panel.innerHTML = `
    <form id="tradeForm" class="trade-form">
      <label>Trade with
        <select id="tradeTarget">${rivals.map((player) => `<option value="${player.id}" ${player.id === selectedRivalId ? "selected" : ""}>${escapeHTML(player.name)}</option>`).join("")}</select>
      </label>
      <label>Offer cash <input id="offerCash" type="number" min="0" step="10" value="0" /></label>
      <div>
        <p class="eyebrow">Offer assets</p>
        <div id="offerPicks" class="trade-picks"></div>
      </div>
      <label>Request cash <input id="requestCash" type="number" min="0" step="10" value="0" /></label>
      <div>
        <p class="eyebrow">Request assets</p>
        <div id="requestPicks" class="trade-picks"></div>
      </div>
      <button class="primary-button" type="submit">Send trade</button>
    </form>
    <div id="pendingTrades" class="rooms-list"></div>
  `;
  $("#tradeTarget")?.addEventListener("change", () => {
    state.tradeRequestTiles.clear();
    renderTrade();
  });
  renderTradePick($("#offerPicks"), assetsFor(me.id), state.tradeOfferTiles);
  renderTradePick($("#requestPicks"), rival ? assetsFor(rival.id) : [], state.tradeRequestTiles);
  $("#tradeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    roomAction("trade", {
      toId: $("#tradeTarget").value,
      offerCash: Number($("#offerCash").value),
      requestCash: Number($("#requestCash").value),
      offerTiles: Array.from(state.tradeOfferTiles),
      requestTiles: Array.from(state.tradeRequestTiles)
    }).then(() => {
      state.tradeOfferTiles.clear();
      state.tradeRequestTiles.clear();
    });
  });
  const list = $("#pendingTrades");
  state.room.trades.filter((trade) => trade.status === "pending").forEach((trade) => {
    const item = document.createElement("article");
    item.className = "trade-card";
    item.innerHTML = `
      <p>${escapeHTML(describeTrade(trade))}</p>
      ${trade.toId === me.id ? `<div class="action-grid"><button class="primary-button" data-accept="${trade.id}">Accept</button><button class="secondary-button" data-decline="${trade.id}">Decline</button></div>` : `<span class="meta-line">Pending</span>`}
    `;
    list.appendChild(item);
  });
  $$("[data-accept]", list).forEach((button) => button.addEventListener("click", () => roomAction("trade-response", { tradeId: button.dataset.accept, accept: true })));
  $$("[data-decline]", list).forEach((button) => button.addEventListener("click", () => roomAction("trade-response", { tradeId: button.dataset.decline, accept: false })));
}

function renderChat() {
  const list = $("#chatList");
  list.innerHTML = "";
  state.room.chat.forEach((message) => {
    const item = document.createElement("div");
    item.className = "chat-message";
    item.innerHTML = `<strong>${escapeHTML(message.name)}</strong><span>${escapeHTML(message.text)}</span>`;
    list.appendChild(item);
  });
  list.scrollTop = list.scrollHeight;
}

function renderLog() {
  const log = $("#gameLog");
  log.innerHTML = "";
  state.room.log.slice().reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = `log-item ${item.tone}`;
    row.textContent = item.text;
    log.appendChild(row);
  });
}

function renderGame() {
  if (!state.room) return;
  $("#roomTitle").textContent = state.room.name;
  $("#roomMeta").textContent = `${state.room.players.length}/${state.room.maxPlayers} players · ${state.room.status} · code ${state.room.id}`;
  $("#invitePanel").innerHTML = `
    <code>${escapeHTML(state.room.id)}</code>
    <button id="copyInviteButton" class="chip-button" type="button">Copy invite link</button>
  `;
  $("#copyInviteButton").addEventListener("click", async () => {
    const link = roomUrl(state.room.id);
    try {
      await navigator.clipboard.writeText(link);
      toast("Invite link copied.");
    } catch {
      toast(link);
    }
  });
  $("#turnMessage").textContent = state.room.turnMessage || "Waiting for players.";
  const me = currentPlayer();
  $("#joinPanel").classList.toggle("hidden", Boolean(me) || state.room.status !== "lobby");
  $("#startGameButton").classList.toggle("hidden", !(me && me.id === state.room.hostId && state.room.status === "lobby"));
  const visibleDice = state.diceRolling ? state.rollingDice : state.room.currentRoll?.dice;
  $("#dicePanel").innerHTML = visibleDice ? visibleDice.map((die) => dieFace(die, "die")).join("") : `<span class="meta-line">No roll yet</span>`;
  renderBoard();
  renderPlayers();
  renderActions();
  renderAuction();
  renderAssets();
  renderTrade();
  renderChat();
  renderLog();
}

function bindEvents() {
  $$(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "lobby") {
        history.pushState({}, "", location.pathname);
        showView("lobby");
      } else {
        showView(button.dataset.view);
      }
    });
  });

  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPanel = button.dataset.panel;
      $$(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      ["assets", "trade", "chat", "log"].forEach((panel) => {
        $(`#${panel}Panel`).classList.toggle("hidden", panel !== state.selectedPanel);
      });
    });
  });

  $("#createRoomForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = await request("/api/rooms", {
      name: $("#roomNameInput").value || "Private Table",
      maxPlayers: Number($("#maxPlayersInput").value),
      playerName: $("#creatorNameInput").value || "Host"
    });
    const room = data.room || data;
    if (data.playerId) {
      state.playerId = data.playerId;
      localStorage.setItem("cc_player_id", state.playerId);
    }
    openRoom(room.id);
  });

  $("#refreshRoomsButton").addEventListener("click", async () => renderRooms(await request("/api/rooms")));

  $("#joinCodeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const roomId = extractRoomId($("#roomCodeInput").value);
    if (!roomId) return toast("Enter a room code or invite link.");
    openRoom(roomId).catch((error) => toast(error.message));
  });

  $("#joinRoomButton").addEventListener("click", async () => {
    const name = $("#playerNameInput").value || `Player ${Math.floor(Math.random() * 900) + 100}`;
    const data = await request(`/api/rooms/${state.room.id}/join`, { name });
    state.playerId = data.playerId;
    localStorage.setItem("cc_player_id", state.playerId);
    state.room = data.room;
    renderGame();
  });

  $("#startGameButton").addEventListener("click", () => roomAction("start"));

  $("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = $("#chatInput").value.trim();
    if (!text) return;
    $("#chatInput").value = "";
    roomAction("chat", { text });
  });

  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
  });
}

async function init() {
  initTheme();
  bindEvents();
  connectLobby();
  renderRooms(await request("/api/rooms"));
  if (state.roomId) openRoom(state.roomId).catch(() => showView("lobby"));
  else showView("lobby");
}

init();
