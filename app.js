import express from "express";
import { MemoryClient } from "mem0ai"; // Official Mem0 Platform Node.js SDK

const app = express();

// Enable parsing of standard JSON and URL-encoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- INITIALIZE MEM0 CLIENT ---
// Pulls your API key securely from your Render Environment Variables
const mem0 = new MemoryClient({
  apiKey: process.env.MEM0_API_KEY
});

// Basic health check routes to ensure Render keeps the app active
app.get("/", (req, res) => res.status(200).send("live"));
app.get("/health", (req, res) => res.status(200).send("ok"));

// =========================================================================
// TOOL 1: RETRIEVE MEMORIES (Called by ElevenLabs at the start of a call)
// =========================================================================
app.post("/retrieve-memories", async (req, res) => {
  try {
    const { phone_number } = req.body;
    
    if (!phone_number || phone_number === "unknown") {
      console.log("Mem0 Retrieval Warning: No caller phone number provided.");
      return res.status(200).json({ memories: "No prior registration data found." });
    }

    console.log(`Searching Mem0 context for phone: ${phone_number}`);
    
    // Query Mem0's vector memory cluster for facts tied specifically to this phone number
    const history = await mem0.search({
      query: "general user profile, client name, and property criteria",
      userId: phone_number
    });

    if (history && history.length > 0) {
      // Flatten the individual extracted bullet point memories into a single string for the AI
      const flattenedFacts = history.map(item => item.memory).join("\n");
      console.log(`Memories Found:\n${flattenFacts}`);
      return res.status(200).json({ memories: flattenedFacts });
    }
    
    console.log("No existing memories found for this caller.");
    return res.status(200).json({ memories: "First time caller profile. No past history." });
  } catch (error) {
    console.error("Mem0 Retrieval Error:", error);
    // Gracefully fail back with a safe fallback string so ElevenLabs doesn't crash mid-call
    return res.status(200).json({ memories: "Error accessing user profile history." });
  }
});

// =========================================================================
// TOOL 2: ADD MEMORY (Called by ElevenLabs mid-conversation to save facts)
// =========================================================================
app.post("/add-memory", async (req, res) => {
  try {
    const { phone_number, message } = req.body;

    if (!phone_number || !message) {
      console.log("Mem0 Add Memory Error: Missing required payload properties.");
      return res.status(200).json({ status: "invalid parameters" });
    }

    console.log(`Adding new fact to Mem0 for ${phone_number}: "${message}"`);

    // Add the raw statement text. Mem0 automatically runs its background algorithm 
    // to clean it, check for duplicates, and update existing entries.
    await mem0.add({
      text: message,
      userId: phone_number
    });

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Mem0 Storage Error:", error);
    return res.status(200).json({ status: "failed", error: error.message });
  }
});

// =========================================================================
// VONAGE GATEWAY: INBOUND CALL ROUTING (Streams raw phone audio)
// =========================================================================
app.all("/webhooks/answer", (req, res) => {
  // Vonage can hit this via GET query parameters or a POST request body.
  // We check both layouts safely to capture the caller's number.
  const callerId = req.query.from || req.body?.from || "unknown";
  const systemNumber = req.query.to || req.body?.to || "Vonage";
  
  console.log(`Inbound phone call connection request received from: ${callerId}`);

  // Retrieve your ElevenLabs Agent ID from your Render environment variables
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    console.error("CRITICAL CONFIG ERROR: ELEVENLABS_AGENT_ID environment variable is missing!");
  }

  // EXACT NCCO SPECIFICATION REQUIRED BY VONAGE TELEPHONY FOR WEBSOCKET CHANNELS
  res.status(200).json([
    {
      action: "connect",
      from: systemNumber, // Required top-level field for Vonage connection actions
      endpoint: [
        {
          type: "websocket",
          uri: `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`, // Must be explicit "uri"
          "content-type": "audio/l16;rate=16000",
          headers: {
            // Forward the phone number as a custom header so ElevenLabs can read it inside tools
            "X-Client-Phone": callerId
          }
        }
      ]
    }
  ]);
});

// Log metadata tracking events sent by Vonage
app.all("/webhooks/events", (req, res) => {
  res.status(200).send("ok");
});

// Start the server instance
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`====================================================`);
  console.log(`  Smart Voice & Memory Bridge App Live on Port ${port} `);
  console.log(`====================================================`);
});
