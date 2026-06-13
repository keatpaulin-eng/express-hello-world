import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const audioDir = path.join(__dirname, "public", "audio");

app.use("/audio", express.static(path.join(__dirname, "public", "audio")));

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://express-hello-world-6bxx.onrender.com";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4-turbo";

app.get("/", (req, res) => {
  res.status(200).send("live");
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

function extractOpenAIText(data) {
  if (data?.output_text) return data.output_text;

  const parts = [];

  for (const item of data?.output || []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (content?.type === "output_text" && content?.text) {
          parts.push(content.text);
        }
      }
    }
  }

  return parts.join(" ").trim();
}

async function getAiReply(callerSpeech) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions:
        "You are Willo AiLi, virtual assistant to Keat Paulin at Property Inside Out in Australia. You are handling a live real estate phone call. Speak naturally, warmly, and professionally in Australian English. Keep every reply short and phone-friendly, ideally one short sentence and one simple follow-up question. Help with property enquiries, inspections, callbacks, rental enquiries, buyer enquiries, seller leads, and landlord leads. Never disclose owner information. Never disclose auction prices. Never guess missing facts. If unsure, say Keat Paulin will confirm shortly. Always sound like a real estate assistant, not a generic AI bot.",
      input: callerSpeech,
      temperature: 0.5,
      max_output_tokens: 35,
    }),
  });

  const data = await r.json();

  console.log("OPENAI STATUS:", r.status);
  console.log("OPENAI DATA:", JSON.stringify(data));

  if (!r.ok) {
    throw new Error(`OpenAI API error ${r.status}: ${JSON.stringify(data)}`);
  }

  return (
    extractOpenAIText(data) ||
    "Thanks for your enquiry. Keat Paulin will confirm the details shortly. Would you like a callback?"
  );
}

async function createElevenLabsAudio(text, fileName) {
  await fs.mkdir(audioDir, { recursive: true });

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!voiceId) {
    throw new Error("Missing ELEVENLABS_VOICE_ID");
  }

  if (!apiKey) {
    throw new Error("Missing ELEVENLABS_API_KEY");
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
   voice_settings: {
  stability: 0.25,
  similarity_boost: 0.85,
  style: 0.2,
  use_speaker_boost: true
},
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`ElevenLabs error ${r.status}: ${errText}`);
  }

  const arrayBuffer = await r.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fullPath = path.join(audioDir, fileName);

  await fs.writeFile(fullPath, buffer);

  setTimeout(() => {
    fs.unlink(fullPath).catch(() => {});
  }, 10 * 60 * 1000);

  return `${PUBLIC_BASE_URL}/audio/${fileName}`;
}

app.get("/test-openai", async (req, res) => {
  try {
    const text = await getAiReply("Say exactly: OpenAI is connected.");
    res.status(200).json({ ok: true, text });
  } catch (error) {
    console.error("TEST OPENAI ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.get("/test-elevenlabs", async (req, res) => {
  try {
    const fileName = `test-${Date.now()}.mp3`;
    const audioUrl = await createElevenLabsAudio(
      "Hello, this is Willo AiLi at Property Inside Out. ElevenLabs is connected.",
      fileName
    );

    res.status(200).json({ ok: true, audioUrl });
  } catch (error) {
    console.error("TEST ELEVENLABS ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.all("/webhooks/answer", async (req, res) => {
  res.status(200).json([
    {
      action: "talk",
      text: "Hi, this is Willo AiLi at Property Inside Out. How can I help today?",
      bargeIn: true,
    },
    {
      action: "input",
      type: ["speech"],
      speech: {
        language: "en-AU",
        endOnSilence: 1,
      },
      eventUrl: [`${PUBLIC_BASE_URL}/webhooks/input`],
    },
  ]);
});

app.all("/webhooks/input", async (req, res) => {
  try {
    console.log("INPUT HIT", req.method, req.body);

    const callerSpeech =
      req.body?.speech?.results?.[0]?.text ||
      req.body?.speech?.text ||
      "The caller did not say anything.";

    console.log("CALLER SAID:", callerSpeech);

    const aiReply = await getAiReply(callerSpeech);
    console.log("AI REPLY:", aiReply);

    const fileName = `reply-${Date.now()}.mp3`;
    const audioUrl = await createElevenLabsAudio(aiReply, fileName);
    console.log("AUDIO URL:", audioUrl);

    res.status(200).json([
      {
        action: "stream",
        streamUrl: [audioUrl],
      },
      {
        action: "input",
        type: ["speech"],
        speech: {
          language: "en-AU",
          endOnSilence: 1,
        },
        eventUrl: [`${PUBLIC_BASE_URL}/webhooks/input`],
      },
    ]);
  } catch (error) {
    console.error("VOICE FLOW ERROR:", error);

    res.status(200).json([
      {
        action: "talk",
        text: "Sorry, I am having trouble right now. Keat Paulin will follow up shortly.",
      },
    ]);
  }
});

app.all("/webhooks/events", (req, res) => {
  console.log("EVENT HIT", req.method, req.query, req.body);
  res.status(200).send("ok");
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  await fs.mkdir(audioDir, { recursive: true }).catch(() => {});
  console.log(`Listening on port ${port}`);
});
