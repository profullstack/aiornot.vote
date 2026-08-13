import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DIGITAL_SOURCE_TYPES,
  detectC2pa,
  detectContainer,
  extractXmp,
  indexOfAscii,
  readDigitalSourceType,
  readGenerators,
  readProvenance,
} from "./provenance";

/** Builds a byte array from a mix of literal bytes and ASCII strings. */
function bytes(...parts: (number[] | string)[]): Uint8Array {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      for (let i = 0; i < part.length; i += 1) out.push(part.charCodeAt(i));
    } else {
      out.push(...part);
    }
  }
  return new Uint8Array(out);
}

const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function xmpPacket(inner: string): string {
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/">${inner}</x:xmpmeta>`;
}

describe("indexOfAscii", () => {
  it("finds a needle and reports its offset", () => {
    expect(indexOfAscii(bytes("hello world"), "world")).toBe(6);
  });

  it("returns -1 when absent", () => {
    expect(indexOfAscii(bytes("hello"), "zebra")).toBe(-1);
  });

  it("honours the start offset", () => {
    expect(indexOfAscii(bytes("abcabc"), "abc", 1)).toBe(3);
  });

  it("handles needles longer than the haystack", () => {
    expect(indexOfAscii(bytes("ab"), "abcdef")).toBe(-1);
    expect(indexOfAscii(bytes("ab"), "")).toBe(-1);
  });
});

describe("detectContainer", () => {
  it("recognises JPEG, PNG, WebP and ISO-BMFF", () => {
    expect(detectContainer(bytes(JPEG_MAGIC))).toBe("jpeg");
    expect(detectContainer(bytes(PNG_MAGIC))).toBe("png");
    expect(detectContainer(bytes("RIFF____WEBPVP8 "))).toBe("webp");
    expect(detectContainer(bytes([0, 0, 0, 24], "ftypmp42"))).toBe("isobmff");
  });

  it("falls back to unknown", () => {
    expect(detectContainer(bytes("just some text"))).toBe("unknown");
    expect(detectContainer(new Uint8Array(0))).toBe("unknown");
  });
});

describe("detectC2pa", () => {
  it("detects a PNG caBX chunk", () => {
    const finding = detectC2pa(bytes(PNG_MAGIC, [0, 0, 0, 32], "caBX", "manifest-store"));

    expect(finding.present).toBe(true);
    expect(finding.container).toBe("png");
  });

  it("detects a JUMBF box carrying a c2pa label", () => {
    const finding = detectC2pa(bytes(JPEG_MAGIC, "____jumb", [0, 0, 0, 16], "jumdc2pa"));

    expect(finding.present).toBe(true);
    expect(finding.container).toBe("jpeg");
  });

  it("never claims the signature was verified", () => {
    const finding = detectC2pa(bytes(PNG_MAGIC, "caBX"));
    expect(finding.signatureVerified).toBe(false);
  });

  it("does not fire on a bare c2pa string with no JUMBF box", () => {
    // A caption mentioning c2pa must not be read as a manifest.
    const finding = detectC2pa(bytes(JPEG_MAGIC, "photo tagged c2pa by the author"));
    expect(finding.present).toBe(false);
  });

  it("reports absence for a plain file", () => {
    const finding = detectC2pa(bytes(JPEG_MAGIC, "ordinary pixels"));

    expect(finding.present).toBe(false);
    expect(finding.container).toBeUndefined();
  });
});

describe("extractXmp", () => {
  it("pulls the packet out of surrounding binary", () => {
    const packet = xmpPacket("<rdf:RDF/>");
    const xmp = extractXmp(bytes(JPEG_MAGIC, [1, 2, 3], packet, [9, 9, 9]));

    expect(xmp).toBe(packet);
  });

  it("returns undefined with no packet", () => {
    expect(extractXmp(bytes(JPEG_MAGIC, "nothing here"))).toBeUndefined();
  });

  it("returns undefined for an unterminated packet", () => {
    expect(extractXmp(bytes("<x:xmpmeta truncated..."))).toBeUndefined();
  });
});

describe("readDigitalSourceType", () => {
  it("reads the attribute form and keeps only the term", () => {
    const xmp = xmpPacket(
      '<rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/>',
    );

    expect(readDigitalSourceType(xmp)).toBe("trainedAlgorithmicMedia");
  });

  it("reads the element form", () => {
    const xmp = xmpPacket(
      "<Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture</Iptc4xmpExt:DigitalSourceType>",
    );

    expect(readDigitalSourceType(xmp)).toBe("digitalCapture");
  });

  it("returns undefined when the field is missing or empty", () => {
    expect(readDigitalSourceType(xmpPacket("<rdf:RDF/>"))).toBeUndefined();
    expect(readDigitalSourceType('DigitalSourceType=""')).toBeUndefined();
  });
});

