import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Allow simple GET in browser
    if (req.method !== "GET" && req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: false, error: "OPENAI_API_KEY is not set" });
      return;
    }

    const client = new OpenAI({ apiKey });

    // Minimal Responses API call
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: "Reply with exactly: smoke test ok",
      max_output_tokens: 50,
    });

    // Pull text out safely
    const text =
      response.output_text ??
      "(no output_text; check response schema/output in logs)";

    res.status(200).json({ ok: true, text });
  } catch (err: any) {
    console.error("openai-smoke error:", err);
    res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown error",
    });
  }
}
