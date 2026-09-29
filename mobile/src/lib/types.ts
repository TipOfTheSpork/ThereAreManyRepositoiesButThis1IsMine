// Mirrors server/src/schema.ts. Keep the two in sync.

export interface Foam {
  head_thickness: "none" | "thin" | "medium" | "thick" | "towering";
  bubble_size: "fine" | "mixed" | "coarse";
  density: "airy" | "moderate" | "dense" | "creamy";
  lacing: string;
  shapes_seen: string[];
}

export interface Reading {
  headline: string;
  timeline: { hours: "0-3" | "3-6" | "6-9" | "9-12"; prediction: string; foam_sign: string }[];
  lucky_thing: string;
  beware: string;
}

export interface Glass {
  position: string;
  vessel: string;
  beer_evidence: string;
  is_beer: boolean;
  beer_confidence: number;
  style_guess: string;
  foam: Foam;
  reading: Reading | null;
}

export interface ReadingResponse {
  id: string;
  createdAt: string;
  repeat: boolean;
  glasses: Glass[];
  message: string | null;
}
