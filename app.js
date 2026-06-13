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

app.get("/test-openai", async (req, res) => {
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4-turbo",
        instructions: "Reply with exactly: OpenAI is connected.",
        input: "Test connection"
      })
    });

    const data = await r.json();

    console.log("OPENAI STATUS:", r.status);
    console.log("OPENAI DATA:", JSON.stringify(data));

    res.status(200).json({
      status: r.status,
      output_text: data.output_text || null,
      raw: data
    });
  } catch (err) {
    console.error("TEST OPENAI ERROR:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.all("/webhooks/answer", (req, res) => {
  res.status(200).json([
    {
      action: "talk",
      text: "Hello, this is a connection test."
    }
  ]);
});

app.all("/webhooks/events", (req, res) => {
  console.log("EVENT HIT", req.method, req.query, req.body);
  res.status(200).send("ok");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
