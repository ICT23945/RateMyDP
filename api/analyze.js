
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_CRITIQUE_LENGTH = 8000;

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
    !evaluation.critiqueSinhala.trim() ||
    evaluation.critiqueEnglish.length > MAX_CRITIQUE_LENGTH ||
    evaluation.critiqueSinhala.length > MAX_CRITIQUE_LENGTH
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

/*async function analyzeImage(image) {
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
  ].join(' ');*/

async function analyzeImage(image) {
  const prompt = [
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

    /*'DEEP PHOTOGRAPHIC ANALYSIS:',
    'Analyse the actual visual content of every uploaded photograph independently. Do not follow a fixed evaluation pattern or repeatedly generate similar feedback for different photographs.',
    'Carefully examine the placement, positioning, alignment, size, spacing, and relationship between the subject and other visible objects.',
    'Evaluate whether the arrangement of objects supports or weakens the overall composition.',
    'Identify distracting objects, unnecessary empty spaces, awkward cropping, unbalanced arrangements, and visual elements that compete with the main subject.',
    'Look for unusual, inconsistent, or visually mismatched elements in the photograph. If something genuinely affects the photographic quality, explain it. Do not invent problems.',
    'Do not automatically apply every photography concept to every photograph. Only discuss concepts that are relevant and visibly assessable.',
    'Make every evaluation specific to the actual photograph. Different photographs should receive genuinely different observations when their visual characteristics differ.',

    'EDUCATIONAL AND CONSTRUCTIVE FEEDBACK:',
    'Assume the photographer may be a beginner who wants to improve practical photography skills.',
    'Do not simply identify what is good or bad. Explain WHY a particular photographic decision works or does not work.',
    'When identifying a weakness, explain how it affects the final photograph and what the photographer could practically do differently when capturing a similar image.',
    'Where appropriate, mention relevant photography concepts and techniques that could help the photographer improve.',
    'Explain both strong points and weaknesses in a balanced way. Do not exaggerate minor imperfections or give unnecessary criticism.',
    'Combine related observations into natural, meaningful explanations rather than presenting disconnected, repetitive, or extremely short sentences.',
    'Feedback should help the photographer understand the photograph and learn practical photography techniques, not merely receive a score.',*/

    /*
    'You are a professional portrait photography evaluator.',
    
    'FIRST, validate the uploaded image before performing any evaluation.',
    
    'IMAGE VALIDATION RULES:',
    '1. The image MUST contain at least one real, visible human face.',
    '2. The image MUST be a portrait photograph where a human face is the main subject.',
    '3. Accept close-up, headshot, selfie, half-body, and full-body portraits, provided a human face is clearly visible and is a main subject.',
    '4. Reject images containing only non-living objects, such as tables, books, chairs, vehicles, buildings, food, or landscapes.',
    '5. Reject animals, cartoons, illustrations, paintings, avatars, artificial human figures, and AI-generated fictional characters.',
    '6. Reject group photographs if no individual human portrait can be meaningfully evaluated.',
    '7. Reject images where the face is missing, completely obscured, too small, or too unclear to evaluate.',
    '8. Do not accept an image merely because it contains a human body part. A recognizable human face must be visible.',
    
    'REJECTION RULE:',
    'If the image does not satisfy ALL required portrait conditions, do not evaluate it.',
    'Return the following JSON object:',
    '{"valid":false,"reason":"A short, friendly explanation of why the image cannot be evaluated."}',
    
    'PORTRAIT EVALUATION:',
    'If the image passes validation, evaluate its photography quality, not the person.',
    'Assess composition, lighting, focus, framing, background, camera perspective, and colour balance.',
    'Give an overall photography score from 0 to 10.',
    'Give separate lighting and focus scores from 0 to 10.',
    'Provide specific strengths and weaknesses based on visible photographic evidence.',
    'Be fair, constructive, and avoid generic feedback.',
    'Do not identify the person or infer attractiveness, age, ethnicity, gender, or personality.',
    'Do not guess camera specifications or technical settings that cannot be observed.',
    
    'SUCCESSFUL EVALUATION JSON:',
    'Return exactly these fields:',
    'valid (boolean),',
    'score (number),',
    'gradeEnglish (short English string),',
    'gradeSinhala (short conversational Sinhala-English string),',
    'light (number),',
    'focus (number),',
    'critiqueEnglish (2-3 concise English sentences),',
    'critiqueSinhala (2-3 concise Sinhala-English sentences).',
    
    'SINHALA-ENGLISH LANGUAGE RULES:',
    'Write Sinhala words using Sinhala Unicode script.',
    'Keep familiar photography terms in English.',
    'Use simple, natural conversational Sinhala mixed with English.',
    'Never use romanized Sinhala or Singlish transliteration.',
    'Avoid overly formal or literary Sinhala.',
    'Example: "Composition එක හොඳයි. Subject එක gridlines වලට align වෙන විදිහට capture කරලා තියෙනවා."',
    
    'Return only valid JSON without markdown or additional explanations.'
  ].join(' ');*/

  /*const prompt = [
    'Evaluate this portrait as photography, not as a judgment of the person.',
    'Assess composition, lighting, focus, framing, background, camera perspective, and colour balance.',
    'Do not identify the person or infer attractiveness, age, ethnicity, gender, or personality.',
    'Do not guess camera specifications or technical settings that cannot be observed from the image.',
    'Give an overall photography score and separate lighting and focus scores from 0 to 10.',
    'Be fair, specific, detailed, and constructive. Explain actual strengths and weaknesses visible in the image.',
    'Avoid generic feedback. Give observations that are specifically relevant to this photograph.',
    'Return one valid JSON object with exactly these fields:',
    'score (number), gradeEnglish (short English string),',
    'gradeSinhala (short conversational Sinhala-English string),',
    'light (number), focus (number),',
    'critiqueEnglish (2-3 concise English sentences),',
    'critiqueSinhala (2-3 concise sentences in natural Sinhala-English).',
    'IMPORTANT LANGUAGE RULES FOR gradeSinhala AND critiqueSinhala:',
    'Write all Sinhala words using Sinhala Unicode script.',
    'Keep familiar photography and technical terms in English, such as lighting, composition, focus, framing, background, exposure, and gridlines.',
    'Use simple, natural, conversational Sinhala mixed with English.',
    'Do not write Sinhala words using English letters (no romanized Sinhala or Singlish transliteration).',
    'Avoid overly formal or literary Sinhala.',
    'Do not translate common English photography terms unnecessarily.',
    'Example of the required language style: "Composition එක හොඳයි. Subject එක gridlines වලට align වෙන විදිහට capture කරලා තියෙනවා. Background එකේ distractions ටිකක් අඩු කළා නම් photo එක තවත් හොඳ වෙන්න තිබුණා."',
    'Do not use markdown.',
    'Return only valid JSON without additional text.',
    'Use conversational Sinhala mixed with English.',
    'Write Sinhala words using Sinhala Unicode script.',
    'Keep common photography and technical terms in English.',
    'Use natural, simple Sinhala sentence structures.',
    'Avoid formal or literary Sinhala.',
    'Do not use romanized Sinhala (Singlish).',
    'Do not translate technical photography terms unnecessarily.',
    'Return the feedback as plain text, without Markdown.',
    'Example style:-Lighting එක ටිකක් flat වගේ. Composition එක හොඳයි, නමුත් subject එකේ focus තවත් sharp වෙන්න තිබුණා.',
    'If the photographer who captured this photo, may be having lack of knowledge and the sills about the photography field. Then that photo may be not good when considering about concepts which must be used during the capturing images. Then should be explain strong points and weaknesses of that captured image as helpful for gaining the practical knowledge also. should be have a good combination of those replay sentences instead of shorter separate sentences.',
    'And this is the main thing, Do not limit to the same kind of characteristics, it looks the precess is being in locally and it gives the same results for all, really analyze the content of the photo including obejct placement also. if you see any unmacthing analyzes, then give your comment about that'].join(' ');*/
    
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
      signal: AbortSignal.timeout(360000)
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
