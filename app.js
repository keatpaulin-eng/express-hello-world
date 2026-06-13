app.all("/webhooks/answer", async (req, res) => {
  const speech =
    "Hello, you have reached Willo AiLi, assistant to Keat Paulin at Property Inside Out. How can I help you today?";

  res.status(200).json([
    {
      action: "talk",
      text: speech,
      bargeIn: true
    },
    {
      action: "input",
      type: ["speech"],
      speech: {
        endOnSilence: 1,
        language: "en-AU"
      },
      eventUrl: ["https://express-hello-world-6bxx.onrender.com/webhooks/input"]
    }
  ]);
});

app.post("/webhooks/input", async (req, res) => {
  console.log("INPUT HIT", req.body);

  const transcript =
    req.body?.speech?.results?.[0]?.text ||
    "I did not catch that.";

  res.status(200).json([
    {
      action: "talk",
      text: `You said: ${transcript}. Keat will review this setup next.`
    }
  ]);
});
