app.all("/webhooks/answer", async (req, res) => {
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

app.post("/webhooks/input", async (req, res) => {
  try {
    const callerSpeech =
      req.body?.speech?.results?.[0]?.text ||
      "The caller did not say anything.";

    console.log("CALLER SAID:", callerSpeech);

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
            content: `You are Willo AiLi, virtual assistant to Keat Paulin at Property Inside Out in Australia.

You are a real estate phone assistant.

Rules:
- Speak naturally and clearly for a phone call
- Use Australian English
- Keep responses short
- Be polite and professional
- Help with property enquiries, inspections, callbacks, rental enquiries, buyer enquiries, seller leads, and landlord leads
- Never disclose owner information
- Never disclose auction prices
- Never guess missing facts
- If unsure, say Keat Paulin will confirm shortly
- Offer a next step such as booking an inspection, arranging a callback, or taking details

You are not a generic AI assistant. You are a real estate assistant for Property Inside Out.`
          },
          {
            role: "user",
            content: callerSpeech
          }
        ]
      }),
    });

    const data = await openaiRes.json();
    const speech =
      data.output_text ||
      "Thanks for your enquiry. Keat Paulin will confirm the details shortly. Would you like to arrange a callback or inspection?";

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
  } catch (error) {
    console.error("OPENAI ERROR:", error);

    res.status(200).json([
      {
        action: "talk",
        text: "Sorry, I am having trouble right now. Please hold and Keat Paulin will follow up shortly."
      }
    ]);
  }
});
