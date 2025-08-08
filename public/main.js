async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function showJSON(el, data) {
  el.textContent = JSON.stringify(data, null, 2);
}

// 1) Chat
const chatBtn = document.getElementById('chat_btn');
chatBtn.onclick = async () => {
  const out = document.getElementById('chat_out');
  out.textContent = 'Loading...';
  try {
    const input = document.getElementById('chat_input').value || 'Say hello!';
    const resp = await postJSON('/api/chat', {
      messages: [{ role: 'user', content: input }]
    });
    showJSON(out, resp);
  } catch (e) { out.textContent = e.message; }
};

// 2) Responses
const respBtn = document.getElementById('resp_btn');
respBtn.onclick = async () => {
  const out = document.getElementById('resp_out');
  out.textContent = 'Loading...';
  try {
    const prompt = document.getElementById('resp_prompt').value || 'Write a haiku about the moon.';
    const resp = await postJSON('/api/respond', { prompt });
    showJSON(out, resp);
  } catch (e) { out.textContent = e.message; }
};

// 3) Vision
const visionBtn = document.getElementById('vision_btn');
visionBtn.onclick = async () => {
  const out = document.getElementById('vision_out');
  out.textContent = 'Loading...';
  try {
    const imageUrl = document.getElementById('vision_img').value;
    const question = document.getElementById('vision_q').value || 'What is in this image?';
    const resp = await postJSON('/api/vision', { imageUrl, question });
    showJSON(out, resp);
  } catch (e) { out.textContent = e.message; }
};

// 4) Image generation
const imgBtn = document.getElementById('img_btn');
imgBtn.onclick = async () => {
  const out = document.getElementById('img_out');
  out.textContent = 'Generating...';
  try {
    const prompt = document.getElementById('img_prompt').value || 'A cute baby sea otter';
    const resp = await postJSON('/api/images/generate', { prompt });
    out.textContent = '';
    const data = resp.data?.[0];
    if (data?.url) {
      const img = document.createElement('img');
      img.src = data.url;
      out.appendChild(img);
    } else if (data?.b64_json) {
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,' + data.b64_json;
      out.appendChild(img);
    } else {
      showJSON(out, resp);
    }
  } catch (e) { out.textContent = e.message; }
};

// 5) Image edit
const imgeditBtn = document.getElementById('imgedit_btn');
imgeditBtn.onclick = async () => {
  const out = document.getElementById('imgedit_out');
  out.textContent = 'Editing...';
  try {
    const prompt = document.getElementById('imgedit_prompt').value || 'Add a red hat';
    const imgFile = document.getElementById('imgedit_image').files[0];
    const maskFile = document.getElementById('imgedit_mask').files[0];
    const fd = new FormData();
    fd.append('prompt', prompt);
    if (imgFile) fd.append('image', imgFile);
    if (maskFile) fd.append('mask', maskFile);
    const res = await fetch('/api/images/edit', { method: 'POST', body: fd });
    const resp = await res.json();
    out.textContent = '';
    const data = resp.data?.[0];
    if (data?.url) {
      const img = document.createElement('img');
      img.src = data.url;
      out.appendChild(img);
    } else if (data?.b64_json) {
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,' + data.b64_json;
      out.appendChild(img);
    } else {
      showJSON(out, resp);
    }
  } catch (e) { out.textContent = e.message; }
};

// 6) Image variations
const imgvarBtn = document.getElementById('imgvar_btn');
imgvarBtn.onclick = async () => {
  const out = document.getElementById('imgvar_out');
  out.textContent = 'Creating variations...';
  try {
    const imgFile = document.getElementById('imgvar_image').files[0];
    const fd = new FormData();
    if (imgFile) fd.append('image', imgFile);
    const res = await fetch('/api/images/variations', { method: 'POST', body: fd });
    const resp = await res.json();
    out.textContent = '';
    const data = resp.data?.[0];
    if (data?.url) {
      const img = document.createElement('img');
      img.src = data.url;
      out.appendChild(img);
    } else if (data?.b64_json) {
      const img = document.createElement('img');
      img.src = 'data:image/png;base64,' + data.b64_json;
      out.appendChild(img);
    } else {
      showJSON(out, resp);
    }
  } catch (e) { out.textContent = e.message; }
};

// 7) Speech to Text
const sttBtn = document.getElementById('stt_btn');
sttBtn.onclick = async () => {
  const out = document.getElementById('stt_out');
  out.textContent = 'Transcribing...';
  try {
    const audioFile = document.getElementById('stt_audio').files[0];
    const fd = new FormData();
    if (audioFile) fd.append('audio', audioFile);
    const res = await fetch('/api/audio/transcriptions', { method: 'POST', body: fd });
    const resp = await res.json();
    showJSON(out, resp);
  } catch (e) { out.textContent = e.message; }
};

// 8) Text to Speech
const ttsBtn = document.getElementById('tts_btn');
ttsBtn.onclick = async () => {
  const audio = document.getElementById('tts_audio');
  const text = document.getElementById('tts_text').value || 'Hello from OpenAI TTS';
  const res = await fetch('/api/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text })
  });
  const blob = await res.blob();
  audio.src = URL.createObjectURL(blob);
  audio.play();
};

// 9) Embeddings
const embBtn = document.getElementById('emb_btn');
embBtn.onclick = async () => {
  const out = document.getElementById('emb_out');
  out.textContent = 'Embedding...';
  try {
    const input = document.getElementById('emb_input').value || 'Hello world';
    const resp = await postJSON('/api/embeddings', { input });
    showJSON(out, resp);
  } catch (e) { out.textContent = e.message; }
};

// 10) Moderations
const modBtn = document.getElementById('mod_btn');
modBtn.onclick = async () => {
  const out = document.getElementById('mod_out');
  out.textContent = 'Checking...';
  try {
    const input = document.getElementById('mod_input').value || 'I want to hurt someone';
    const resp = await postJSON('/api/moderations', { input });
    showJSON(out, resp);
  } catch (e) { out.textContent = e.message; }
};