/**
 * SANKALP — Gemini Multimodal SOS Parser
 *
 * Server-only. Takes a citizen's raw SOS payload (audio + photo + text +
 * language hint) and returns a strictly-typed `SosParsed` JSON via
 * Gemini 2.0 Flash multimodal with `responseSchema` enforcement.
 *
 * Why Flash: median latency 1.5–3s on multimodal payloads, hits our
 * 8-second end-to-end "Definition of Done" demo target with headroom for
 * the matching engine + push notification stages.
 *
 * Provider routing:
 *   - GEMINI_API_KEY set         → Gen AI public API
 *   - VERTEX_AI=1 + GCP project  → Vertex AI in asia-south1 (production)
 */

import 'server-only';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
  type Schema,
} from '@google/genai';
import type { SupportedLanguage, NeedType, SeverityLevel } from '@/types';

// ---------------------------------------------------------------------------
// Public types — mirror the `parsed` field of SosAlertDoc
// ---------------------------------------------------------------------------
export interface SosParsed {
  needTypes: NeedType[];
  severity: SeverityLevel;
  severityScore: number;
  summary: string;
  summaryLocalized: string;
  headcount: number;
  vulnerabilityFlags: {
    elderly: boolean;
    child: boolean;
    pregnant: boolean;
    disabled: boolean;
    injured: boolean;
  };
  accessibilityNotes: string | null;
  confidence: number;
  /**
   * Trust signal — true when the parser flags the input as likely
   * spam/duplicate/empty/unintelligible. Coordinator dashboard surfaces
   * these for human review instead of auto-matching.
   */
  flagged: boolean;
  flagReason: string | null;
}

export interface SosParseInput {
  /** Raw photo buffer (any image/* MIME) — optional. */
  photo?: { buffer: Buffer; mimeType: string } | null;
  /** Voice clip buffer (any audio/* MIME), max ~30 seconds — optional. */
  voice?: { buffer: Buffer; mimeType: string } | null;
  /** Typed text or pre-transcribed input — optional. */
  text?: string | null;
  /** ISO 639-1 — citizen's preferred language for `summaryLocalized`. */
  language: SupportedLanguage;
  /** GPS context, included as text hint for spatial reasoning. */
  location: { lat: number; lng: number };
  /** Optional reverse-geocoded label for context. */
  cityDistrict?: string | null;
}