describe("readGenerators", () => {
  it("finds known generator names", () => {
    expect(readGenerators("CreatorTool: Midjourney v6")).toEqual(["Midjourney"]);
    expect(readGenerators("Software=DALL·E 3")).toEqual(["DALL·E"]);
  });

  it("de-duplicates repeats", () => {
    expect(readGenerators("midjourney and Midjourney again")).toEqual(["Midjourney"]);
  });

  it("returns nothing for empty or unremarkable metadata", () => {
    expect(readGenerators("")).toEqual([]);
    expect(readGenerators("Canon EOS R5")).toEqual([]);
  });
});

describe("readProvenance", () => {
  it("reports a signed manifest as the strongest signal", () => {
    const report = readProvenance(bytes(PNG_MAGIC, "caBX", "manifest"));

    expect(report.strength).toBe("signed");
    expect(report.signals).toContain("c2pa_manifest");
    expect(report.c2pa.present).toBe(true);
    expect(report.notes.join(" ")).toContain("presence only");
  });

  it("reads a declared AI source type", () => {
    const xmp = xmpPacket(
      '<rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/>',
    );
    const report = readProvenance(bytes(JPEG_MAGIC, xmp));

    expect(report.declaredAiGenerated).toBe(true);
    expect(report.digitalSourceType).toBe("trainedAlgorithmicMedia");
    expect(report.digitalSourceTypeLabel).toBe("Created by a generative model");
    expect(report.strength).toBe("declared");
    expect(report.notes.join(" ")).toContain("not a signature");
  });

  it("reads a declared camera capture", () => {
    const xmp = xmpPacket(
      '<rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture"/>',
    );
    const report = readProvenance(bytes(JPEG_MAGIC, xmp));

    expect(report.declaredAiGenerated).toBe(false);
    expect(report.digitalSourceTypeLabel).toBe("Captured by a camera");
  });

  it("treats a generator name as a hint, not a verdict", () => {
    const report = readProvenance(bytes(JPEG_MAGIC, xmpPacket("<xmp:CreatorTool>Midjourney</xmp:CreatorTool>")));

    expect(report.generators).toEqual(["Midjourney"]);
    expect(report.strength).toBe("hint");
    // A generator name is not enough to declare the file AI-generated.
    expect(report.declaredAiGenerated).toBeNull();
  });

  it("never reads absence as evidence of anything", () => {
    const report = readProvenance(bytes(JPEG_MAGIC, "ordinary pixels"));

    expect(report.signals).toEqual(["none"]);
    expect(report.strength).toBe("none");
    expect(report.declaredAiGenerated).toBeNull();
    expect(report.notes.join(" ")).toContain("not evidence either way");
  });

  it("always states that SynthID was not checked", () => {
    for (const sample of [bytes(JPEG_MAGIC), bytes(PNG_MAGIC, "caBX")]) {
      const report = readProvenance(sample);
      expect(report.synthid.checked).toBe(false);
      expect(report.synthid.reason).toContain("SynthID");
    }
  });

  it("collects every signal present at once", () => {
    const xmp = xmpPacket(
      '<rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia" xmp:CreatorTool="Adobe Firefly"/>',
    );
    const report = readProvenance(bytes(PNG_MAGIC, "caBX", xmp));

    expect(report.signals).toEqual([
      "c2pa_manifest",
      "iptc_digital_source_type",
      "generator_metadata",
    ]);
    expect(report.generators).toEqual(["Adobe Firefly"]);
  });

  it("handles an empty file without throwing", () => {
    const report = readProvenance(new Uint8Array(0));
    expect(report.strength).toBe("none");
  });
});

describe("DIGITAL_SOURCE_TYPES", () => {
  it("marks only the generative terms as AI", () => {
    const ai = Object.entries(DIGITAL_SOURCE_TYPES)
      .filter(([, value]) => value.aiGenerated)
      .map(([key]) => key)
      .sort();

    expect(ai).toEqual([
      "algorithmicMedia",
      "compositeWithTrainedAlgorithmicMedia",
      "trainedAlgorithmicMedia",
    ]);
  });

  it("does not treat an enhanced capture as AI-generated", () => {
    expect(DIGITAL_SOURCE_TYPES.algorithmicallyEnhanced?.aiGenerated).toBe(false);
  });
});
