import express from "express";
import { MemoryClient } from "mem0ai";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the Mem0 API connection instance using your dashboard keys
const mem0 = new MemoryClient({
  apiKey: process.env.MEM0_API_KEY
});

// Basic service validation links
app.get("/", (req, res) => res.status(200).send("live"));
app.get("/health", (req, res) => res.status(200).send("ok"));

// --- CUSTOM TOOL 1: FETCH PROFILE HISTORY BANCS ---
app.post("/retrieve-memories", async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number || phone_number === "unknown") {
      return res.status(200).json({ memories: "First session connection entry context." });
    }

    const history = await mem0.search({
      query: "general profile information and property selection criteria",
      userId: phone_number
    });

    if (history && history.length > 0) {
      const flattenedFacts = history.map(item => item.memory).join("\n");
      return res.status(200).json({ memories: flattenedFacts });
    }
    return res.status(200).json({ memories: "No past history found." });
  } catch (error) {
    console.error("Retrieval Error:", error);
    return res.status(200).json({ memories: "Profile extraction timeout error fallback." });
  }
});

// --- CUSTOM TOOL 2: SAVE ACTIVE CALL FACT DISCOVERIES ---
app.post("/add-memory", async (req, res) => {
  try {
    const { phone_number, message } = req.body;
    if (!phone_number || !message) {
      return res.status(200).json({ status: "missing fields" });
    }

    await mem0.add({
      text: message,
      userId: phone_number
    });
    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Storage Error:", error);
    return res.status(200).json({ status: "failed" });
  }
});

// --- VONAGE LIVE VOICE ENTRYPOINT LINK ---
app.all("/webhooks/answer", (req, res) => {
  const callerId = req.body.from || "unknown";
  const agentId = process.env.ELEVENLABS_AGENT_ID;

  // Render NCCO Response Object streaming voice directly over a secure WebSocket pipeline
  res.status(200).json([
    {
      action: "connect",
      endpoint: [
        {
          type: "websocket",
          url: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`,
          "content-type": "audio/l16;rate=16000",
          headers: {
            "X-Client-Phone": callerId
          }
        }
      ]
    }
  ]);
});

app.all("/webhooks/events", (req, res) => {
  res.status(200).send("ok");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Smart Server online via port ${port}`));
