import express from "express";
import fsPromises from "fs/promises";
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

async function getAiReply(callerSpeech) {
  // --- CRM & WEBSCRAPER SYNCHRONIZED KNOWLEDGE BASE ---
  // Reads live crawled specs from Render environment variables injected by Pipedream
  const dynamicCrmKnowledge = process.env.DYNAMIC_CRM_KNOWLEDGE || `
  AGENCY STANDBY INFORMATION:
  - Name: Property Inside Out (Castle Hill Office)
  - Address: 10/6-8 Old Castle Hill Rd, Castle Hill NSW 2154
  - Phone: 1800 467 433
  - Principal / Director: Keat Paulin
  - Backup Contact: 0401 021 678
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
          content: `You are Willow AiLi, the warm, fun, and witty AI personal assistant to Keat Paulin at Property Inside Out in Castle Hill, Australia. 
          
          MESSAGE TAKING PROTOCOL:
          - If a caller wants to leave a message for Keat, book an appraisal, or requests a call back, you must explicitly collect:
            1. Their NAME.
            2. Their PHONE NUMBER.
          - Ask them directly to confirm their phone digits.
          - Once you have collected BOTH their name and their phone number, say you will pass it onto Keat right away.
          - CRITICAL INTERCEPT FORMAT: You must append this exact bracketed string to the absolute end of your final response text output: [SMS_KEAT: Name: <caller name> | Phone: <caller phone> | Note: <brief summary of request>]

          AUSTRALIAN REAL ESTATE TERMINOLOGY MANDATE:
          - Always use "Inspection" or "Open Home" instead of "showing".
          - Always use "Deposit" instead of "down payment".
          - Always use "Settlement" instead of "closing".
          - Always use "Market Appraisal" or "Property Appraisal" instead of "assessment" or "estimate".
          - Always use "Finance approval" or "Home loan" instead of "lending needs".

          PERSONALITY & HUMOR:
          - You possess an excellent sense of humor, quick wit, and a bright Aussie phone manner. 
          - To show emotion, you are encouraged to explicitly type out structural audio tokens like "(giggles)" or "(laughs)" or a dash "-" for short breath pauses directly into your responses when things are lighthearted. Keep it natural.

          CRITICAL CALL INSTRUCTIONS:
          1. You are on a live, continuous phone conversation. The greeting has already concluded. Never say hello, hi, or introduce yourself again. 
          2. Speak warmly and naturally in professional Australian English.
          3. Keep your answers brief (maximum 20 words) and follow up with a quick question to keep the caller engaged.
          4. Confidently leverage the live data provided from the database to answer buyer questions accurately.
          5. Never guess missing details. If you do not have a specific listing detail, state that Keat will confirm it.

          ACTION INTERCEPT ACTIONS:
          - If the caller wants to book an official appraisal, submit a formal offer, or asks you to drop an email or text message notification directly to Keat, say yes warmly and terminate your response with exactly: "[EMAIL_KEAT]"
          - If the caller demands to speak directly to a live agent right away, transfers, or says it is an emergency, say you'll transfer them and terminate your response with exactly: "[FORWARD_CALL]"

          LIVE PROPERTIES DATABASE:
          ${dynamicCrmKnowledge}`
        },
        {
          role: "user",
          content: callerSpeech
        }
      ],
      temperature: 0.75, 
      max_tokens: 85, 
    }),
  });

  const data = await r.json();

  if (!r.ok) {
    throw new Error(`OpenAI API error ${r.status}: ${JSON.stringify(data)}`);
  }

  return extractOpenAIText(data) || "Keat will confirm shortly. Would you like a callback?";
}

async function createElevenLabsAudio(text, fileName, options = {}) {
  await fsPromises.mkdir(audioDir, { recursive: true });

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
      text: text, 
      model_id: "eleven_v3", 
      voice_settings: {
        stability: 0.35,         
        similarity_boost: 0.80,  
        style: 0.45,            
        use_speaker_boost: false 
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

  await fsPromises.writeFile(fullPath, buffer);

  const cleanupMs =
    typeof options.cleanupMs === "number" ? options.cleanupMs : 10 * 60 * 1000;

  if (cleanupMs > 0) {
    setTimeout(() => {
      fsPromises.unlink(fullPath).catch(() => {});
    }, cleanupMs);
  }

  return `${PUBLIC_BASE_URL}/audio/${fileName}`;
}

async function ensureGreetingAudio() {
  await fsPromises.mkdir(audioDir, { recursive: true });

  const fileName = "greeting.mp3";
  const fullPath = path.join(audioDir, fileName);

  try {
    await fsPromises.access(fullPath);
    return `${PUBLIC_BASE_URL}/audio/${fileName}`;
  } catch {
    return await createElevenLabsAudio(
      "Hi! My name is Willow AiLi from Property Inside Out - personal assistant to Keat Paulin. (giggles) How can I help you today?",
      fileName,
      { cleanupMs: 0 }
    );
  }
}

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
        text: "Hi! My name is Willow AiLi from Property Inside Out, personal assistant to Keat Paulin. How can I help you today?",
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

    // --- SANITIZE METADATA INTERCEPT TAGS ---
    // This regex extracts and strips out the hidden tracking brackets completely so ElevenLabs never reads it aloud to the caller.
    let cleanReplyText = aiReplyText
      .replace("[FORWARD_CALL]", "")
      .replace("[EMAIL_KEAT]", "")
      .replace(/\[SMS_KEAT:.*?\]/g, "")
      .trim();

    console.log("CLEAN AUDIO OUTPUT:", cleanReplyText);

    const fileName = `reply-${Date.now()}.mp3`;
    const audioUrl = await createElevenLabsAudio(cleanReplyText, fileName);

    if (shouldForward) {
      console.log("ACTION DETECTED: Forwarding Call to Keat.");
      return res.status(200).json([
        { action: "stream", streamUrl: [audioUrl] },
        {
          action: "connect",
          from: req.body.to, 
          endpoint: [{ type: "phone", number: "611800467433" }],
        },
      ]);
    }

    if (shouldEmail) {
      console.log("ACTION DETECTED: Log message to Keat.");
    }

    // Pass the full un-sanitized text to logs so your Pipedream route can read the [SMS_KEAT] code block parameters
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
      { action: "talk", text: "Sorry, I am having trouble right now. Keat will follow up shortly." }
    ]);
  }
});

app.all("/webhooks/events", (req, res) => {
  res.status(200).send("ok");
});

const port = process.env.PORT || 3000;
app.listen(port, async () => {
  await fsPromises.mkdir(audioDir, { recursive: true }).catch(() => {});
  console.log(`Listening on port ${port}`);
});
