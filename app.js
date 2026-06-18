import express from "express";
import { MemoryClient } from "mem0ai";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core link to your Mem0 memory ledger account
const mem0 = new MemoryClient({
  apiKey: process.env.MEM0_API_KEY
});

app.get("/", (req, res) => res.status(200).send("Mem0 Bridge Active"));
app.get("/health", (req, res) => res.status(200).send("ok"));

// --- CUSTOM EXTRACTOR TOOL: RETRIEVE MEMORIES ---
app.post("/retrieve-memories", async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) return res.status(200).json({ memories: "New profile query entry context." });

    const history = await mem0.search({
      query: "general client name and real estate property selection requirements",
      userId: phone_number
    });

    if (history && history.length > 0) {
      const flattenedFacts = history.map(item => item.memory).join("\n");
      return res.status(200).json({ memories: flattenedFacts });
    }
    return res.status(200).json({ memories: "First time contact record." });
  } catch (error) {
    return res.status(200).json({ memories: "Timeout database fallback string." });
  }
});

// --- CUSTOM STORAGE TOOL: SAVE NEW DATA ---
app.post("/add-memory", async (req, res) => {
  try {
    const { phone_number, message } = req.body;
    if (!phone_number || !message) return res.status(200).json({ status: "invalid parameters" });

    await mem0.add({ text: message, userId: phone_number });
    return res.status(200).json({ status: "success" });
  } catch (error) {
    return res.status(200).json({ status: "failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Mem0 dynamic data ledger processing engine online via port ${port}`));
