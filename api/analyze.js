
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const GEMINI_INTERACTIONS_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function parseImageDataUrl(value) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Please select an image.');
  }

  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/
  );

  if (!match) {
    throw new HttpError(400, 'Image must be JPEG, PNG, or WebP.');
  }

  const imageBytes = Buffer.from(match[2], 'base64');

  if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(413, 'Choose an image smaller than 3 MB.');
  }

  return {
    mimeType: match[1],
    data: imageBytes.toString('base64')
  };
}

function getOutputText(payload) {
  if (typeof payload.output_text === 'string' &&
      payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const textParts = [];

  function collectText(value) {
    if (Array.isArray(value)) {
      value.forEach(collectText);
      return;
    }

    if (!value || typeof value !== 'object') return;

    if (typeof value.text === 'string') {
      textParts.push(value.text);
    }

    for (const key of ['content', 'output', 'outputs', 'steps']) {
      if (value[key]) collectText(value[key]);
    }
  }

  collectText(payload.output || payload.outputs || payload.steps);

  const output = textParts.join('\n').trim();

  if (!output) {
    throw new HttpError(502, 'Gemini returned no critique.');
  }

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
    throw new HttpError(502, 'Gemini returned unreadable data.');
  }

  const numberInRange = value => {
    if (typeof value !== 'number' &&
        !(typeof value === 'string' && value.trim())) return null;

    const number = Number(value);

    return Number.isFinite(number) &&
      number >= 0 && number <= 10 ? number : null;
  };

  const score = numberInRange(evaluation.score);
  const light = numberInRange(evaluation.light);
  const focus = numberInRange(evaluation.focus);

  if (
    score === null || light === null || focus === null ||
    typeof evaluation.gradeEnglish !== 'string' ||
    typeof evaluation.gradeSinhala !== 'string' ||
    typeof evaluation.critiqueEnglish !== 'string' ||
    typeof evaluation.critiqueSinhala !== 'string' ||
    !evaluation.gradeEnglish.trim() ||
    !evaluation.gradeSinhala.trim() ||
    !evaluation.critiqueEnglish.trim() ||
    !evaluation.critiqueSinhala.trim()
  ) {
    throw new HttpError(502, 'Gemini returned an incomplete critique.');
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
    'Evaluate this portrait as photography, not as a judgment of the person.',
    'Assess only composition, lighting, focus, and framing.',
    'Do not identify the person or infer attractiveness, age, ethnicity, gender, or personality.',
    'Give an overall photography score and separate lighting and focus scores from 0 to 10.',
    'Be fair, specific, and constructive.',
    'Return one JSON object with exactly these fields:',
    'score (number), gradeEnglish (short English string),',
    'gradeSinhala (short conversational Sinhala-English string),',
    'light (number), focus (number),',
    'critiqueEnglish (2-3 concise English sentences),',
    'critiqueSinhala (2-3 concise sentences in simple conversational Sinhala mixed with familiar English photography terms).',
    'Do not use markdown.'
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
          {
            type: 'image',
            data: image.data,
            mime_type: image.mimeType
          }
        ]
      }),
      signal: AbortSignal.timeout(240000)
    });
  } catch (error) {
    console.error('Gemini connection error:', error.message);
    throw new HttpError(502, 'Could not connect to Gemini. Please try again.');
  }

  const responseText = await response.text();

  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new HttpError(502, 'Gemini returned an invalid response.');
  }

  if (!response.ok) {
    const message = payload.error?.message ||
      `Gemini request failed (HTTP ${response.status}).`;

    console.error('Gemini API error:', message);
    throw new HttpError(502, message);
  }

  return parseEvaluation(getOutputText(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'Gemini API key is not configured.'
    });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Invalid request body.');
    }

    const image = parseImageDataUrl(body.imageDataUrl);
    const result = await analyzeImage(image);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Analysis error:', error);

    const status = error instanceof HttpError
      ? error.status
      : 500;

    return res.status(status).json({
      error: error.message || 'Portrait analysis failed.'
    });
  }
};
