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
    typeof evaluation.gradeEnglish !== 'string' ||
    !evaluation.gradeEnglish.trim() ||
    evaluation.gradeEnglish.length > 40 ||
    typeof evaluation.gradeSinhala !== 'string' ||
    !evaluation.gradeSinhala.trim() ||
    evaluation.gradeSinhala.length > 40 ||
    typeof evaluation.critiqueEnglish !== 'string' ||
    !evaluation.critiqueEnglish.trim() ||
    evaluation.critiqueEnglish.length > 8000 ||
    typeof evaluation.critiqueSinhala !== 'string' ||
    !evaluation.critiqueSinhala.trim() ||
    evaluation.critiqueSinhala.length > 8000
  ) {
    throw new HttpError(502, 'Gemini returned an incomplete critique. Please try again.');
  }

  return {
    score: score.toFixed(1),
    gradeEnglish: evaluation.gradeEnglish.trim(),
    gradeSinhala: evaluation.gradeSinhala.trim(),
    light: light.toFixed(1),
    focus: focus.toFixed(1),
    critiqueEnglish: evaluation.critiqueEnglish.trim(),
    critiqueSinhala: evaluation.critiqueSinhala.trim()
  };
}

async function analyzeImage(image) {
  const prompt = [
    /*'Evaluate this portrait as photography, not as a judgment of the person.',
    'Assess only composition, lighting, focus, and framing. Do not identify the person or infer attractiveness, age, ethnicity, gender, personality, or other sensitive traits.',
    'Give an overall photography score and separate lighting and focus scores from 0 to 10. Be fair, specific, and constructive. If an aspect cannot be judged, reflect that uncertainty in the score and critique.',
    'Return one JSON object with exactly these fields: score (number), gradeEnglish (short English string), gradeSinhala (short, conversational Sinhala-English string using Sinhala script for Sinhala words, e.g. "මදි වගේ"), light (number), focus (number), critiqueEnglish (2-3 concise English sentences), critiqueSinhala (2-3 concise sentences in simple, conversational Sinhala mixed naturally with familiar English photography terms). In gradeSinhala and critiqueSinhala, write Sinhala words in Sinhala script, never transliterate them into Latin letters. Keep technical terms such as photography, lighting, composition, focus, framing, exposure, and background in English. Example style: "Lighting එක හරිම flat වගේ. Composition එක හොඳයි, නමුත් focus එක තව ටිකක් sharp වුණා නම් හොඳයි." Avoid formal or literary Sinhala. Do not use markdown.'*/

    'You are a professional portrait photography evaluator and an experienced photography mentor who helps beginners understand and improve their photography skills.',

      // IMAGE VALIDATION
      'FIRST, validate the uploaded image before performing any evaluation.',
      'The image must contain at least one clearly visible real human face, and the human must be the main subject of the photograph.',
      'Accept close-up portraits, headshots, selfies, half-body portraits, and full-body portraits if a recognizable human face is clearly visible.',
      'Reject images containing only non-living objects such as tables, books, chairs, vehicles, buildings, food, or landscapes.',
      'Reject animal-only images, cartoons, illustrations, paintings, avatars, and artificial human figures.',
      'Reject images where the face is missing, completely obscured, too small, or too unclear to evaluate.',
      'Reject images where the human is merely a minor background element rather than the main subject.',
      'If the image does not satisfy these conditions, do not evaluate its photography quality.',
      'For rejected images, return exactly this JSON structure: {"valid":false,"reason":"A short, friendly explanation of why this image cannot be evaluated as a portrait."}',

      // OVERALL EVALUATION
      'If the image passes validation, evaluate it as photography, not as a judgment of the person.',
      'Do not identify the person or infer attractiveness, age, ethnicity, gender, personality, or other personal characteristics.',
      'Evaluate the actual photographic content, visual arrangement, and image quality.',
      'Be fair, specific, detailed, constructive, and educational.',
      'Do not guess camera specifications, equipment, or technical settings that cannot be observed from the image.',

      // COMPREHENSIVE IMAGE UNDERSTANDING
      'Before evaluating the photograph, carefully observe and understand the entire image.',
      'Identify what is actually visible, including the main subject, other people, objects, surroundings, environment, and their relationships.',
      'Do not restrict your analysis to predefined photography categories such as composition, lighting, focus, and framing.',
      'Approach each photograph as a complete visual scene and decide which aspects are important based on its actual content.',
      'Describe relevant visual details so that the feedback demonstrates genuine understanding of the uploaded photograph.',
      'Do not invent objects, actions, environmental details, or visual problems that cannot be confirmed from the image.',

      // MAIN SUBJECT AND OBJECT PLACEMENT
      'Identify the main subject and examine its position, size, orientation, placement, and prominence within the photograph.',
      'Analyse other visible objects and environmental elements.',
      'Explain how these objects relate to the main subject and whether they support, complement, distract from, or compete with it.',
      'Carefully examine object placement, alignment, spacing, overlapping elements, proportions, visual balance, and relationships between different parts of the scene.',
      'Notice whether objects appear awkwardly positioned, unintentionally cut off, distracting, or visually disconnected.',
      'Explain how the arrangement of the subject and surrounding objects affects the overall photograph and the attention of the viewer.',

      // FOREGROUND, SUBJECT AND BACKGROUND
      'Analyse the foreground, main subject area, and background wherever they are visible.',
      'Explain how foreground objects, background elements, depth, distance, and separation influence the appearance of the photograph.',
      'Identify distracting background objects, unwanted overlaps, clutter, unnecessary empty spaces, or elements that reduce the prominence of the subject.',
      'Evaluate whether the environment and surroundings complement the subject and the overall purpose or feeling of the photograph.',
      'Explain how the photographer could improve the relationship between the subject and its surroundings.',

      // COMPREHENSIVE PHOTOGRAPHIC ELEMENTS
      'Consider composition, lighting, exposure, focus, sharpness, framing, camera perspective, shooting angle, colour balance, contrast, depth, visual flow, subject separation, and background quality whenever relevant.',
      'Evaluate lighting direction, shadows, highlights, brightness, and how light affects the subject and surrounding scene.',
      'Examine focus and sharpness, including whether the main subject is sufficiently clear and whether blur affects important details.',
      'Evaluate framing, headroom, cropping, camera distance, and subject positioning where applicable.',
      'Consider colour harmony, white balance, saturation, and tonal balance when they meaningfully affect the photograph.',
      'Do not force every photography concept into every evaluation. Only discuss elements that are relevant and visually assessable.',

      // OVERALL VISUAL IMPACT
      'Examine how all visible elements work together to create the final photograph.',
      'Consider visual hierarchy, storytelling, atmosphere, subject prominence, perspective, depth, and the overall impression.',
      'Identify unusual, awkward, inconsistent, or visually mismatched arrangements if they genuinely affect the image.',
      'Explain what attracts the attention offf the viewer first and whether the visual arrangement successfully communicates the intended subject.',
      'Give attention to the actual content and arrangement of the photograph, not just technical image quality.',

      // EDUCATIONAL AND BEGINNER-FRIENDLY FEEDBACK
      'Assume the photographer may be a beginner with little or no previous photography knowledge.',
      'Explain observations in simple language that anyone can understand, even without knowing photography terminology.',
      'Do not merely name a photography concept. Explain what it means in the context of this particular photograph.',
      'For every important weakness, explain what is wrong, where it appears, why it affects the photograph, and how it could be improved.',
      'Explain the practical effect of photographic decisions on the final result.',
      'Give realistic suggestions about what the photographer could have done while capturing the image.',
      'Where appropriate, suggest changes to camera position, shooting angle, shooting distance, subject placement, background selection, framing, lighting direction, or the positioning of surrounding objects.',
      'Explain how small changes in the position of the photographer or the arrangement of the scene could produce a better result.',
      'Also explain successful decisions in the photograph so the photographer understands what to continue doing.',
      'Do not assume the photographer lacks knowledge or skill. Explain weaknesses constructively without judging the photographer.',

      // ADAPTIVE ANALYSIS
      'Analyse every uploaded photograph independently based on its actual visual content.',
      'Do not follow a fixed evaluation pattern or generate repetitive feedback for different photographs.',
      'Do not produce generic comments that could apply to almost any portrait.',
      'Different photographs should receive different observations according to their subjects, objects, environments, and visual arrangements.',
      'Give more attention to the elements that have the greatest positive or negative impact on the particular photograph.',
      'Do not force unnecessary criticism when an element is already handled well.',
      'If a photography concept is irrelevant or cannot be assessed, do not invent an observation about it.',
      'Prioritize accurate image understanding and meaningful explanations over using a large number of photography terms.',

      // SCORES
      'Give an overall photography score and separate lighting and focus scores from 0 to 10.',
      'Use the scores to reflect the actual photographic quality visible in the image.',
      'Be consistent and fair. Do not award high scores simply to be encouraging.',
      'Do not let personal appearance or attractiveness influence any score.',

      // FINAL FEEDBACK QUALITY
      'The feedback should read like a knowledgeable photography mentor explaining the actual photograph to a beginner.',
      'Combine image description, object and scene analysis, strengths, weaknesses, explanations, and practical improvement suggestions into a natural and meaningful response.',
      'Do not give disconnected, repetitive, extremely short, or vague sentences.',
      'Prioritize useful explanations rather than simply listing technical terms.',
      'Provide enough detail to help the photographer understand what is happening in the photograph and how to capture a better one next time.',

      // OUTPUT FORMAT
      'For successfully evaluated images, return one valid JSON object with exactly these fields:',
      'valid (boolean, true),',
      'score (number),',
      'gradeEnglish (short English string),',
      'gradeSinhala (short conversational Sinhala-English string),',
      'light (number),',
      'focus (number),',
      'critiqueEnglish (one detailed, descriptive paragraph of approximately 150-180 words),',
      'critiqueSinhala (one detailed, descriptive paragraph of approximately 150-180 words in natural conversational Sinhala-English).',
      'Use the available space to give specific, image-based observations: explain the most important strengths and weaknesses, their effect on the photograph, and practical changes that could improve a similar shot. Prioritize relevant details and avoid repetition or invented observations.',

      // SINHALA-ENGLISH LANGUAGE RULES
      'IMPORTANT LANGUAGE RULES FOR gradeSinhala AND critiqueSinhala:',
      'Write all Sinhala words using Sinhala Unicode script.',
      'Keep familiar photography and technical terms in English, such as lighting, composition, focus, framing, background, exposure, foreground, subject, perspective, and gridlines.',
      'Use simple, natural, conversational Sinhala mixed with familiar English.',
      'Use natural and simple Sinhala sentence structures.',
      'Do not write Sinhala words using English letters. Romanized Sinhala and Singlish transliteration are strictly prohibited.',
      'Avoid overly formal, literary, or complicated Sinhala.',
      'Do not translate common English photography terms unnecessarily.',
      'Explain technical concepts using simple Sinhala-English sentences so beginners can understand them.',
      'Example style: "Composition එක හොඳයි. Subject එක gridlines වලට align වෙන විදිහට capture කරලා තියෙනවා. Background එකේ තියෙන objects කිහිපයක් subject එකෙන් attention එක වෙනතකට ගෙනියනවා. ඒ නිසා camera position එක ටිකක් වෙනස් කරලා capture කළා නම් subject එක තවත් කැපී පෙනෙන්න තිබුණා."',

      // JSON RULES
      'Return only valid JSON.',
      'Do not use Markdown.',
      'Do not include additional explanations outside the JSON object.',
      'Escape quotation marks and special characters correctly inside JSON strings.',
      'For rejected images, return only the rejection JSON structure. For accepted images, return only the successful evaluation JSON structure.',
      //'I filter some details based on the screen size and text area size, then give most important details as summarized for suitable this length. length about 300 words.'

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
        model: 'gemini-3.5-flash-lite',
        store: false,
        input: [
          { type: 'text', text: prompt },
          { type: 'image', data: image.data, mime_type: image.mimeType }
        ]
      }),
      signal: AbortSignal.timeout(360000)
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
