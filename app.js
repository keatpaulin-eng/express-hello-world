import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Voice Bridge running");
});

app.post("/webhooks/answer", (req, res) => {
  const ncco = [
    { action: "talk", text: "Hello, please speak. This call is now connected." },
    {
      action: "connect",
      endpoint: [
        {
          type: "websocket",
          uri: `wss://${req.headers.host}/ws`,
          contentType: "audio/l16;rate=16000",
          headers: { "X-Source": "vonage" }
        }
      ]
    }
  ];
  res.json(ncco);
});

app.post("/webhooks/events", (req, res) => {
  console.log("Vonage event:", req.body);
  res.sendStatus(200);
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  console.log("🔌 Vonage WebSocket connected");

  ws.on("message", (audio) => {
    ws.send(audio); // echo test
  });

  ws.on("close", () => {
    console.log("❌ Vonage WebSocket disconnected");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
