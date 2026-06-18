import express from "express";
import axios from "axios";

const app = express();

// Standard middleware to parse incoming JSON request payloads
app.use(express.json());

// Pull credentials securely from environment variables configured in Render
const MEM0_API_KEY = process.env.MEM0_API_KEY;

/**
 * Helper function to search for relevant memories inside Mem0
 * Uses direct HTTP REST endpoints to prevent Node client runtime library crashes.
 */
async function searchMemories(queryText, userId) {
  try {
    const response = await axios.post(
      "https://api.mem0.ai/v1/memories/search/",
      {
        query: queryText,
        user_id: userId,
      },
      {
        headers: {
          "Authorization": `Token ${MEM0_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    // Mem0 returns an array of memory objects containing a .memory string field
    return response.data || [];
  } catch (error) {
    console.error("Error fetching data from Mem0 API:", error.response?.data || error.message);
    return [];
  }
}

/**
 * Helper function to add/save a new interaction into Mem0 memory ledger
 */
async function addMemory(userMessage, assistantResponse, userId) {
  try {
    await axios.post(
      "https://api.mem0.ai/v1/memories/",
      {
        messages: [
          { role: "user", content: userMessage },
          { role: "assistant", content: assistantResponse }
        ],
        user_id: userId,
      },
      {
        headers: {
          "Authorization": `Token ${MEM0_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(`Successfully appended conversation turn to memory ledger for user: ${userId}`);
  } catch (error) {
    console.error("Failed to write memory string to Mem0:", error.response?.data || error.message);
  }
}

/**
 * Core ElevenLabs Tool Endpoint: Retrieve Memories
 * ElevenLabs calls this tool automatically via your configured Custom Tool URL.
 */
app.post("/retrieve-memories", async (req, res) => {
  console.log("Incoming tracking payload from ElevenLabs Agent:", req.body);

  // 1. Extract the unique dynamic caller ID passed forward through custom headers
  // Falls back to "default_user" if tested manually or header is missing
  const userId = req.headers["x-client-phone"] || "default_user";

  // 2. Safely capture the current conversation query string sent by ElevenLabs
  const queryText = req.body.query || "Fetch latest user preferences and profile context";

  console.log(`Searching profile history for phone track [${userId}] with query: "${queryText}"`);

  // 3. Fetch context strings matching the query from Mem0
  const memoriesRaw = await searchMemories(queryText, userId);

  // 4. Clean, format, and filter the memories into an elegant string context payload
  let dynamicContext = "No prior specific profile preferences recorded yet.";
  if (Array.isArray(memoriesRaw) && memoriesRaw.length > 0) {
    dynamicContext = memoriesRaw
      .map((m, index) => `${index + 1}. ${m.memory || m.text}`)
      .join("\n");
  }

  // 5. Return the exact response structure back to the ElevenLabs Agent
  return res.json({
    success: true,
    caller_phone: userId,
    retrieved_context: dynamicContext,
  });
});

/**
 * Optional Logging Endpoint to write new facts after a conversation turn completes
 */
app.post("/save-memory", async (req, res) => {
  const userId = req.headers["x-client-phone"] || "default_user";
  const { user_message, agent_response } = req.body;

  if (!user_message || !agent_response) {
    return res.status(400).json({ error: "Missing user_message or agent_response parameters" });
  }

  await addMemory(user_message, agent_response, userId);
  return res.json({ success: true });
});

// Basic Root Route to verify server health status
app.get("/", (req, res) => {
  res.send("Willo AiLi Processing Engine Online & Operational.");
});

// Bind server to Render's dynamic port assignment or default local testing port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Mem0 dynamic data ledger processing engine online via port ${PORT}`);
});
