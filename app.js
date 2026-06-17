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
  await fs.mkdir(audioDir, { recursive:
