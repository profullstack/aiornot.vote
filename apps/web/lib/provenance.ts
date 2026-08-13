/**
 * Provenance reading: what a file *says* about how it was made.
 *
 * This is deliberately not a detector. It reads signed and self-declared
 * provenance — C2PA manifests, the IPTC `DigitalSourceType` field, and
 * generator hints left in XMP/EXIF — and reports exactly what it found.
 *
 * Two honesty rules run through the whole module:
 *
 *   1. Absence proves nothing. Almost every social platform strips metadata on
 *      upload, so a file with no provenance is the overwhelmingly common case
 *      for real photographs and AI output alike. We never read "no manifest"
 *      as "probably real".
 *   2. Self-declaration is not proof. An unsigned XMP field is a claim by
 *      whoever last wrote the file, and it is trivially editable. Only a C2PA
 *      manifest carries a cryptographic signature, and even then this module
 *      reports its *presence*, not its validity — verifying the certificate
 *      chain needs the trust list, which is a separate job.
 *
 * Everything here is pure and synchronous: bytes in, findings out.
 */

/** How much of a file we need to see. Manifests and XMP live near the front. */
export const PROVENANCE_SCAN_BYTES = 2 * 1024 * 1024;

export type ProvenanceSignal =
  | "c2pa_manifest"
  | "iptc_digital_source_type"
  | "generator_metadata"
  | "none";

/**
 * IPTC digital source types, the standard vocabulary for "how was this made".
 * https://cv.iptc.org/newscodes/digitalsourcetype/
 */
export const DIGITAL_SOURCE_TYPES: Readonly<Record<string, { aiGenerated: boolean; label: string }>> =
  {
    trainedAlgorithmicMedia: { aiGenerated: true, label: "Created by a generative model" },
    compositeWithTrainedAlgorithmicMedia: {
      aiGenerated: true,
      label: "Composite including generative model output",
    },
    algorithmicMedia: { aiGenerated: true, label: "Created by an algorithm, not a model" },
    digitalCapture: { aiGenerated: false, label: "Captured by a camera" },
    negativeFilm: { aiGenerated: false, label: "Digitised from negative film" },
    positiveFilm: { aiGenerated: false, label: "Digitised from positive film" },
    print: { aiGenerated: false, label: "Digitised from a print" },
    digitalArt: { aiGenerated: false, label: "Created digitally by a human" },
    composite: { aiGenerated: false, label: "Human-made composite" },
    algorithmicallyEnhanced: { aiGenerated: false, label: "Algorithmically enhanced capture" },
  };

/** Generator signatures seen in XMP/EXIF software and credit fields. */
const GENERATOR_PATTERNS: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /\bmidjourney\b/i, name: "Midjourney" },
  { pattern: /\bdall[·.\-\s]?e\b/i, name: "DALL·E" },
  { pattern: /\bstable\s?diffusion\b/i, name: "Stable Diffusion" },
  { pattern: /\bautomatic1111\b/i, name: "AUTOMATIC1111" },
  { pattern: /\bcomfyui\b/i, name: "ComfyUI" },
  { pattern: /\bfirefly\b/i, name: "Adobe Firefly" },
  { pattern: /\bgemini\b/i, name: "Google Gemini" },
  { pattern: /\bimagen\b/i, name: "Google Imagen" },
  { pattern: /\bveo\b/i, name: "Google Veo" },
  { pattern: /\bflux\b/i, name: "FLUX" },
  { pattern: /\bleonardo\.?ai\b/i, name: "Leonardo.Ai" },
  { pattern: /\bopenai\b/i, name: "OpenAI" },
  { pattern: /\bgpt-image\b/i, name: "OpenAI gpt-image" },
];

export interface C2paFinding {
  readonly present: boolean;
  /** Which container the manifest was found in. */
  readonly container?: "jpeg" | "png" | "webp" | "isobmff" | "unknown";
  /**
   * Always false. Presence is detectable from the bytes; validity needs the
   * signature and the trust list, which this module does not attempt.
   */
  readonly signatureVerified: false;
}

export interface ProvenanceReport {
  /** Every signal found, strongest first. `none` when the file is bare. */
  readonly signals: readonly ProvenanceSignal[];
  readonly c2pa: C2paFinding;
  /** The raw IPTC value, when present. */
  readonly digitalSourceType?: string;
  readonly digitalSourceTypeLabel?: string;
  /** Generator names found in metadata. */
  readonly generators: readonly string[];
  /**
   * What the file declares about itself: true (AI), false (camera capture), or
   * null when it declares nothing. Never inferred from pixels.
   */
  readonly declaredAiGenerated: boolean | null;
  /**
   * How much weight the finding carries.
   *
   * `signed` — a C2PA manifest is present (validity unverified).
   * `declared` — an unsigned, editable metadata claim.
   * `hint` — a generator name, which may be a filename artefact or an editor.
   * `none` — nothing found, which is not evidence either way.
   */
  readonly strength: "signed" | "declared" | "hint" | "none";
  /** Plain-language caveats, meant to be shown to the caller verbatim. */
  readonly notes: readonly string[];
  /** SynthID cannot be checked here; this records why, rather than staying silent. */
  readonly synthid: { readonly checked: false; readonly reason: string };
}

const SYNTHID_REASON =
  "SynthID watermarks are verified by Google's own detection service, not from the file's bytes. " +
  "This report does not rule a SynthID watermark in or out.";

const ABSENCE_NOTE =
  "No provenance metadata was found. Most platforms strip metadata on upload, so this is " +
  "equally common for real photographs and for AI output — it is not evidence either way.";

const UNSIGNED_NOTE =
  "This claim comes from editable metadata, not a signature. Treat it as what the file says " +
  "about itself, not as proof.";

const SIGNED_NOTE =
  "A C2PA manifest is present. This report confirms its presence only — validating the " +
  "signature and its certificate chain is a separate step.";

/**
 * Reads every provenance signal a file carries.
 *
 * @param bytes - The head of the file; `PROVENANCE_SCAN_BYTES` is plenty
 * @returns What the file declares, and how much that is worth
 */
export function readProvenance(bytes: Uint8Array): ProvenanceReport {
  const c2pa = detectC2pa(bytes);
  const xmp = extractXmp(bytes);

  const digitalSourceType = xmp ? readDigitalSourceType(xmp) : undefined;
  const known = digitalSourceType ? DIGITAL_SOURCE_TYPES[digitalSourceType] : undefined;
  const generators = readGenerators(xmp ?? "");

  const signals: ProvenanceSignal[] = [];
  if (c2pa.present) signals.push("c2pa_manifest");
  if (digitalSourceType) signals.push("iptc_digital_source_type");
  if (generators.length > 0) signals.push("generator_metadata");
  if (signals.length === 0) signals.push("none");

  const notes: string[] = [];
  let strength: ProvenanceReport["strength"];

  if (c2pa.present) {
    strength = "signed";
    notes.push(SIGNED_NOTE);
  } else if (digitalSourceType) {
    strength = "declared";
    notes.push(UNSIGNED_NOTE);
  } else if (generators.length > 0) {
    strength = "hint";
    notes.push(
      "A generator name appears in the file's metadata. That can mean the tool produced the " +
        "image, or merely that it was opened in it.",
    );
  } else {
    strength = "none";
    notes.push(ABSENCE_NOTE);
  }

  // A declared source type is the only field that states intent directly. A
  // generator hint alone is too weak to call: image editors write their own
  // name into the same fields.
  const declaredAiGenerated = known ? known.aiGenerated : null;

  return {
    signals,
    c2pa,
    ...(digitalSourceType ? { digitalSourceType } : {}),
    ...(known ? { digitalSourceTypeLabel: known.label } : {}),
    generators,
    declaredAiGenerated,
    strength,
    notes,
    synthid: { checked: false, reason: SYNTHID_REASON },
  };
}

/**
 * Looks for a C2PA manifest store in the containers that can carry one.
 *
 * C2PA manifests are JUMBF boxes. Where the box lives depends on the format:
 * a JPEG APP11 segment, a PNG `caBX` chunk, a WebP `C2PA` chunk, or a
 * top-level ISO-BMFF box in MP4. In every case the label `c2pa` appears as
 * ASCII inside the box header, which is what this scans for.
 *
 * @param bytes - File head
 * @returns Whether a manifest is present, and which container it came from
 */
