import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

function getModel(defaultModel) {
  return process.env.OPENAI_MODEL || defaultModel;
}

function getOpenAIClientFromRequest(req) {
  const apiKey = req.header('x-openai-key') || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OpenAI API Key. Set OPENAI_API_KEY in server env or pass x-openai-key header.');
  }
  return new OpenAI({ apiKey });
}

// 1) Chat Completions / Responses
app.post('/api/chat', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { messages, model } = req.body;
    const response = await openai.chat.completions.create({
      model: model || getModel('gpt-4o-mini'),
      messages: messages || [{ role: 'user', content: 'Say hello!' }],
      temperature: 0.7
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 2) Responses (single-turn convenience)
app.post('/api/respond', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { prompt, model } = req.body;
    const response = await openai.responses.create({
      model: model || getModel('gpt-4o-mini'),
      input: prompt || 'Write a short poem about the sea.'
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 3) Vision (image understanding via chat with image url)
app.post('/api/vision', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { imageUrl, question, model } = req.body;
    const response = await openai.chat.completions.create({
      model: model || getModel('gpt-4o-mini'),
      messages: [
        { role: 'user', content: [
          { type: 'text', text: question || 'Describe this image.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]}
      ]
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 4) Image generation
app.post('/api/images/generate', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { prompt, model } = req.body;
    const response = await openai.images.generate({
      model: model || 'gpt-image-1',
      prompt: prompt || 'A cute baby sea otter'
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 5) Image edit (requires base image and optional mask)
app.post('/api/images/edit', upload.fields([{ name: 'image' }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const prompt = req.body.prompt || 'Add a red hat';
    const model = req.body.model || 'gpt-image-1';

    const imagePath = req.files?.image?.[0]?.path;
    if (!imagePath) throw new Error('Missing required image file.');
    const maskPath = req.files?.mask?.[0]?.path;

    const imageStream = fs.createReadStream(imagePath);
    const maskStream = maskPath ? fs.createReadStream(maskPath) : undefined;

    // Some SDKs use openai.images.edit; others use openai.images.edits.create
    let response;
    if (openai.images.edit) {
      response = await openai.images.edit({ model, prompt, image: imageStream, mask: maskStream });
    } else if (openai.images?.edits?.create) {
      response = await openai.images.edits.create({ model, prompt, image: imageStream, mask: maskStream });
    } else {
      throw new Error('Image edit not supported by this SDK version');
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 6) Image variation (requires base image)
app.post('/api/images/variations', upload.single('image'), async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const model = req.body.model || 'gpt-image-1';
    const imagePath = req.file?.path;
    if (!imagePath) throw new Error('Missing required image file.');
    const imageStream = fs.createReadStream(imagePath);

    let response;
    if (openai.images?.variations?.create) {
      response = await openai.images.variations.create({ model, image: imageStream });
    } else if (openai.images?.variations) {
      response = await openai.images.variations({ model, image: imageStream });
    } else {
      throw new Error('Image variations not supported by this SDK version');
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 7) Speech-to-Text (transcriptions)
app.post('/api/audio/transcriptions', upload.single('audio'), async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const model = req.body.model || 'gpt-4o-transcribe';
    const audioPath = req.file?.path;
    if (!audioPath) throw new Error('Missing required audio file.');
    const audioStream = fs.createReadStream(audioPath);

    let response;
    try {
      response = await openai.audio.transcriptions.create({ model, file: audioStream });
    } catch (e) {
      // Fallback to whisper-1 if model unavailable
      response = await openai.audio.transcriptions.create({ model: 'whisper-1', file: audioStream });
    }

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 8) Text-to-Speech (TTS)
app.post('/api/audio/speech', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { input, voice, model, format } = req.body;
    const fmt = (format || 'mp3').toLowerCase();
    const response = await openai.audio.speech.create({
      model: model || 'gpt-4o-mini-tts',
      voice: voice || 'alloy',
      input: input || 'Hello from OpenAI TTS',
      format: fmt
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = fmt === 'wav' ? 'audio/wav' : (fmt === 'ogg' ? 'audio/ogg' : 'audio/mpeg');
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 9) Embeddings
app.post('/api/embeddings', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { input, model } = req.body;
    const response = await openai.embeddings.create({
      model: model || 'text-embedding-3-small',
      input: input || 'Hello world'
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 10) Moderations
app.post('/api/moderations', async (req, res) => {
  try {
    const openai = getOpenAIClientFromRequest(req);
    const { input, model } = req.body;
    const response = await openai.moderations.create({
      model: model || 'omni-moderation-latest',
      input: input || 'I want to hurt someone'
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});