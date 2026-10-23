const exprEl = document.getElementById('expr');
const resultEl = document.getElementById('result');
let expr = '';

const OPS = '+-*/%';
const SYMBOLS = { '*': '×', '/': '÷', '-': '−' };

// Recursive-descent evaluator (no eval). Grammar:
//   expr   := term (('+'|'-') term)*
//   term   := factor (('*'|'/'|'%') factor)*
//   factor := '-' factor | number
function evaluate(src) {
  const tokens = src.match(/\d*\.?\d+|\d+\.|[-+*/%]/g) || [];
  let i = 0;
  const parseFactor = () => {
    const t = tokens[i++];
    if (t === '-') return -parseFactor();
    if (t === undefined || OPS.includes(t)) throw new Error('syntax');
    return parseFloat(t);
  };
  const parseTerm = () => {
    let v = parseFactor();
    while (tokens[i] === '*' || tokens[i] === '/' || tokens[i] === '%') {
      const op = tokens[i++];
      const r = parseFactor();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  };
  let v = parseTerm();
  while (tokens[i] === '+' || tokens[i] === '-') {
    const op = tokens[i++];
    const r = parseTerm();
    v = op === '+' ? v + r : v - r;
  }
  if (i < tokens.length) throw new Error('syntax');
  if (!Number.isFinite(v)) throw new Error('math');
  return v;
}

const format = (n) => String(parseFloat(n.toPrecision(12)));

function render(result) {
  exprEl.textContent = expr.replace(/[*\/-]/g, (c) => SYMBOLS[c]);
  if (result !== undefined) resultEl.textContent = result;
  else if (!expr) resultEl.textContent = '0';
  else {
    try { resultEl.textContent = format(evaluate(expr)); }
    catch { /* incomplete expression: keep the last shown value */ }
  }
}

function press(key) {
  const last = expr.slice(-1);
  if (OPS.includes(key)) {
    if (!expr) { if (key === '-') expr = '-'; }
    else if (OPS.includes(last)) {
      // replace trailing operator; allow "×-" for negatives
      if (key === '-' && last !== '-' && last !== '+') expr += key;
      else expr = expr.replace(/[-+*/%]+$/, '') + key;
    } else expr += key;
  } else if (key === '.') {
    const current = expr.split(/[-+*/%]/).pop();
    if (!current.includes('.')) expr += current ? '.' : '0.';
  } else expr += key;
  render();
}

function equals() {
  try {
    const out = format(evaluate(expr));
    expr = out;
    render(out);
  } catch {
    resultEl.textContent = 'Error';
    expr = '';
    exprEl.textContent = '';
  }
}

document.querySelector('.keys').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.key) press(b.dataset.key);
  else if (b.dataset.action === 'clear') { expr = ''; render(); }
  else if (b.dataset.action === 'back') { expr = expr.slice(0, -1); render(); }
  else if (b.dataset.action === 'equals') equals();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[0-9.+\-*/%]$/.test(e.key)) { e.preventDefault(); press(e.key); }
  else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
  else if (e.key === 'Backspace') { expr = expr.slice(0, -1); render(); }
  else if (e.key === 'Escape') { expr = ''; render(); }
});
