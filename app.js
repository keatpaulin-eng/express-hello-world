import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
app.use(express.json());

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.send("AI Voice Bridge running");
});

/**
 * Vonage ANSWER webhook
 * Vonage hits this when a call is answered
 */
app.post("/webhooks/answer", (req, res) => {
  const ncco = [
    {
      action: "talk",
      text: "Hello, please speak. This call is now connected."
    },
    {
      action: "connect",
      endpoint: [
        {
          type: "websocket",
          uri: `wss://${req.headers.host}/ws`,
          contentType: "audio/l16;rate=16000",
          headers: {
            "X-Source": "vonage"
          }
        }
      ]
    }
  ];

  res.json(ncco);
});

/**
 * Vonage EVENT webhook
 */
app.post("/webhooks/events", (req, res) => {
  console.log("Vonage event:", req.body);
  res.sendStatus(200);
});

/**
 * HTTP server
 */
const server = http.createServer(app);

/**
 * WebSocket server
 * This is the real-time audio bridge
 */
const wss = new WebSocketServer({
  server,
  path: "/ws"
});

wss.on("connection", (ws) => {
  console.log("🔌 Vonage WebSocket connected");

  ws.on("message", (audio) => {
    // For now: echo audio back
    // Next step: route to GPT-4o realtime + ElevenLabs
    ws.se
