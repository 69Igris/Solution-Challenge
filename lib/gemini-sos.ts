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

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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

  // Offline / quota-blocked fallback — deterministic keyword-based parser.
  // Set MOCK_GEMINI=1 in .env.local to keep building when the real API is
  // unavailable (rate-limited, no billing, conference WiFi, etc.).
  if (process.env.MOCK_GEMINI === '1') {
    return mockParse(input);
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

  // ── Resilience layer ────────────────────────────────────────────────
  // Call Gemini with structured output enforcement. If Gemini is overloaded
  // (503 UNAVAILABLE) or returns a transient error, retry once after 2s.
  // If that fails too, fall back to the deterministic mock parser so the
  // SOS pipeline NEVER fails because of an AI-side outage.
  const requestParams = {
    model: GEMINI_MODEL,
    contents: [{ role: 'user' as const, parts }],
    config: {
      systemInstruction: SOS_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1024,
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
  };

  let response;
  try {
    response = await ai.models.generateContent(requestParams);
  } catch (err) {
    if (isTransientGeminiError(err)) {
      console.warn('[gemini] transient error, retrying once in 2s:', errMsg(err));
      await new Promise((r) => setTimeout(r, 2000));
      try {
        response = await ai.models.generateContent(requestParams);
      } catch (retryErr) {
        console.warn(
          '[gemini] retry failed, falling back to mock parser. Reason:',
          errMsg(retryErr),
        );
        return mockParse(input);
      }
    } else {
      // Non-transient error (auth, quota, schema) — also fall back to mock so
      // the citizen still gets a usable SOS recorded. The flagReason field
      // surfaces the underlying issue to the dashboard.
      console.warn('[gemini] non-transient error, falling back to mock parser. Reason:', errMsg(err));
      const mock = mockParse(input);
      mock.flagged = true;
      mock.flagReason = `gemini error: ${errMsg(err).slice(0, 60)}`;
      return mock;
    }
  }

  const raw = response.text ?? '';
  if (!raw) {
    console.warn('[gemini] empty response, falling back to mock parser');
    return mockParse(input);
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

// ---------------------------------------------------------------------------
// MOCK_GEMINI fallback — deterministic keyword-based parser
// ---------------------------------------------------------------------------
/**
 * Realistic offline parser used when MOCK_GEMINI=1.
 *
 * Behaviour mimics what Gemini would return: scans the text + presence of
 * media for canonical disaster keywords across English + common Indic-language
 * romanisations, and synthesises a plausible SosParsed. Used for:
 *   - Continuing development when real Gemini quota is unavailable
 *   - Demo-day fallback if conference WiFi / rate limits misbehave
 *   - Cheap deterministic CI tests
 */
function mockParse(input: SosParseInput): SosParsed {
  const haystack = (input.text ?? '').toLowerCase();
  const has = (...needles: string[]) =>
    needles.some((n) => haystack.includes(n));

  // ---- Need types ----
  const needTypes = new Set<NeedType>();
  if (has('blood', 'bleed', 'unconscious', 'breath', 'saans', 'medicine', 'medical', 'injury', 'injured', 'fracture', 'oxygen', 'pregnant', 'garbhwati'))
    needTypes.add('medical');
  if (has('water rising', 'flood', 'paani', 'bhar gaya', 'rising', 'evacuat'))
    needTypes.add('evacuation');
  if (has('stuck', 'trapped', 'phans', 'submerged', 'cannot get out', 'rescue'))
    needTypes.add('rescue');
  if (has('roof', 'collapsed', 'displaced', 'no shelter', 'homeless', 'shelter'))
    needTypes.add('shelter');
  if (has('food', 'khana', 'hungry', 'no eat', 'infant', 'baby food', 'formula'))
    needTypes.add('food');
  if (has('drinking water', 'no water', 'thirsty', 'paani nahi'))
    needTypes.add('water');
  if (needTypes.size === 0) needTypes.add('other');

  // ---- Vulnerabilities ----
  const flags = {
    elderly: has('elderly', 'grandmother', 'grandfather', 'dadi', 'nana', 'nani', 'buzurg', 'old', 'aged'),
    child: has('child', 'kid', 'baby', 'bachcha', 'infant', 'toddler'),
    pregnant: has('pregnant', 'garbhwati', 'expecting'),
    disabled: has('wheelchair', 'paralysed', 'disabled', 'cannot walk', 'blind', 'deaf'),
    injured: has('injury', 'injured', 'bleeding', 'blood', 'fracture', 'broken'),
  };

  // ---- Severity ----
  let severity: SeverityLevel = 'medium';
  let severityScore = 45;
  if (has('drowning', 'unconscious', 'severe bleed', 'fire spread', 'dying', 'critical', 'cannot breath', 'no breath')) {
    severity = 'critical';
    severityScore = 90;
  } else if (
    needTypes.has('medical') ||
    needTypes.has('evacuation') ||
    needTypes.has('rescue') ||
    flags.elderly ||
    flags.pregnant ||
    flags.injured ||
    has('water rising', 'urgent', 'asap', 'immediate')
  ) {
    severity = 'high';
    severityScore = 72;
  } else if (needTypes.size === 1 && needTypes.has('other')) {
    severity = 'low';
    severityScore = 18;
  }

  // ---- Accessibility notes ----
  const notes: string[] = [];
  const floorMatch = haystack.match(/(\d)(?:st|nd|rd|th)?\s*floor/);
  if (floorMatch) notes.push(`stuck on ${floorMatch[1]} floor`);
  if (has('water rising', 'rising water')) notes.push('water rising');
  if (has('ground floor flooded', 'paani bhar gaya')) notes.push('ground floor flooded');
  if (has('road blocked', 'tree fallen', 'blocked')) notes.push('road blocked');
  if (has('door jammed', 'cannot open door')) notes.push('door jammed');
  const accessibilityNotes = notes.length ? notes.join(', ').slice(0, 140) : null;

  // ---- Headcount ----
  const headcountMatch = haystack.match(/(\d+)\s*(?:people|persons|members|of us|family)/);
  const headcount = headcountMatch ? Math.max(1, parseInt(headcountMatch[1], 10)) : 1;

  // ---- Summary ----
  const subject = flags.elderly
    ? 'Elderly person'
    : flags.child
      ? 'Child'
      : flags.pregnant
        ? 'Pregnant woman'
        : `Citizen${headcount > 1 ? ` and ${headcount - 1} others` : ''}`;
  const need = needTypes.has('medical')
    ? 'with medical need'
    : needTypes.has('rescue')
      ? 'trapped, needs rescue'
      : needTypes.has('evacuation')
        ? 'needs evacuation'
        : needTypes.has('shelter')
          ? 'needs shelter'
          : 'needs assistance';
  const where = accessibilityNotes ? ` — ${accessibilityNotes}` : '';
  const summary = `${subject} ${need}${where}.`.slice(0, 160);

  return {
    needTypes: Array.from(needTypes),
    severity,
    severityScore,
    summary,
    summaryLocalized: summary, // Mock: skip translation
    headcount,
    vulnerabilityFlags: flags,
    accessibilityNotes,
    confidence: input.text ? 0.78 : 0.55,
    flagged: false,
    flagReason: null,
  };
}

// ---------------------------------------------------------------------------
// Error classification — for retry/fallback decisions
// ---------------------------------------------------------------------------
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * True for errors that are likely temporary and worth retrying once:
 *   - 503 UNAVAILABLE (model overloaded — Gemini's most common failure mode)
 *   - 429 RESOURCE_EXHAUSTED (rate-limited)
 *   - DEADLINE_EXCEEDED (request timeout)
 *   - Network blips
 */
function isTransientGeminiError(err: unknown): boolean {
  const msg = errMsg(err);
  return (
    /\b503\b|UNAVAILABLE|overload/i.test(msg) ||
    /\b429\b|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg) ||
    /DEADLINE_EXCEEDED|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(msg)
  );
}
