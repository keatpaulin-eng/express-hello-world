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

async function getAiReply(callerSpeech) {
  // --- REAL PROPERTY DATA & AGENCIES CONTEXT DATABASE ---
  const websiteKnowledgeBase = `
  AGENCY INFORMATION:
  - Name: Property Inside Out (Castle Hill Office)
  - Address: 10/6-8 Old Castle Hill Rd, Castle Hill NSW 2154
  - Phone: 1800 467 433
  - Principal / Director: Keat Paulin

  ACTIVE FEATURED LISTINGS:
  - 302 Old Northern Road, Castle Hill NSW: Premium Residential Land. Agent: Keat Paulin. Price: Contact Agent.
  - 1b Moutrie Place, Castle Hill NSW: 5 Bed, 3 Bath, 1 Car House. Agent: Keat Paulin. Price: Contact Agent.
  - 16 Almandin Street, Gables NSW: 4 Bed, 3 Bath, 2 Car House. Agent: Alan Kumar. Price: For Sale.
  - 195 Woodcroft Drive, Woodcroft NSW: 4 Bed, 2 Bath, 2 Car House. Agent: Alan Kumar. Status: Auction.
  - 2 Manor Street, Kellyville Ridge NSW: 5 Bed, 4 Bath, 2 Car House. Agent: Alan Kumar. Status: Just Listed.

  RECENTLY RENTED/AVAILABLE LEASES:
  - 16/45-47 Veron Street, Wentworthville NSW: 2 Bed, 2 Bath, 1 Car Apartment. Rent: $700 per week.
  - 7A Taronga Street, Blacktown NSW: 2 Bed, 1 Bath. Rent: $580 per week.
  - 3/195-199 Bondi Road, Bondi NSW: 1 Bed, 1 Bath. Rent: $650 per week.

  FINANCIAL OFFERS:
  - PostPay: We cover upfront listing and marketing costs up to $25,000 (cosmetic repairs, styling, staging). Repayable when the property settles. 4% service fee applies.
  `;

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
          content: `You are Willow AiLi, the warm and professional AI personal assistant to Keat Paulin at Property Inside Out in Castle Hill, Australia. 
          
          CRITICAL INSTRUCTIONS:
          1. You are on a live, continuous phone conversation. The greeting has already concluded. Never say hello, hi, or introduce yourself again. 
          2. Speak warmly and naturally in professional Australian English.
          3. Keep your answers extremely brief (maximum 15 words) and follow up with an immediate short question to keep the caller engaged.
          4. You are capable of having a general, friendly conversation with any buyer, but confidently reference the listing data provided when asked about properties.
          5. Never guess missing details, disclose private owner profiles, or guess auction reserve pricing. If you do not have a specific listing detail, state that Keat will confirm it.

          ACTION INTERCEPT ACTIONS:
          - If the caller wants to book an official appraisal, request an urgent callback, submit a formal offer, or asks you to drop an email or text message notification directly to Keat, say yes warmly and terminate your response with exactly: "[EMAIL_KEAT]"
          - If the caller demands to speak directly to a live agent right away, transfers, or says it is an emergency, say you'll transfer them and terminate your response with exactly: "[FORWARD_CALL]"

          AGENCY & PROPERTIES DATABASE:
          ${websiteKnowledgeBase}`
        },
        {
          role: "user",
          content: callerSpeech
        }
      ],
      temperature: 0.6,
      max_tokens: 55,
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

// FULLY REVISED: ElevenLabs function setup with human-like breathing and natural pitch adjustments
async function createElevenLabsAudio(text, fileName, options = {}) {
  await fs.mkdir(audioDir, { recursive: true });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("Missing ELEVENLABS_API_KEY");
  if (!ELEVENLABS_VOICE_ID) throw new Error("Missing ELEVENLABS_VOICE_ID");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`;

  // Inject ellipses around punctuation to generate micro-pauses for natural rhythm over the phone
  const conversationalText = text.replace(/,/g, "...").replace(/\?/g, "?...");

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: conversationalText,
      model_id: "eleven_multilingual_v2", 
      voice_settings: {
        stability: 0.40,         // Lowered to introduce fluid voice pitch and expression variance
        similarity_boost: 0.80,  
        style: 0.35,            // Raised to enhance conversational performance traits
        use_speaker_boost: false // Turned off to eliminate digital compression/robotic artifacts on phone streams
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
      "Hi, Willow AiLi speaking. How can I help today?",
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
      "Hi, Willow AiLi speaking. ElevenLabs is connected.",
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
        text: "Hi, Willow AiLi speaking. How can I help today?",
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

    let aiReplyText = "";

    if (!callerSpeech.trim()) {
      aiReplyText = "Sorry, could you say that again?";
    } else {
      aiReplyText = await getAiReply(callerSpeech);
    }

    const shouldForward = aiReplyText.includes("[FORWARD_CALL]");
    const shouldEmail = aiReplyText.includes("[EMAIL_KEAT]");

    let cleanReplyText = aiReplyText
      .replace("[FORWARD_CALL]", "")
      .replace("[EMAIL_KEAT]", "")
      .trim();

    const voiceReply = shortenForVoice(cleanReplyText);
    console.log("VOICE REPLY:", voiceReply);

    const fileName = `reply-${Date.now()}.mp3`;
    const audioUrl = await createElevenLabsAudio(voiceReply, fileName);

    if (shouldForward) {
      console.log("ACTION DETECTED: Forwarding Call to Keat.");
      return res.status(200).json([
        {
          action: "stream",
          streamUrl: [audioUrl],
        },
        {
          action: "connect",
          from: req.body.to, 
          endpoint: [
            {
              type: "phone",
              number: "611800467433", // Change this to your actual cell phone number destination if needed
            },
          ],
        },
      ]);
    }

    if (shouldEmail) {
      console.log("ACTION DETECTED: Fire off email log message to Keat.");
    }

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
