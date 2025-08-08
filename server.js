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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

function getModel(defaultModel) {
  return process.env.OPENAI_MODEL || defaultModel;
}

// 1) Chat Completions / Responses
app.post('/api/chat', async (req, res) => {
  try {
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
    const prompt = req.body.prompt || 'Add a red hat';
    const model = req.body.model || 'gpt-image-1';

    const imagePath = req.files?.image?.[0]?.path;
    const maskPath = req.files?.mask?.[0]?.path;

    const imageStream = fs.createReadStream(imagePath);
    const maskStream = maskPath ? fs.createReadStream(maskPath) : undefined;

    const response = await openai.images.edit({
      model,
      prompt,
      image: imageStream,
      mask: maskStream
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 6) Image variation (requires base image)
app.post('/api/images/variations', upload.single('image'), async (req, res) => {
  try {
    const model = req.body.model || 'gpt-image-1';
    const imagePath = req.file?.path;
    const imageStream = fs.createReadStream(imagePath);

    const response = await openai.images.variations.create({
      model,
      image: imageStream
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 7) Speech-to-Text (transcriptions)
app.post('/api/audio/transcriptions', upload.single('audio'), async (req, res) => {
  try {
    const model = req.body.model || 'gpt-4o-transcribe';
    const audioPath = req.file?.path;
    const audioStream = fs.createReadStream(audioPath);

    const response = await openai.audio.transcriptions.create({
      model,
      file: audioStream
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 8) Text-to-Speech (TTS)
app.post('/api/audio/speech', async (req, res) => {
  try {
    const { input, voice, model, format } = req.body;
    const response = await openai.audio.speech.create({
      model: model || 'gpt-4o-mini-tts',
      voice: voice || 'alloy',
      input: input || 'Hello from OpenAI TTS',
      format: format || 'mp3'
    });

    // Return audio as binary
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// 9) Embeddings
app.post('/api/embeddings', async (req, res) => {
  try {
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