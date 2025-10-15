import { Box, Typography, Paper } from "@mui/material";

function formatTime(ts: number) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch (_) {
    return "";
  }
}

export default function MessageList({
  messages = [],
  me,
}: {
  messages: any[];
  me: string;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {messages.map((m, i) => {
        if (m.type === "user_joined" || m.type === "user_left") {
          return (
            <Typography key={i} variant="caption" align="center">
              {m.type === "user_joined"
                ? `${m.username} entrou`
                : `${m.username} saiu`}
            </Typography>
          );
        }

        const mine = m.username === me;
        return (
          <Box
            key={i}
            sx={{
              display: "flex",
              justifyContent: mine ? "flex-end" : "flex-start",
            }}
          >
            <Paper sx={{ p: 1.25, maxWidth: "75%" }} elevation={2}>
              <Typography variant="subtitle2">{m.username}</Typography>
              <Typography variant="body1">{m.text}</Typography>
              <Typography
                variant="caption"
                display="block"
                sx={{ textAlign: "right" }}
              >
                {formatTime(m.ts)}
              </Typography>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}
