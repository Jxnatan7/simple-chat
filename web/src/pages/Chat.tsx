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
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MessageList from "../components/MessageList";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export default function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username;

  const [ws, setWs] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [text, setText] = useState<string>("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!username) {
      navigate("/");
      return;
    }

    const socket = new WebSocket(WS_URL);
    setWs(socket);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join", username }));
    });

    socket.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        handleIncoming(data);
      } catch (e) {}
    });

    socket.addEventListener("close", () => {});

    return () => socket.close();
  }, []);

  function handleIncoming(data: any) {
    if (data.type === "history") {
      setMessages(data.data || []);
      return;
    }

    if (data.type === "user_list") {
      setUsers(data.users || []);
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
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function sendMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = {
      type: "message",
      text: String(text || "").slice(0, 1000),
    };
    ws.send(JSON.stringify(payload));
    setText("");
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static">
        <Toolbar>
          <Avatar sx={{ mr: 2 }}>{String(username || "A")[0]}</Avatar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Chat — {username}
          </Typography>
          <Badge badgeContent={users.length} color="secondary">
            <Typography>{users.length} online</Typography>
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
          <Box ref={listRef} sx={{ overflowY: "auto", p: 2 }}>
            <MessageList messages={messages} me={username} />
          </Box>

          <Divider />

          <Box sx={{ p: 2, display: "flex", gap: 1 }}>
            <TextField
              placeholder="Digite uma mensagem..."
              fullWidth
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <IconButton
              color="primary"
              onClick={sendMessage}
              disabled={!text.trim()}
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
            Usuários
          </Typography>
          <List>
            {users.map((u) => (
              <ListItem key={u} disablePadding>
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
