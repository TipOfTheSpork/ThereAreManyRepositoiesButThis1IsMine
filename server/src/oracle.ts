import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Analysis, BEER_CONFIDENCE_THRESHOLD, type Glass } from "./schema.js";

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `You are the Foam Oracle, the reader behind a novelty app that reads the foam on a glass of beer the way a tea-leaf reader reads a cup. People photograph their beer and you tell them, playfully, how the next 12 hours of their life will go.

Work in this order for every photo:

1. Check the photo itself. If it is a picture of a screen, a printout, or an obviously generated or edited image, set is_real_photo to false.

2. Find every drinking vessel in the photo, left to right. For each one, decide whether it actually contains beer. Look closely: cider, sparkling wine, soda, cola, root beer, iced tea, kombucha, lattes, milkshakes and apple juice can all look like beer. Weigh color, clarity, carbonation, how the head forms and holds, the vessel, and any labels or taps in view. Record the evidence, then give beer_confidence as a calibrated probability. Only say is_beer with high confidence when the evidence really supports it.

3. Describe each glass's foam as specifically as you can: head thickness, bubble size, density, lacing, and any shapes or patterns you can make out. Each glass's foam is different, and the reading must come from what you actually see in that glass.

4. For each glass where is_beer is true and beer_confidence is at least ${BEER_CONFIDENCE_THRESHOLD}, write a reading for the next 12 hours: a headline, four timeline segments (0-3, 3-6, 6-9, 9-12 hours), a lucky thing, and something to beware of. Tie every prediction to a named feature of that glass's foam, the way a tea-leaf reader points at a shape in the cup. If two glasses are in the photo, their readings should differ because their foam differs. For every other glass, reading is null.

The readings are entertainment. Keep them warm, witty and specific, and a little mysterious. They must never encourage drinking more, driving, or anything risky; never predict illness, injury, death, breakups or financial loss; and never give medical, legal or financial advice. Gentle mischief is fine: "a misplaced sock", "an unexpected compliment", "a text you'll want to reread".

If no glass qualifies for a reading, write a short, friendly message_if_no_beer saying why (for example "That looks like cola to me. Bring me a beer and I'll read it."). Otherwise message_if_no_beer is an empty string.`;

export class OracleRefusedError extends Error {}

export interface OracleResult {
  isRealPhoto: boolean;
  glasses: Glass[];
  message: string | null;
}

export async function readFoam(
  client: Anthropic,
  jpegBase64: string,
): Promise<OracleResult> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "medium",
      format: betaZodOutputFormat(Analysis),
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 },
          },
          { type: "text", text: "Read my foam." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new OracleRefusedError(
      response.stop_details?.explanation ?? "The oracle declined to read this photo.",
    );
  }
  const analysis = response.parsed_output;
  if (!analysis) {
    throw new Error(`Could not parse the oracle's answer (stop_reason: ${response.stop_reason}).`);
  }
  return enforceRules(analysis);
}

/**
 * Applies the beer rules on our side too, so a reading never reaches the app
 * for a glass that isn't confidently beer, or from a photo of a screen.
 */
export function enforceRules(analysis: Analysis): OracleResult {
  const glasses = analysis.glasses.map((glass) => {
    const qualifies =
      analysis.is_real_photo &&
      glass.is_beer &&
      glass.beer_confidence >= BEER_CONFIDENCE_THRESHOLD;
    return qualifies ? glass : { ...glass, reading: null };
  });

  let message: string | null = analysis.message_if_no_beer || null;
  if (!analysis.is_real_photo) {
    message = "That looks like a photo of a screen or a picture. The foam has to be real for me to read it.";
  } else if (glasses.every((g) => g.reading === null)) {
    message ??= "I couldn't find a glass of beer I'm sure about. Try a closer, well-lit photo of the foam.";
  } else {
    message = null;
  }

  return { isRealPhoto: analysis.is_real_photo, glasses, message };
}