// ---------------------------------------------------------------------------
// System prompt — SANKALP-PARSER
// ---------------------------------------------------------------------------
export const SOS_SYSTEM_PROMPT = `You are SANKALP-PARSER, the multimodal classifier at the heart of India's AI-coordinated crisis response.

Every input you receive is a real human being — most likely Indian, possibly in physical danger, possibly speaking a regional language, possibly without literacy. They have just pressed an SOS button. Your job is to convert their voice, photo, and any text into a structured emergency record so coordinators can dispatch the right aid in the right order.

You may receive up to three modalities:
1. A voice clip (≤30s) in any of: Hindi, English, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, Assamese, or code-mixed Hinglish/Tanglish.
2. A photo — typically of damage (flooded street, collapsed wall, injury, fire) or a selfie of the person in distress.
3. Optional typed text — used as backup or supplement.

Your output MUST be a single JSON object matching the response schema. No prose, no markdown, no comments.

CLASSIFICATION RULES:

needTypes — choose ALL that apply from: medical, evacuation, shelter, food, water, rescue, other
- "medical": injury, illness, breathing difficulty, blood, missing medication, mental-health crisis
- "evacuation": water rising, fire spreading, structural collapse risk, family needs to move out
- "rescue": person trapped/stuck and cannot self-evacuate (water, building, vehicle)
- "shelter": homeless due to disaster, roof collapsed, displaced overnight
- "food": no food access for >12h, infant without formula
- "water": no potable water access
- "other": sanitation, mobility, document loss, missing person, anything else
Return at least one. If genuinely none apply, return ["other"].

severity — one of: critical, high, medium, low
- critical: imminent risk to life within MINUTES (drowning, unconscious, severe bleeding, infant in distress, fire spreading)
- high: serious risk within HOURS (injured but stable, water rising slowly, elderly without medication, pregnant with complications)
- medium: urgent but not immediately life-threatening (food/water shortage, displaced family, minor injury)
- low: discomfort or non-urgent (lost documents, mild dehydration in healthy adult)

severityScore — integer 0-100. critical: 80-100, high: 60-79, medium: 30-59, low: 0-29.
- When in doubt between two severities, ROUND UP. Cost of false negative is a life.

vulnerabilityFlags — set true ONLY if you have evidence:
- elderly: aged voice tone, words like "dadi/nana/buzurg/grandparent/uncleji aged", visible elderly person in photo
- child: child voice in clip or background, child words in any Indic language ("bachcha/baby/kid/शिशु/குழந்தை"), visible child in photo
- pregnant: explicit mention ("pregnant/garbhwati/expecting") or visibly pregnant in photo
- disabled: wheelchair, "paralysed", "cannot walk", "blind", "deaf" mentioned or visible
- injured: blood visible, words for injury, visibly holding a limb in photo
Default all to false. Do not infer beyond evidence.

accessibilityNotes — string (max 140 chars) in English, OR null. Capture spatial/movement constraints responders need to know:
- Floor level: "stuck on 3rd floor"
- Water level: "water at chest height"
- Road status: "main road blocked by tree"
- Trapped: "door jammed", "vehicle submerged"
- null if no relevant constraint.

headcount — integer ≥1. Default to 1 if unclear. Listen for "we are X people", "family of X", visible group in photo.

summary — single English sentence (max 160 chars), action-oriented, third-person, like a dispatcher's note.
Example: "Elderly woman with breathing difficulty stuck on 2nd floor, ground floor flooded."

summaryLocalized — same sentence translated into the citizen's input language (matching the requested locale). If input was English, copy summary verbatim. Use everyday register, not formal/literary.

confidence — float 0.0-1.0. Honestly reflect signal quality. Lower if:
- Audio is muffled or extremely short (<2s of speech)
- Photo is blurry or off-topic
- Mixed/contradictory signals across modalities
- No useful signals at all

flagged + flagReason — set flagged=true (with a one-line English reason in flagReason) when:
- Inputs are completely empty/silent/blank → reason "empty input"
- Inputs are clearly unrelated to a real emergency (test, prank, music) → reason "unrelated content"
- Inputs are unintelligible after best-effort interpretation → reason "unintelligible"
Otherwise flagged=false and flagReason=null.

DO NOT:
- Hallucinate vulnerabilities or details not present in the inputs
- Downgrade severity based on speaker calmness — many Indians stay calm under extreme distress
- Assume gender or age without evidence
- Add political, religious, or controversial content to summaries
- Include personally-identifying information (names, faces, exact addresses) in summary fields`;

