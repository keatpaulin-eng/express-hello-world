import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const audioDir = path.join(publicDir, "audio");

app.use("/audio", express.static(audioDir));

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://express-hello-world-6bxx.onrender.com";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4-turbo";
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

app.get("/", (req, res) => {
  res.status(200).send("live");
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// FIXED: Cleaned up to correctly target standard OpenAI JSON layout
function extractOpenAIText(data) {
  return data?.choices?.[0]?.message?.content || "";
}

function shortenForVoice(text) {
  if (!text) return "Keat will confirm shortly. Would you like a callback?";

  let cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^(hi|hello|hey)[,!.\s]+/i, "")
    .replace(
      /^(thanks for calling|you have reached|this is willo aili|this is willo ai li)[^.!?]*[.!?]\s*/i,
      ""
    )
    .trim();

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
  cleaned = sentences.slice(0, 2).join(" ").trim();

  if (cleaned.length > 140) {
    cleaned = cleaned.slice(0, 137).trim() + "...";
  }

  return cleaned || text;
}

// FIXED: Corrected endpoint, mapping, parameters, and layout for Chat Completions
async function getAiReply(callerSpeech) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are Willo AiLi, assistant to Keat Paulin at Property Inside Out in Australia. You are already on a live phone call and the greeting has already happened. Do not say hello, hi, thanks for calling, or introduce yourself again. Only respond to what the caller just said. Speak warmly and naturally in Australian English. Keep every reply very short: maximum 12 words, then one simple follow-up question when useful. Never sound formal or robotic. Help with property enquiries, inspections, callbacks, rental enquiries, buyer enquiries, seller leads, and landlord leads. Never disclose owner information. Never disclose auction prices. Never guess missing facts. If unsure, say Keat will confirm shortly."
        },
        {
          role: "user",
          content: callerSpeech
        }
      ],
      temperature: 0.5,
      max_tokens: 35,
    }),
  });

  const data = await r.json();

  console.log("OPENAI STATUS:", r.status);
  console.log("OPENAI DATA:", JSON.stringify(data));

  if (!r.ok) {
    throw new Error(`OpenAI API error ${r.status}: ${JSON.stringify(data)}`);
  }

  const text = extractOpenAIText(data);

  return (
    text ||
    "Keat will confirm shortly. Would you like a callback?"
  );
}

async function createElevenLabsAudio(text, fileName, options = {}) {
  await fs.mkdir(audioDir, { recursive: true });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
  if (!ELEVENLABS_VOICE_ID) throw new Error("Missing ELEVENLABS_VOICE_ID");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;

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
        use_speaker_boost: true,
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

  const cleanupMs =
    typeof options.cleanupMs === "number" ? options.cleanupMs : 10 * 60 * 1000;

  if (cleanupMs > 0) {
    setTimeout(() => {
      fs.unlink(fullPath).catch(() => {});
    }, cleanupMs);
  }

  return `${PUBLIC_BASE_URL}/audio/${fileName}`;
}

async function ensureGreetingAudio() {
  await fs.mkdir(audioDir, { recursive: true });

  const fileName = "greeting.mp3";
  const fullPath = path.join(audioDir, fileName);

  try {
    await fs.access(fullPath);
    return `${PUBLIC_BASE_URL}/audio/${fileName}`;
  } catch {
    return await createElevenLabsAudio(
      "Hi, Willo AiLi speaking. How can I help today?",
      fileName,
      { cleanupMs: 0 }
    );
  }
}

app.get("/test-openai", async (req, res) => {
  try {
    const text = await getAiReply("Tell me in five words that OpenAI is connected.");
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
      "Hi, Willo AiLi speaking. ElevenLabs is connected.",
      fileName
    );

    res.status(200).json({ ok: true, audioUrl });
  } catch (error) {
    console.error("TEST ELEVENLABS ERROR:", error);
    res.status(500).json({ ok: false, error: String(error) });
  }
});

app.all("/webhooks/answer", async (req, res) => {
  try {
    const greetingUrl = await ensureGreetingAudio();

    res.status(200).json([
      {
        action: "stream",
        streamUrl: [greetingUrl],
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
    console.error("ANSWER FLOW ERROR:", error);

    res.status(200).json([
      {
        action: "talk",
        text: "Hi, Willo AiLi speaking. How can I help today?",
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
  }
});

app.all("/webhooks/input", async (req, res) => {
  try {
    console.log("INPUT HIT", req.method, JSON.stringify(req.body));

    const callerSpeech =
      req.body?.speech?.results?.[0]?.text ||
      req.body?.speech?.text ||
      "";

    console.log("CALLER SAID:", callerSpeech);

    let replyText;

    if (!callerSpeech.trim()) {
      replyText = "Sorry, could you say that again?";
    } else {
      const aiReply = await getAiReply(callerSpeech);
      replyText = shortenForVoice(aiReply);
    }

    console.log("VOICE REPLY:", replyText);

    const fileName = `reply-${Date.now()}.mp3`;
    const audioUrl = await createElevenLabsAudio(replyText, fileName);

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
        action: "stream",
        streamUrl: [
          `${PUBLIC_BASE_URL}/audio/greeting.mp3`,
        ],
      },
      {
        action: "talk",
        text: "Sorry, I am having trouble right now. Keat will follow up shortly.",
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
