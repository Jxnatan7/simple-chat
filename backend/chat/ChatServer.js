const WebSocket = require("ws");

const PORT = 8080;
const MAX_HISTORY = 50;
const HEARTBEAT_INTERVAL_MS = 30_000;

class ChatServer {
  constructor(port) {
    this.port = port;
    this.wss = new WebSocket.Server({ port: this.port });

    this.rooms = new Map();
    this.nextRoomId = 1;

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

    // Não enviamos histórico global — só após o join na sala
    ws.on("message", (raw) => this.onMessage(ws, raw));
    ws.on("close", () => this.onCloseClient(ws));
    ws.on("error", () => this.onError(ws));
  }

  markAlive(ws) {
    ws.isAlive = true;
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
    const targetOwner = data.targetOwner
      ? String(data.targetOwner).slice(0, 30)
      : null;

    if (!targetOwner || targetOwner === ws.username) {
      const room = this.createRoom(ws.username);
      this.joinRoom(ws, room.id);
      this.send(ws, { type: "joined", roomId: room.id, owner: room.owner });
      this.send(ws, { type: "history", data: room.history });
      this.sendRoomUserList(room);
      return;
    }

    let room = this.findAvailableRoom(targetOwner);
    if (!room) {
      room = this.createRoom(targetOwner);
    }

    this.joinRoom(ws, room.id);
    this.send(ws, { type: "joined", roomId: room.id, owner: room.owner });
    this.send(ws, { type: "history", data: room.history });
    this.sendRoomUserList(room);

    // notificar room que alguém entrou
    this.broadcastRoom(
      room.id,
      { type: "user_joined", username: ws.username },
      ws
    );
  }

  handleChatMessage(ws, data) {
    const roomId = ws.roomId;
    if (!roomId) {
      this.send(ws, {
        type: "error",
        message: "Você precisa entrar em uma sala antes de enviar mensagens.",
      });
      return;
    }
    const room = this.rooms.get(roomId);
    if (!room) {
      this.send(ws, { type: "error", message: "Sala inexistente." });
      return;
    }

    const chat = {
      type: "message",
      username: ws.username || "Anônimo",
      text: this.sanitizeText(data.text),
      ts: Date.now(),
    };

    room.history.push(chat);
    this.pruneRoomHistoryIfNeeded(room);
    this.broadcastRoom(room.id, chat);
  }

  createRoom(owner) {
    const id = String(this.nextRoomId++);
    const room = {
      id,
      owner,
      participants: new Set(),
      history: [],
    };
    this.rooms.set(id, room);
    return room;
  }

  findAvailableRoom(owner) {
    for (const room of this.rooms.values()) {
      if (room.owner === owner && room.participants.size === 1) {
        return room;
      }
    }
    return null;
  }

  joinRoom(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (ws.roomId && ws.roomId !== roomId) {
      this.leaveRoom(ws);
    }

    room.participants.add(ws);
    ws.roomId = roomId;
  }

  leaveRoom(ws) {
    const roomId = ws.roomId;
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (!room) {
      delete ws.roomId;
      return;
    }

    room.participants.delete(ws);
    delete ws.roomId;

    this.broadcastRoom(roomId, { type: "user_left", username: ws.username });

    this.sendRoomUserList(room);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  onCloseClient(ws) {
    this.leaveRoom(ws);
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

  pruneRoomHistoryIfNeeded(room) {
    while (room.history.length > MAX_HISTORY) {
      room.history.shift();
    }
  }

  broadcastRoom(roomId, obj, except = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const str = JSON.stringify(obj);
    for (const client of room.participants) {
      if (client === except) continue;
      if (client.readyState !== WebSocket.OPEN) continue;
      client.send(str);
    }
  }

  send(ws, obj) {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }

  sendRoomUserList(room) {
    if (!room) return;
    const users = [...room.participants]
      .filter((c) => c.username)
      .map((c) => c.username);
    const payload = {
      type: "user_list",
      users,
      roomId: room.id,
      owner: room.owner,
    };
    this.broadcastRoom(room.id, payload);
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
