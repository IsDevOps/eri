import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { readSheet } from "../src/lib/providers/vision";
import { transcribe } from "../src/lib/providers/stt";
import { extractFigures } from "../src/lib/extract";

// A local stand-in for api.openai.com: checks the request shape and returns canned answers.
let server: http.Server;
const seen: { url: string; auth: string; body: string }[] = [];

before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ url: req.url ?? "", auth: String(req.headers.authorization), body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/audio/transcriptions") return res.end(JSON.stringify({ text: "Ward four total. Party A 3,120." }));
      const sys = JSON.parse(body).messages[0].content as string;
      const content = sys.includes("EC8A")
        ? { pu_code: "34", votes: { A: 175, B: 129, C: 81, D: null }, confidence: 0.9, note: "ok" }
        : { entries: [{ level: "ward", ward: 4, pu: null, tally: { A: 3120 } }] };
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  delete process.env.ANTHROPIC_API_KEY;
});

after(() => {
  server.close();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
});

test("photo reading via OpenAI: sends the image, pads the PU code, drops illegible figures", async () => {
  const r = await readSheet(Buffer.from("fake-image"), "image/png");
  assert.equal(r.engine, "openai");
  assert.equal(r.puCode, "034");
  assert.deepEqual(r.tally, { A: 175, B: 129, C: 81 }); // D was null (illegible) so it is left out, not guessed
  const call = seen.find((s) => s.body.includes("image_url"))!;
  assert.equal(call.auth, "Bearer test-key");
  assert.match(call.body, /data:image\/png;base64,/);
});

test("figure extraction via OpenAI returns entries and the ward context", async () => {
  const r = await extractFigures("Ward four total. Party A three thousand one hundred and twenty.");
  assert.equal(r.engine, "openai");
  assert.deepEqual(r.entries, [{ level: "ward", ward: 4, pu: undefined, tally: { A: 3120 }, dropped: undefined }]);
  assert.equal(r.ctx.ward, 4);
});

test("speech-to-text goes to the transcriptions endpoint", async () => {
  const t = await transcribe(Buffer.from("fake-audio"), "clip.wav", "audio/wav");
  assert.deepEqual(t, { text: "Ward four total. Party A 3,120.", engine: "openai" });
  assert.ok(seen.some((s) => s.url === "/v1/audio/transcriptions"));
});
