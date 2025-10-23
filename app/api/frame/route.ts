import { NextRequest } from "next/server";
import { createCanvas } from "@napi-rs/canvas";
import { Redis } from "@upstash/redis";
// Initialize Redis

const CANVAS_SIZE = 16;
const PIXEL_SIZE = 20;
const CANVAS_KEY = "frame-canvas-state";

async function getCanvasState(): Promise<string[][]> {
  const redis = Redis.fromEnv();
  const canvasString = await redis.get<string>(CANVAS_KEY);

  console.log("Raw string fetched from Redis:", canvasString);

  if (!canvasString) {
    const initialCanvas = Array(CANVAS_SIZE)
      .fill(0)
      .map(() => Array(CANVAS_SIZE).fill("#FFFFFF"));
    const initialCanvasString = JSON.stringify(initialCanvas);
    console.log("Initializing canvas in Redis with:", initialCanvasString);
    await redis.set(CANVAS_KEY, initialCanvasString);
    return initialCanvas;
  } else {
    try {
      // Kita coba parse di dalam try...catch agar lebih aman
      return JSON.parse(canvasString);
    } catch (parseError) {
      console.error("Failed to parse canvas string from Redis:", parseError);
      console.error("Invalid string was:", canvasString); // Cetak string yang error
      // Jika parse gagal, kembalikan kanvas default agar tidak crash total
      return Array(CANVAS_SIZE)
        .fill(0)
        .map(() => Array(CANVAS_SIZE).fill("#FF0000")); // Kanvas merah tanda error
    }
  }
}

function drawCanvas(canvasState: string[][]): Buffer {
  const width = CANVAS_SIZE * PIXEL_SIZE;
  const height = CANVAS_SIZE * PIXEL_SIZE;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < CANVAS_SIZE; y++) {
    for (let x = 0; x < CANVAS_SIZE; x++) {
      ctx.fillStyle = canvasState[y][x];
      ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
  }
  return canvas.toBuffer("image/png");
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const canvasState = await getCanvasState();
    const imageBuffer = drawCanvas(canvasState);
    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString(
      "base64"
    )}`;

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const html = `
      <!DOCTYPE html><html><head>
        <meta property="og:title" content="Frame Canvas - Collab Pixel Art" />
        <meta property="og:image" content="${imageDataUrl}" />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageDataUrl}" />
        <meta property="fc:frame:button:1" content="🎨 Choose Color" />
        <meta property="fc:frame:button:2" content="📍 Place Pixel" />
        <meta property="fc:frame:button:3" content="🔄 Refresh" />
        <meta property="fc:frame:post_url" content="${baseUrl}/api/frame" /> 
      </head><body>Farcaster Frame Canvas</body></html>
    `;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Error generating frame:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(`Error generating frame: ${errorMessage}`, {
      status: 500,
    });
  }
}

// GET handler untuk tes
export async function GET(req: NextRequest): Promise<Response> {
  return await POST(req);
}
