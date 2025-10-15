import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Paper,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  Badge,
  Avatar,
  Button,
  Stack,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MessageList from "../components/MessageList";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export default function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username;

  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [text, setText] = useState<string>("");

  const [targetOwnerInput, setTargetOwnerInput] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    const onOpen = () => {
      setConnected(true);
    };

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        handleIncoming(data);
      } catch (e) {}
    };

    const onClose = () => {
      setConnected(false);
      setJoined(false);
      setRoomId(null);
      setOwner(null);
      setUsers([]);
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
    socket.addEventListener("error", onClose);

    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("error", onClose);
      try {
        socket.close();
      } catch (_) {}
      wsRef.current = null;
    };
  }, []);

  function handleIncoming(data: any) {
    if (!data || typeof data !== "object") return;

    if (data.type === "history") {
      setMessages(data.data || []);
      return;
    }

    if (data.type === "user_list") {
      setUsers(Array.isArray(data.users) ? data.users : []);
      if (data.roomId) setRoomId(data.roomId);
      if (data.owner) setOwner(data.owner);
      return;
    }

    if (data.type === "user_joined" || data.type === "user_left") {
      setMessages((m) => [...m, { ...data, ts: Date.now() }]);
      return;
    }

    if (data.type === "message") {
      setMessages((m) => [...m, data]);
      return;
    }

    if (data.type === "joined") {
      setJoined(true);
      setRoomId(data.roomId || null);
      setOwner(data.owner || null);
      return;
    }

    if (data.type === "error") {
      // opcional: exibir mensagem de erro para o usuário
      setMessages((m) => [
        ...m,
        { type: "system", text: data.message, ts: Date.now() },
      ]);
      return;
    }
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function sendRaw(obj: any) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(obj));
    return true;
  }

  function createRoomAsOwner() {
    if (!username) return;
    sendRaw({ type: "join", username });
  }

  function enterRoomOfOwner(targetOwner: string) {
    if (!username) return;
    const t = String(targetOwner || "").trim();
    if (!t) return;
    sendRaw({ type: "join", username, targetOwner: t });
  }

  function sendMessage() {
    if (!joined) return;
    if (!text.trim()) return;
    const payload = {
      type: "message",
      text: String(text || "").slice(0, 1000),
    };
    const sent = sendRaw(payload);
    if (sent) setText("");
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar>
          <Avatar sx={{ mr: 2 }}>{String(username || "A")[0]}</Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Chat — {username}
            {joined && owner ? ` (sala: ${roomId} — owner: ${owner})` : ""}
          </Typography>
          <Badge badgeContent={joined ? users.length : 0} color="secondary">
            <Typography>
              {joined ? `${users.length} online` : "não entrou"}
            </Typography>
          </Badge>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, gap: 2, p: 2 }}>
        <Paper
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - 128px)",
          }}
        >
          {!joined && (
            <Box sx={{ p: 2, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <Typography variant="subtitle1" gutterBottom>
                Entrar em uma sala
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={createRoomAsOwner}
                  disabled={!connected}
                >
                  Criar sala (ser owner)
                </Button>

                <TextField
                  size="small"
                  placeholder="Entrar na sala de (username do owner)"
                  value={targetOwnerInput}
                  onChange={(e) => setTargetOwnerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") enterRoomOfOwner(targetOwnerInput);
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => enterRoomOfOwner(targetOwnerInput)}
                  disabled={!connected || !targetOwnerInput.trim()}
                >
                  Entrar
                </Button>
              </Stack>

              <Typography
                variant="body2"
                sx={{ mt: 1, color: "text.secondary" }}
              >
                Observação: se o owner já tiver uma sala com 2 pessoas, será
                criada outra sala automaticamente.
              </Typography>
            </Box>
          )}

          <Box ref={listRef} sx={{ overflowY: "auto", p: 2, flex: 1 }}>
            <MessageList messages={messages} me={username} />
          </Box>

          <Divider />

          <Box sx={{ p: 2, display: "flex", gap: 1 }}>
            <TextField
              placeholder={
                joined
                  ? "Digite uma mensagem..."
                  : "Entre em uma sala para enviar mensagens"
              }
              fullWidth
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={!joined}
            />
            <IconButton
              color="primary"
              onClick={sendMessage}
              disabled={!joined || !text.trim()}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>

        <Paper
          sx={{
            width: 240,
            p: 2,
            height: "calc(100vh - 128px)",
            overflowY: "auto",
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Usuários da sala
          </Typography>
          <List>
            {users.map((u) => (
              <ListItem
                key={u}
                disablePadding
                secondaryAction={
                  !joined ? (
                    <Button
                      size="small"
                      onClick={() => {
                        if (!joined && u !== username) {
                          setTargetOwnerInput(u);
                          enterRoomOfOwner(u);
                        }
                      }}
                    >
                      Entrar
                    </Button>
                  ) : undefined
                }
              >
                <ListItemText primary={u} />
              </ListItem>
            ))}
            {users.length === 0 && (
              <Typography variant="body2">Nenhum usuário conectado</Typography>
            )}
          </List>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                try {
                  wsRef.current?.close();
                } catch (_) {}
                navigate("/");
              }}
              fullWidth
            >
              Sair
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
