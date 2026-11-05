// Request body limit, shared by every route that reads a body (PLAN: refuse big bodies before they are held in memory).
export const MAX_BODY_BYTES = 1_000_000;

export class TooLargeError extends Error {
  constructor() {
    super('body too large');
  }
}

// Refuses by the declared length first, so a large body is never read. The final check counts bytes,
// the unit the limit is written in.
export async function readLimitedText(req: Request): Promise<string> {
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) throw new TooLargeError();
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new TooLargeError();
  return text;
}