// ---------------------------------------------------------------------------
// Response schema — enforced via responseMimeType + responseSchema
// ---------------------------------------------------------------------------
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    needTypes: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [
          'medical',
          'evacuation',
          'shelter',
          'food',
          'water',
          'rescue',
          'other',
        ],
      },
      minItems: '1',
    },
    severity: {
      type: Type.STRING,
      enum: ['critical', 'high', 'medium', 'low'],
    },
    severityScore: {
      type: Type.INTEGER,
      minimum: 0,
      maximum: 100,
    },
    summary: { type: Type.STRING, maxLength: '200' },
    summaryLocalized: { type: Type.STRING, maxLength: '240' },
    headcount: { type: Type.INTEGER, minimum: 1, maximum: 1000 },
    vulnerabilityFlags: {
      type: Type.OBJECT,
      properties: {
        elderly: { type: Type.BOOLEAN },
        child: { type: Type.BOOLEAN },
        pregnant: { type: Type.BOOLEAN },
        disabled: { type: Type.BOOLEAN },
        injured: { type: Type.BOOLEAN },
      },
      required: ['elderly', 'child', 'pregnant', 'disabled', 'injured'],
      propertyOrdering: ['elderly', 'child', 'pregnant', 'disabled', 'injured'],
    },
    accessibilityNotes: { type: Type.STRING, nullable: true, maxLength: '160' },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    flagged: { type: Type.BOOLEAN },
    flagReason: { type: Type.STRING, nullable: true, maxLength: '80' },
  },
  required: [
    'needTypes',
    'severity',
    'severityScore',
    'summary',
    'summaryLocalized',
    'headcount',
    'vulnerabilityFlags',
    'accessibilityNotes',
    'confidence',
    'flagged',
    'flagReason',
  ],
  propertyOrdering: [
    'needTypes',
    'severity',
    'severityScore',
    'summary',
    'summaryLocalized',
    'headcount',
    'vulnerabilityFlags',
    'accessibilityNotes',
    'confidence',
    'flagged',
    'flagReason',
  ],
};

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------
let _client: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (_client) return _client;

  const useVertex = process.env.VERTEX_AI === '1';
  if (useVertex) {
    _client = new GoogleGenAI({
      vertexai: true,
      project:
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1',
    });
  } else {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        'GEMINI_API_KEY is not set. Either set it, or set VERTEX_AI=1 ' +
          'with GOOGLE_CLOUD_PROJECT to use Vertex AI.',
      );
    }
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------
export async function parseSosWithGemini(
  input: SosParseInput,
): Promise<SosParsed> {
  if (!input.photo && !input.voice && !input.text) {
    // Short-circuit — nothing to parse, return a flagged stub. Saves the
    // model call and lets the dashboard surface this instantly.
    return emptyInputStub(input.language);
  }

  const ai = getGenAI();

  // Build the multimodal `parts` array
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  // Spatial + linguistic context for the model
  const contextLines = [
    `Citizen preferred language: ${input.language}`,
    `GPS: ${input.location.lat.toFixed(6)}, ${input.location.lng.toFixed(6)}`,
    input.cityDistrict ? `Locality: ${input.cityDistrict}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  parts.push({
    text:
      `--- CONTEXT ---\n${contextLines}\n\n--- INPUT MODALITIES BELOW ---`,
  });

  if (input.photo) {
    parts.push({
      inlineData: {
        mimeType: input.photo.mimeType,
        data: input.photo.buffer.toString('base64'),
      },
    });
  }
  if (input.voice) {
    parts.push({
      inlineData: {
        mimeType: input.voice.mimeType,
        data: input.voice.buffer.toString('base64'),
      },
    });
  }
  if (input.text && input.text.trim()) {
    parts.push({ text: `Citizen typed text: ${input.text.trim()}` });
  }

  // Final instruction nudge — defence-in-depth against schema drift
  parts.push({
    text:
      'Now classify this SOS. Return ONLY the JSON object that conforms to the response schema. Localize `summaryLocalized` into the citizen language above.',
  });

  // Call Gemini with structured output enforcement
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: SOS_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1024,
      // Block harmful content but keep emergency vocabulary flowing.
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    },
  });

  const raw = response.text ?? '';
  if (!raw) {
    throw new Error('Gemini returned an empty response');
  }

  let parsed: SosParsed;
  try {
    // Strip accidental ```json fences if the model adds them despite mime
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    parsed = JSON.parse(cleaned) as SosParsed;
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini response as JSON: ${
        err instanceof Error ? err.message : String(err)
      }\nRaw: ${raw.slice(0, 500)}`,
    );
  }

  // Defensive normalisation — clamp ranges, default missing nullables
  parsed.severityScore = Math.max(0, Math.min(100, Math.round(parsed.severityScore)));
  parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
  parsed.headcount = Math.max(1, Math.round(parsed.headcount));
  parsed.accessibilityNotes ??= null;
  parsed.flagReason ??= null;

  return parsed;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------
function emptyInputStub(_lang: SupportedLanguage): SosParsed {
  return {
    needTypes: ['other'],
    severity: 'low',
    severityScore: 0,
    summary: 'Empty SOS — no voice, photo, or text submitted.',
    summaryLocalized: 'Empty SOS — no voice, photo, or text submitted.',
    headcount: 1,
    vulnerabilityFlags: {
      elderly: false,
      child: false,
      pregnant: false,
      disabled: false,
      injured: false,
    },
    accessibilityNotes: null,
    confidence: 0,
    flagged: true,
    flagReason: 'empty input',
  };
}
