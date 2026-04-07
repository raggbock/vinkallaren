import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createWorker } from "npm:tesseract.js@5";
import { corsHeaders } from "../_shared/cors.ts";
import { parseLabelText } from "./parse-label.ts";

const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json" };
const MAX_IMAGE_SIZE = 7_000_000; // ~5MB base64-encoded

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null =
  null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("eng+fra+ita+deu+swe");
  }
  return workerPromise;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing image (base64)" }),
        { status: 400, headers: JSON_HEADERS },
      );
    }

    if (image.length > MAX_IMAGE_SIZE) {
      return new Response(
        JSON.stringify({ error: "Image too large (max 5MB)" }),
        { status: 413, headers: JSON_HEADERS },
      );
    }

    const worker = await getWorker();
    const imageBuffer = Uint8Array.from(atob(image), (c) => c.charCodeAt(0));
    const { data } = await worker.recognize(imageBuffer);
    const parsed = parseLabelText(data.text);

    return new Response(
      JSON.stringify({ ...parsed, confidence: Math.round(data.confidence) }),
      { headers: JSON_HEADERS },
    );
  } catch (e) {
    // Reset worker on failure so next request retries initialization
    workerPromise = null;
    return new Response(
      JSON.stringify({ error: (e as Error).message, confidence: 0 }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
});