export function detectC2pa(bytes: Uint8Array): C2paFinding {
  const container = detectContainer(bytes);

  // The JUMBF box type for a C2PA manifest store, as ASCII. Scanning for the
  // label rather than walking every container's box structure keeps this
  // format-agnostic; a false positive needs the exact 4-byte sequence to
  // appear next to a JUMBF marker, which does not happen in pixel data.
  const hasJumbf = indexOfAscii(bytes, "jumb") !== -1 || indexOfAscii(bytes, "jumd") !== -1;
  const hasC2paLabel =
    indexOfAscii(bytes, "c2pa") !== -1 || indexOfAscii(bytes, "urn:uuid:c2pa") !== -1;

  // PNG and WebP name their chunk explicitly, so those are conclusive alone.
  const hasNamedChunk = indexOfAscii(bytes, "caBX") !== -1 || indexOfAscii(bytes, "C2PA") !== -1;

  const present = hasNamedChunk || (hasC2paLabel && hasJumbf);

  return present ? { present: true, container, signatureVerified: false } : { present: false, signatureVerified: false };
}

/**
 * Identifies the container from its magic bytes.
 *
 * @param bytes - File head
 * @returns The container, or "unknown"
 */
export function detectContainer(bytes: Uint8Array): NonNullable<C2paFinding["container"]> {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (indexOfAscii(bytes.subarray(0, 16), "WEBP") !== -1) return "webp";
  if (indexOfAscii(bytes.subarray(0, 32), "ftyp") !== -1) return "isobmff";
  return "unknown";
}

/**
 * Pulls the XMP packet out of a file.
 *
 * XMP is stored as a plain XML document wrapped in a well-known processing
 * instruction, which makes it findable without parsing the container.
 *
 * @param bytes - File head
 * @returns The XMP document, or undefined when there is none
 */
export function extractXmp(bytes: Uint8Array): string | undefined {
  const start = indexOfAscii(bytes, "<x:xmpmeta");
  if (start === -1) return undefined;

  const endMarker = "</x:xmpmeta>";
  const end = indexOfAscii(bytes, endMarker, start);
  if (end === -1) return undefined;

  return asciiSlice(bytes, start, end + endMarker.length);
}

/**
 * Reads the IPTC `DigitalSourceType` value from an XMP document.
 *
 * The field is a controlled-vocabulary URI; only the final path segment is
 * meaningful, so that is what comes back.
 *
 * @param xmp - XMP document
 * @returns The bare term, or undefined
 */
export function readDigitalSourceType(xmp: string): string | undefined {
  // Attribute form: Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"
  const attribute = xmp.match(/DigitalSourceType\s*=\s*"([^"]+)"/i);
  // Element form: <Iptc4xmpExt:DigitalSourceType>…</Iptc4xmpExt:DigitalSourceType>
  const element = xmp.match(/<[^>]*DigitalSourceType[^>]*>([^<]+)</i);

  const raw = (attribute?.[1] ?? element?.[1] ?? "").trim();
  if (!raw) return undefined;

  const term = raw.split("/").pop()?.trim();
  return term || undefined;
}

/**
 * Finds known generator names in a metadata blob.
 *
 * @param metadata - XMP or any other text extracted from the file
 * @returns Matching generator names, de-duplicated and in a stable order
 */
export function readGenerators(metadata: string): string[] {
  if (!metadata) return [];

  const found = new Set<string>();
  for (const { pattern, name } of GENERATOR_PATTERNS) {
    if (pattern.test(metadata)) found.add(name);
  }
  return [...found];
}

/**
 * Finds an ASCII needle in a byte array.
 *
 * Written by hand rather than decoding the whole buffer to a string first:
 * these files are megabytes of binary, and decoding them as text to run
 * `indexOf` allocates a copy for no benefit.
 *
 * @param haystack - Bytes to search
 * @param needle - ASCII string to find
 * @param from - Index to start at
 * @returns Byte offset, or -1
 */
export function indexOfAscii(haystack: Uint8Array, needle: string, from = 0): number {
  const target = new Uint8Array(needle.length);
  for (let i = 0; i < needle.length; i += 1) target[i] = needle.charCodeAt(i);
  if (target.length === 0 || haystack.length < target.length) return -1;

  const last = haystack.length - target.length;
  outer: for (let i = Math.max(0, from); i <= last; i += 1) {
    for (let j = 0; j < target.length; j += 1) {
      if (haystack[i + j] !== target[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Decodes a byte range as Latin-1 text.
 *
 * @param bytes - Source bytes
 * @param start - Start offset
 * @param end - End offset, exclusive
 * @returns The decoded string
 */
function asciiSlice(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end && i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]!);
  }
  return out;
}
