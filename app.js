import express from "express";
import { MemoryClient } from "mem0ai";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the Mem0 API connection instance using your dashboard keys
const mem0 = new MemoryClient({
  apiKey: process.env.MEM0_API_KEY
});

// Basic server uptime verification endpoints
app.get("/", (req, res) => res.status(200).send("Memory engine active."));
app.get("/health", (req, res) => res.status(200).send("ok"));

// =========================================================================
// ENDPOINT 1: FETCH PROPERTY HISTORY FROM MEM0
// =========================================================================
app.post("/retrieve-memories", async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number || phone_number === "unknown") {
      return res.status(200).json({ memories: "First session data fallback profile." });
    }

    console.log(`Searching profile metrics for phone number: ${phone_number}`);
    const history = await mem0.search({
      query: "general user profile details and real estate selection criteria",
      userId: phone_number
    });

    if (history && history.length > 0) {
      const flattenedFacts = history.map(item => item.memory).join("\n");
      return res.status(200).json({ memories: flattenedFacts });
    }
    return res.status(200).json({ memories: "First time caller profile." });
  } catch (error) {
    console.error("Retrieval Error:", error);
    return res.status(200).json({ memories: "Profile data retrieval timeout error fallback." });
  }
});

// =========================================================================
// ENDPOINT 2: SAVE ACTIVE LEAD INTERESTS TO MEM0
// =========================================================================
app.post("/add-memory", async (req, res) => {
  try {
    const { phone_number, message } = req.body;
    if (!phone_number || !message) {
      return res.status(200).json({ status: "missing required inputs" });
    }

    console.log(`Saving fresh fact metrics for ${phone_number}: "${message}"`);
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

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`====================================================`);
  console.log(`  Mem0 Engine Utility Node Active on Port ${port}   `);
  console.log(`====================================================`);
});
