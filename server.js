const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const ROOT = __dirname;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is required. Add it to .env or your environment before starting the server.');
  process.exit(1);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let oversized = false;
    const chunks = [];

    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        return;
      }
      if (!oversized) chunks.push(chunk);
    });

    request.on('end', () => {
      if (oversized) {
        reject(new HttpError(413, 'Image request is too large. Choose an image smaller than 8 MB.'));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Request body must be valid JSON.'));
      }
    });

    request.on('error', () => reject(new HttpError(400, 'Could not read the request body.')));
  });
}

function parseImageDataUrl(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Select a JPEG, PNG, or WebP portrait to analyze.');
  }

  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) {
    throw new HttpError(400, 'Image must be a base64-encoded JPEG, PNG, or WebP file.');
  }

  const imageBytes = Buffer.from(match[2], 'base64');
  if (imageBytes.length === 0 || imageBytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, 'Choose an image smaller than 8 MB.');
  }

  return { mimeType: match[1], data: imageBytes.toString('base64') };
}

function getOutputText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const textParts = [];
  function collectText(value) {
    if (Array.isArray(value)) {
      value.forEach(collectText);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value.text === 'string') textParts.push(value.text);
    for (const key of ['content', 'output', 'outputs', 'steps']) {
      if (value[key]) collectText(value[key]);
    }
  }
  collectText(payload.output || payload.outputs || payload.steps);

  const output = textParts.join('\n').trim();
  if (!output) throw new HttpError(502, 'Gemini returned no critique. Please try again.');
  return output;
}

function parseEvaluation(outputText) {
  const jsonText = outputText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  let evaluation;
  try {
    evaluation = JSON.parse(jsonText);
  } catch {
    throw new HttpError(502, 'Gemini returned an unreadable critique. Please try again.');
  }
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    throw new HttpError(502, 'Gemini returned an incomplete critique. Please try again.');
  }

  const numberInRange = value => {
    if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 10 ? number : null;
  };
  const score = numberInRange(evaluation.score);
  const light = numberInRange(evaluation.light);
  const focus = numberInRange(evaluation.focus);
  if (
    score === null ||
    light === null ||
    focus === null ||
    typeof evaluation.grade !== 'string' ||
    !evaluation.grade.trim() ||
    evaluation.grade.length > 40 ||
    typeof evaluation.critique !== 'string' ||
    !evaluation.critique.trim() ||
    evaluation.critique.length > 500
  ) {
    throw new HttpError(502, 'Gemini returned an incomplete critique. Please try again.');
  }

  return {
    score: score.toFixed(1),
    grade: evaluation.grade.trim(),
    light: light.toFixed(1),
    focus: focus.toFixed(1),
    critique: evaluation.critique.trim()
  };
}

async function analyzeImage(image) {
  const prompt = [
    'Evaluate this portrait as photography, not as a judgment of the person.',
    'Assess only composition, lighting, focus, and framing. Do not identify the person or infer attractiveness, age, ethnicity, gender, personality, or other sensitive traits.',
    'Give an overall photography score and separate lighting and focus scores from 0 to 10. Be fair, specific, and constructive. If an aspect cannot be judged, reflect that uncertainty in the score and critique.',
    'Return only a JSON object with exactly these fields: score (number), grade (short string), light (number), focus (number), critique (2-3 concise sentences). Do not use markdown.'
  ].join(' ');

  let response;
  try {
    response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        model: 'gemini-3.8-flash',
        store: false,
        input: [
          { type: 'text', text: prompt },
          { type: 'image', data: image.data, mime_type: image.mimeType }
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
  } catch (error) {
    console.error('Gemini request could not be completed:', error.message);
    throw new HttpError(502, 'Could not connect to Gemini. Check your network connection and try again.');
  }

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, `Gemini returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    const message = payload.error && typeof payload.error.message === 'string'
      ? payload.error.message
      : `Gemini request failed (HTTP ${response.status}).`;
    throw new HttpError(502, message);
  }

  return parseEvaluation(getOutputText(payload));
}

function serveStaticFile(requestPath, response) {
  const files = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/index.html': ['index.html', 'text/html; charset=utf-8'],
    '/RateMyDP_Logo.png': ['RateMyDP_Logo.png', 'image/png']
  };
  const file = files[requestPath];
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const filePath = path.join(ROOT, file[0]);
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      console.error(`Could not read ${file[0]}:`, error.message);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Could not load the application.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': file[1],
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    response.end(contents);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(response, 200, { ready: true });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/analyze') {
    try {
      const body = await readJsonBody(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HttpError(400, 'Request body must be a JSON object.');
      }
      const image = parseImageDataUrl(body.imageDataUrl);
      sendJson(response, 200, await analyzeImage(image));
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
      } else {
        console.error('Portrait analysis failed:', error.message);
        sendJson(response, 500, { error: 'Portrait analysis failed. Please try again.' });
      }
    }
    return;
  }

  if (request.method === 'GET') {
    serveStaticFile(requestUrl.pathname, response);
    return;
  }

  response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, POST' });
  response.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`Rate My DP is running at http://${HOST}:${PORT}`);
});
