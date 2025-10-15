const WebSocket = require("ws");

const PORT = 8080;
const MAX_HISTORY = 50;
const HEARTBEAT_INTERVAL_MS = 30_000;

class ChatServer {
  constructor(port) {
    this.port = port;
    this.wss = new WebSocket.Server({ port: this.port });
    this.history = [];
    this.heartbeatInterval = null;

    this.attachServerEvents();
    this.startHeartbeat();
    this.logServerStarted();
  }

  attachServerEvents() {
    this.wss.on("connection", (ws, req) => this.onConnection(ws, req));
    this.wss.on("close", () => this.onClose());
  }

  onConnection(ws) {
    this.markAlive(ws);
    ws.on("pong", () => this.markAlive(ws));

    this.sendInitialHistory(ws);

    ws.on("message", (raw) => this.onMessage(ws, raw));
    ws.on("close", () => this.onCloseClient(ws));
    ws.on("error", () => this.onError(ws));
  }

  markAlive(ws) {
    ws.isAlive = true;
  }

  sendInitialHistory(ws) {
    this.send(ws, { type: "history", data: this.history });
  }

  onMessage(ws, raw) {
    const data = this.safeParse(raw);
    if (!data) return;

    if (data.type === "join") {
      this.handleJoin(ws, data);
      return;
    }

    if (data.type === "message") {
      this.handleChatMessage(ws, data);
      return;
    }
  }

  handleJoin(ws, data) {
    ws.username = this.sanitizeUsername(data.username);
    this.broadcast({ type: "user_joined", username: ws.username }, ws);
    this.sendUserList();
  }

  handleChatMessage(ws, data) {
    const chat = {
      type: "message",
      username: ws.username || "Anônimo",
      text: this.sanitizeText(data.text),
      ts: Date.now(),
    };

    this.saveHistory(chat);
    this.broadcast(chat);
  }

  onCloseClient(ws) {
    this.broadcast({ type: "user_left", username: ws.username }, ws);
    this.sendUserList();
  }

  onError() {}

  safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  sanitizeUsername(name) {
    const str = String(name || "Anônimo");
    return str.slice(0, 30);
  }

  sanitizeText(text) {
    return String(text || "").slice(0, 1000);
  }

  saveHistory(chat) {
    this.history.push(chat);
    this.pruneHistoryIfNeeded();
  }

  pruneHistoryIfNeeded() {
    while (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  broadcast(obj, except = null) {
    const str = JSON.stringify(obj);
    this.wss.clients.forEach((client) => {
      if (client === except) return;
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(str);
    });
  }

  send(ws, obj) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  sendUserList() {
    const users = [...this.wss.clients]
      .filter((c) => c.username)
      .map((c) => c.username);

    this.broadcast({ type: "user_list", users });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(
      () => this.checkHeartbeat(),
      HEARTBEAT_INTERVAL_MS
    );
  }

  checkHeartbeat() {
    this.wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      try {
        ws.ping(() => {});
      } catch (_) {
        ws.terminate();
      }
    });
  }

  onClose() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  logServerStarted() {
    console.log(`WebSocket server running on ws://localhost:${this.port}`);
  }
}

new ChatServer(PORT);
