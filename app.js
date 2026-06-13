import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).send("live");
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.all("/webhooks/answer", async (req, res) => {
  try {
    const caller = req.query.from || req.body?.from || "unknown caller";

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        input: [
          {
            role: "system",
            content: "You are Willo AiLi, assistant to Keat Paulin at Property Inside Out in Australia. Keep replies short, polite, and suitable for a phone greeting. Never disclose owner information. Never disclose auction prices."
          },
          {
            role: "user",
            content: `Answer this incoming phone call from ${caller}. Give a short spoken greeting and ask how you can help.`
          }
        ]
      }),
    });

    const data = await openaiRes.json();
    const speech =
      data.output_text ||
      "Hello, you have reached Willo AiLi for Property Inside Out. How can I help today?";

    console.log("OPENAI TEXT:", speech);

    res.status(200).json([
      {
        action: "talk",
        text: speech
      }
    ]);
  } catch (error) {
    console.error("OPENAI ERROR:", error);

    res.status(200).json([
      {
        action: "talk",
        text: "Hello, you have reached Willo AiLi for Property Inside Out. Please hold while we connect your call."
      }
    ]);
  }
});

app.all("/webhooks/events", (req, res) => {
  console.log("EVENT HIT", req.method, req.query, req.body);
  res.status(200).send("ok");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
