/** Split a transcript into announcement segments so each hop is reconciled as soon as it is spoken. */
export function segment(text: string): string[] {
  return text
    .split(/(?=\b(?:ward|polling unit|local government|lga total|state total)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Live speech arrives as short phrases ("Ward four." / "Party A 3,120." / "Party B 400."). The figure extractor needs
 * a whole announcement at once, so phrases are buffered until the *next* announcement starts, and the finished one is released.
 */
export class SegmentBuffer {
  private buf = "";

  /** Add a finished phrase. Returns the announcements that are now complete (the newest one stays buffered). */
  push(phrase: string): string[] {
    this.buf = `${this.buf} ${phrase}`.trim();
    const segs = segment(this.buf);
    if (segs.length <= 1) return [];
    this.buf = segs[segs.length - 1];
    return segs.slice(0, -1);
  }

  /** Release whatever is buffered (silence for a few seconds, or the listener stopped). */
  flush(): string[] {
    const segs = segment(this.buf);
    this.buf = "";
    return segs;
  }

  get pending(): string {
    return this.buf;
  }
}
