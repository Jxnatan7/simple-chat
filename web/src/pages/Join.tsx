import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  TextField,
  Button,
  Paper,
  Typography,
} from "@mui/material";

export default function Join() {
  const [name, setName] = useState("");
  const navigate = useNavigate();

  function handleJoin() {
    const username = String(name || "Anônimo").slice(0, 30);
    navigate("/chat", { state: { username } });
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4 }} elevation={6}>
        <Typography variant="h5" component="h1" gutterBottom>
          Entrar no chat
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexDirection: "column" }}>
          <TextField
            label="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            fullWidth
            autoFocus
          />
          <Button
            variant="contained"
            onClick={handleJoin}
            disabled={!name.trim()}
          >
            Entrar
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
