import { z } from "zod";

/** Glasses the model is less sure than this about never get a reading. */
export const BEER_CONFIDENCE_THRESHOLD = 0.8;

const Foam = z.object({
  head_thickness: z
    .enum(["none", "thin", "medium", "thick", "towering"])
    .describe("How tall the head of foam is relative to the glass."),
  bubble_size: z.enum(["fine", "mixed", "coarse"]),
  density: z.enum(["airy", "moderate", "dense", "creamy"]),
  lacing: z
    .string()
    .describe("Foam clinging to the glass wall above the liquid, or 'none'."),
  shapes_seen: z
    .array(z.string())
    .describe(
      "Specific shapes, clusters or patterns visible in the foam, as a tea-leaf reader would name them (e.g. 'a crescent of large bubbles near the rim').",
    ),
});

const TimelineSegment = z.object({
  hours: z.enum(["0-3", "3-6", "6-9", "9-12"]),
  prediction: z.string(),
  foam_sign: z
    .string()
    .describe("Which feature of this glass's foam this prediction was read from."),
});

const Reading = z.object({
  headline: z.string().describe("One short line summing up the next 12 hours."),
  timeline: z.array(TimelineSegment).describe("Exactly four segments, in order."),
  lucky_thing: z.string(),
  beware: z.string().describe("Something mild and harmless to watch out for."),
});

const Glass = z.object({
  position: z
    .string()
    .describe("Where this glass is in the photo, so the user can tell which is which (e.g. 'front left', 'the tall one in the middle')."),
  vessel: z.string().describe("Kind of glass or container, e.g. 'shaker pint', 'tulip', 'can'."),
  beer_evidence: z
    .string()
    .describe("The visual evidence for and against the contents being beer."),
  is_beer: z.boolean(),
  beer_confidence: z.number().describe("0.0-1.0 probability that the contents are beer."),
  style_guess: z.string().describe("Likely beer style, or 'unknown'."),
  foam: Foam,
  reading: Reading.nullable().describe(
    `Null unless is_beer is true and beer_confidence >= ${BEER_CONFIDENCE_THRESHOLD}.`,
  ),
});

export const Analysis = z.object({
  is_real_photo: z
    .boolean()
    .describe("False if this is a photo of a screen, a printout, or an obviously generated/edited image."),
  glasses: z.array(Glass).describe("Every drinking vessel visible, left to right."),
  message_if_no_beer: z
    .string()
    .describe("A short, friendly explanation if no glass qualifies for a reading; otherwise an empty string."),
});

export type Analysis = z.infer<typeof Analysis>;
export type Glass = z.infer<typeof Glass>;

/** What the API returns to the app. */
export interface ReadingResponse {
  id: string;
  createdAt: string;
  /** True when this photo matched one the same device submitted in the last 12 hours. */
  repeat: boolean;
  glasses: Glass[];
  message: string | null;
}
