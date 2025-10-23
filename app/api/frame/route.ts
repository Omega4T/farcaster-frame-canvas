import { NextRequest} from 'next/server';
import { Redis } from '@upstash/redis';
import { createCanvas } from 'canvas';

const CANVAS_SIZE = 16;
const PIXEL_SIZE = 20;
const CANVAS_KEY = 'frame-canvas-state';

async function getCanvasState(): Promise<string[][]> { // Kembalikan ke Promise<string[][]>
  const redis = Redis.fromEnv();
  
  console.log('Attempting to get canvas state from Redis...');
  // Baca data tanpa menentukan tipe spesifik dulu
  const redisData = await redis.get(CANVAS_KEY); 
  console.log(`Raw data type from Redis: ${typeof redisData}`);
  console.log('Raw data from Redis:', redisData);

  let canvasState: string[][] | null = null;

  if (!redisData) {
    console.log('No canvas state found in Redis. Initializing...');
    canvasState = Array(CANVAS_SIZE).fill(0).map(() => Array(CANVAS_SIZE).fill('#FFFFFF'));
    await redis.set(CANVAS_KEY, JSON.stringify(canvasState)); // Tetap simpan sebagai string
    console.log('Successfully initialized canvas state.');
  } else if (typeof redisData === 'object') {
    // Jika SUDAH berupa objek (SDK Upstash otomatis parse), langsung gunakan
    console.log('Redis data is already an object/array, using directly.');
    canvasState = redisData as string[][]; // Kita beri tahu TypeScript tipenya
  } else if (typeof redisData === 'string') {
    // Jika masih berupa string, BARU kita parse
    console.log('Redis data is a string. Attempting to parse...');
    try {
      canvasState = JSON.parse(redisData);
      console.log('Successfully parsed canvas state string.');
    } catch (parseError) {
      console.error("Failed to parse canvas string from Redis:", parseError);
      console.error("Invalid string was:", redisData);
      // Jika parse gagal, kembalikan kanvas default
      canvasState = Array(CANVAS_SIZE).fill(0).map(() => Array(CANVAS_SIZE).fill('#FF0000')); // Error state
    }
  } else {
      // Tipe data tidak dikenal
      console.error("Unexpected data type received from Redis:", typeof redisData);
      canvasState = Array(CANVAS_SIZE).fill(0).map(() => Array(CANVAS_SIZE).fill('#FFA500')); // Warna oranye tanda tipe aneh
  }

  // Pastikan kita selalu mengembalikan array 2D
  return canvasState || Array(CANVAS_SIZE).fill(0).map(() => Array(CANVAS_SIZE).fill('#FFFFFF'));
}

function drawCanvas(canvasState: string[][] | null): Buffer | null { // Terima null
  if (!canvasState) return null; // Kembalikan null jika state tidak valid
  
  const width = CANVAS_SIZE * PIXEL_SIZE;
  const height = CANVAS_SIZE * PIXEL_SIZE;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Gambar latar belakang (misal hitam) untuk memastikan ada sesuatu
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  try {
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        // Tambahkan pengecekan jika state tidak lengkap
        if (canvasState[y] && typeof canvasState[y][x] === 'string') {
          ctx.fillStyle = canvasState[y][x];
        } else {
          ctx.fillStyle = '#FF0000'; // Warna merah jika data aneh
        }
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
    console.log('Canvas drawn successfully.');
    return canvas.toBuffer('image/png');
  } catch(drawError) {
    console.error('Error during canvas drawing:', drawError);
    return null; // Kembalikan null jika menggambar gagal
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  console.log('POST request received');
  try {
    const canvasState = await getCanvasState();
    
    // Penanganan jika getCanvasState mengembalikan null
    if (!canvasState) {
        console.error("getCanvasState returned null.");
        return new Response("Error retrieving canvas state", { status: 500 });
    }

    const imageBuffer = drawCanvas(canvasState);

    // Penanganan jika drawCanvas mengembalikan null
    if (!imageBuffer) {
        console.error("drawCanvas returned null.");
        return new Response("Error drawing canvas", { status: 500 });
    }

    const imageDataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

    console.log('Generating HTML response...');
    const html = `
      <!DOCTYPE html><html><head>
        <meta property="og:title" content="Frame Canvas - Debug" />
        <meta property="og:image" content="${imageDataUrl}" />
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageDataUrl}" />
        <meta property="fc:frame:button:1" content="Debug Button 1" />
        <meta property="fc:frame:post_url" content="${baseUrl}/api/frame" /> 
      </head><body>Farcaster Frame Canvas (Debug Mode)</body></html>
    `;
    console.log('HTML response generated successfully.');
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' }});

  } catch (error) {
    console.error("Critical error in POST handler:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Critical Error: ${errorMessage}`, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
    console.log('GET request received');
    return await POST(req); 
}