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

function extractText(data) {
  return (
    data.output?.[0]?.content?.[0]?.text ||
    "Thanks for your enquiry. Keat Paulin will follow up shortly."
  );
}

async function getAiReply(callerSpeech) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      instructions:
        "You are Willo AiLi, virtual assistant to Keat Paulin at Property Inside Out in Australia. You are a real estate phone assistant. Speak naturally and clearly for a phone call. Use Australian English. Keep responses short. Be polite and professional. Help with property enquiries, inspections, callbacks, rental enquiries, buyer enquiries, seller leads, and landlord leads. Never disclose owner information. Never disclose auction prices. Never guess missing facts. If unsure, say Keat Paulin will confirm shortly. Offer a next step such as booking an inspection, arranging a callback, or taking details.",
      input: callerSpeech
    })
  });

  const data = await r.json();
  console.log("OPENAI STATUS:", r.status);
  console.log("OPENAI DATA:", JSON.stringify(data));

  if (!r.ok) {
    throw new Error(`OpenAI API error: ${r.status}`);
  }

  return extractText(data);
}

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

    res.status(200).json({
      status: r.status,
      text: extractText(data),
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
      text: "Hello, you have reached Willo AiLi, assistant to Keat Paulin at Property Inside Out. How can I help you with your property enquiry today?",
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

app.all("/webhooks/input", async (req, res) => {
  try {
    const callerSpeech =
      req.body?.speech?.results?.[0]?.text ||
      "The caller did not say anything.";

    console.log("CALLER SAID:", callerSpeech);

    const aiReply = await getAiReply(callerSpeech);

    res.status(200).json([
      {
        action: "talk",
        text: aiReply,
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
  } catch (error) {
    console.error("OPENAI ERROR:", error);
    res.status(200).json([
      {
        action: "talk",
        text: "Sorry, I am having trouble right now. Keat Paulin will follow up shortly."
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
