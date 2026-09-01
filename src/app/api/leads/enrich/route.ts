import { NextResponse } from "next/server";
import type { GenerateLead } from "@/types/LeadsGenerate";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `You are a B2B data enrichment assistant. Your job is to fill in null/missing fields in lead records with realistic, plausible data.

Rules:
- email: if null, generate a professional email in the format firstname.lastname@companydomain. Use the company_domain if available; otherwise infer a likely domain from company_name (e.g. "Acme Fintech" → "acmefintech.com"). Always set email_status to "guessed" for any email you generate.
- title: if null, infer a realistic senior B2B job title based on company/industry context. Keep it concise (e.g. "Senior Account Executive", "Head of Sales", "Product Manager").
- seniority: if null, infer from the title or company context. Valid values: "c_suite", "vp", "director", "senior", "manager", "entry".
- location: if null, infer the most likely city and country (e.g. "San Francisco, CA" for US tech companies, "London, UK" for UK companies).
- industry: if null, infer from the company name/domain context.
- company_size: if null, infer a reasonable range for the company. Use these ranges: "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "10001+".
- company_name: if null, leave as null — do not fabricate a company name.
- company_domain: if null, infer from company_name if possible (e.g. "Acme Corp" → "acmecorp.com"). Leave null if you cannot reasonably infer it.
- phone: keep as null — do not generate phone numbers.
- linkedin_url: keep as null if not provided — do not fabricate LinkedIn URLs.
- first_name, last_name, full_name: never change these.
- Never change existing non-null values.

Return ONLY a valid JSON array. No markdown fences, no explanations, no trailing text.`;

async function enrichWithClaude(leads: GenerateLead[], model: string): Promise<GenerateLead[]> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured on the server.");

  const userMessage = `Enrich these ${leads.length} leads. Fill in every null field you can according to the rules.\n\n${JSON.stringify(leads, null, 2)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": ANTHROPIC_WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errText}`);
  }

  const body = (await res.json()) as { content: { type: string; text: string }[] };
  const raw = body.content.find((c) => c.type === "text")?.text ?? "[]";
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned) as GenerateLead[];
}

async function enrichWithGemini(leads: GenerateLead[], model: string): Promise<GenerateLead[]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured on the server.");

  const userMessage = `${SYSTEM_PROMPT}\n\nEnrich these ${leads.length} leads. Fill in every null field you can according to the rules.\n\n${JSON.stringify(leads, null, 2)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { responseMimeType: "text/plain" },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const body = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  const raw = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned) as GenerateLead[];
}

export async function POST(request: Request) {
  let leads: GenerateLead[];
  let model: string;

  try {
    const body = (await request.json()) as { leads: GenerateLead[]; model?: string };
    leads = body.leads;
    model = body.model ?? "claude-haiku-4-5-20251001";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const enriched = model.startsWith("gemini")
      ? await enrichWithGemini(leads, model)
      : await enrichWithClaude(leads, model);
    return NextResponse.json({ leads: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
