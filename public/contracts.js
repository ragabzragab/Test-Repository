// Contract Management Frontend Logic

const API = '/api/contracts';

let allContracts = [];
let sortField = 'createdAt';
let sortDir = 'desc';
let editingId = null;
let deletingId = null;

// ── Utilities ────────────────────────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function fmt(date) {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtMoney(value, currency = 'USD') {
  if (!value) return '\u2014';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function statusBadge(status) {
  return `<span class="badge badge-${esc(status)}">${esc(status)}</span>`;
}

function typeBadge(type) {
  return `<span class="badge badge-type">${esc(type)}</span>`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T23:59:59');
  const now = new Date();
  const diff = target - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ── Toast Notifications ─────────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── API Calls ────────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ── Stats ────────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const stats = await apiFetch(`${API}/stats`);
    document.getElementById('stat-total').querySelector('.stat-value').textContent = stats.total;
    document.getElementById('stat-active').querySelector('.stat-value').textContent = stats.byStatus.active;
    document.getElementById('stat-expiring').querySelector('.stat-value').textContent = stats.expiringIn30Days;
    document.getElementById('stat-expired').querySelector('.stat-value').textContent = stats.byStatus.expired;
    document.getElementById('stat-draft').querySelector('.stat-value').textContent = stats.byStatus.draft;
    document.getElementById('stat-value').querySelector('.stat-value').textContent =
      stats.totalValue ? fmtMoney(stats.totalValue) : '$0';
  } catch (e) {
    showToast('Failed to load dashboard stats', 'error');
  }
}

async function loadExpiring() {
  try {
    const expiring = await apiFetch(`${API}/expiring?days=30`);
    const section = document.getElementById('expiring-section');
    const list = document.getElementById('expiring-list');
    if (expiring.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    list.innerHTML = expiring.map(c => {
      const days = daysUntil(c.endDate);
      const urgency = days <= 7 ? 'urgent' : days <= 14 ? 'warning' : '';
      return `
        <div class="expiring-item ${urgency}" onclick="viewContract('${esc(c.id)}')">
          <div class="expiring-info">
            <span class="expiring-number">${esc(c.contractNumber)}</span>
            <span class="expiring-title">${esc(c.title)}</span>
          </div>
          <div class="expiring-meta">
            <span>${fmt(c.endDate)}</span>
            <span class="days-badge ${urgency}">${days} day${days !== 1 ? 's' : ''} left</span>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Failed to load expiring contracts', e);
  }
}

// ── Contracts List ───────────────────────────────────────────────────────────

async function loadContracts() {
  const status = document.getElementById('filter-status').value;
  const type = document.getElementById('filter-type').value;
  const search = document.getElementById('search-input').value.trim();
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  if (search) params.set('search', search);

  try {
    allContracts = await apiFetch(`${API}?${params}`);
    renderTable();
  } catch (e) {
    document.getElementById('contracts-tbody').innerHTML =
      `<tr><td colspan="9" class="empty-row error">Failed to load contracts. Is the server running?</td></tr>`;
    showToast('Failed to load contracts: ' + e.message, 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('contracts-tbody');
  document.getElementById('contract-count').textContent = allContracts.length;

  const sorted = [...allContracts].sort((a, b) => {
    let av = a[sortField], bv = b[sortField];
    if (sortField === 'value') { av = av || 0; bv = bv || 0; }
    else { av = av || ''; bv = bv || ''; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No contracts found. Click "+ New Contract" to create one.</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(c => {
    const days = c.endDate && c.status === 'active' ? daysUntil(c.endDate) : null;
    const endDisplay = c.endDate
      ? `${fmt(c.endDate)}${days !== null && days <= 30 && days > 0 ? ` <span class="soon">${days}d</span>` : ''}`
      : '\u2014';
    const parties = c.parties?.length
      ? c.parties.slice(0, 2).map(p => `<span class="party-chip">${esc(p.name)}</span>`).join('') +
        (c.parties.length > 2 ? `<span class="party-chip more">+${c.parties.length - 2}</span>` : '')
      : '\u2014';

    return `
      <tr class="contract-row" onclick="viewContract('${esc(c.id)}')">
        <td class="mono">${esc(c.contractNumber) || '\u2014'}</td>
        <td class="title-cell">${esc(c.title)}</td>
        <td>${typeBadge(c.type)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${fmt(c.startDate)}</td>
        <td>${endDisplay}</td>
        <td class="mono">${c.value ? fmtMoney(c.value, c.currency) : '\u2014'}</td>
        <td class="parties-cell">${parties}</td>
        <td class="actions-cell" onclick="event.stopPropagation()">
          <button class="btn-icon" onclick="editContract('${esc(c.id)}')" title="Edit">&#9998;</button>
          <button class="btn-icon danger" onclick="confirmDelete('${esc(c.id)}')" title="Delete">&#128465;</button>
        </td>
      </tr>`;
  }).join('');

  // Update sort indicators
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.classList.toggle('sort-asc', th.dataset.sort === sortField && sortDir === 'asc');
    th.classList.toggle('sort-desc', th.dataset.sort === sortField && sortDir === 'desc');
  });
}

// ── View Contract Detail ─────────────────────────────────────────────────────

function viewContract(id) {
  const c = allContracts.find(x => x.id === id);
  if (!c) return;
  editingId = id;

  document.getElementById('detail-title').textContent = c.title;
  document.getElementById('detail-number').textContent = c.contractNumber;

  const days = c.endDate && c.status === 'active' ? daysUntil(c.endDate) : null;
  const expiryNote = days !== null && days <= 30 && days > 0
    ? `<span class="expiry-warning">${days} day${days !== 1 ? 's' : ''} until expiry</span>` : '';

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-row">
        <div class="detail-item">
          <div class="detail-label">Status</div>
          <div>${statusBadge(c.status)} ${expiryNote}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Type</div>
          <div>${typeBadge(c.type)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Contract #</div>
          <div class="mono">${esc(c.contractNumber) || '\u2014'}</div>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-item">
          <div class="detail-label">Value</div>
          <div>${c.value ? fmtMoney(c.value, c.currency) : '\u2014'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Start Date</div>
          <div>${fmt(c.startDate)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">End Date</div>
          <div>${fmt(c.endDate)}</div>
        </div>
      </div>
      ${c.description ? `<div class="detail-full"><div class="detail-label">Description</div><div>${esc(c.description)}</div></div>` : ''}
      ${c.notes ? `<div class="detail-full"><div class="detail-label">Notes</div><div>${esc(c.notes)}</div></div>` : ''}
      ${c.tags?.length ? `<div class="detail-full"><div class="detail-label">Tags</div><div>${c.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${c.parties?.length ? `
        <div class="detail-full">
          <div class="detail-label">Parties</div>
          <div class="parties-detail">
            ${c.parties.map(p => `
              <div class="party-card">
                <div class="party-name">${esc(p.name)}</div>
                <div class="party-role">${esc(p.role)}</div>
                ${p.email ? `<div class="party-email">${esc(p.email)}</div>` : ''}
              </div>`).join('')}
          </div>
        </div>` : ''}
      <div class="detail-full detail-meta">
        <span>Created: ${fmt(c.createdAt)}</span>
        <span>Updated: ${fmt(c.updatedAt)}</span>
        ${c.renewalReminderDays ? `<span>Reminder: ${c.renewalReminderDays} days before end</span>` : ''}
      </div>
    </div>`;

  document.getElementById('detail-modal').style.display = 'flex';
}

// ── Form Helpers ─────────────────────────────────────────────────────────────

function addPartyRow(party = {}) {
  const div = document.createElement('div');
  div.className = 'party-row';
  div.innerHTML = `
    <input type="text" placeholder="Name" class="party-name" value="" />
    <select class="party-role">
      ${['client','vendor','employee','employer','landlord','tenant','partner','other']
        .map(r => `<option value="${r}" ${party.role === r ? 'selected' : ''}>${r}</option>`).join('')}
    </select>
    <input type="email" placeholder="Email (optional)" class="party-email" value="" />
    <button type="button" class="btn-icon danger remove-party" aria-label="Remove party">&#10005;</button>
  `;
  // Set values via DOM to avoid XSS
  div.querySelector('.party-name').value = party.name || '';
  div.querySelector('.party-email').value = party.email || '';
  div.querySelector('.remove-party').onclick = () => div.remove();
  document.getElementById('parties-list').appendChild(div);
}

function getParties() {
  return Array.from(document.querySelectorAll('.party-row')).map(row => ({
    name: row.querySelector('.party-name').value.trim(),
    role: row.querySelector('.party-role').value,
    email: row.querySelector('.party-email').value.trim(),
  })).filter(p => p.name);
}

function openModal(contract = null) {
  editingId = contract?.id || null;
  document.getElementById('modal-title').textContent = contract ? 'Edit Contract' : 'New Contract';
  document.getElementById('form-error').textContent = '';
  document.getElementById('form-error').style.display = 'none';

  document.getElementById('f-title').value = contract?.title || '';
  document.getElementById('f-type').value = contract?.type || 'service';
  document.getElementById('f-status').value = contract?.status || 'draft';
  document.getElementById('f-value').value = contract?.value || '';
  document.getElementById('f-currency').value = contract?.currency || 'USD';
  document.getElementById('f-reminder').value = contract?.renewalReminderDays || 30;
  document.getElementById('f-start').value = contract?.startDate?.slice(0, 10) || '';
  document.getElementById('f-end').value = contract?.endDate?.slice(0, 10) || '';
  document.getElementById('f-description').value = contract?.description || '';
  document.getElementById('f-notes').value = contract?.notes || '';
  document.getElementById('f-tags').value = contract?.tags?.join(', ') || '';

  document.getElementById('parties-list').innerHTML = '';
  if (contract?.parties?.length) {
    contract.parties.forEach(addPartyRow);
  }

  document.getElementById('contract-modal').style.display = 'flex';
  document.getElementById('f-title').focus();
}

function closeModal() {
  document.getElementById('contract-modal').style.display = 'none';
  editingId = null;
}

function validateForm() {
  const title = document.getElementById('f-title').value.trim();
  const startDate = document.getElementById('f-start').value;
  const endDate = document.getElementById('f-end').value;
  const errEl = document.getElementById('form-error');

  if (!title) {
    errEl.textContent = 'Title is required.';
    errEl.style.display = 'block';
    document.getElementById('f-title').focus();
    return false;
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    errEl.textContent = 'End date must be on or after the start date.';
    errEl.style.display = 'block';
    document.getElementById('f-end').focus();
    return false;
  }

  errEl.style.display = 'none';
  return true;
}

async function saveContract(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    title: document.getElementById('f-title').value.trim(),
    type: document.getElementById('f-type').value,
    status: document.getElementById('f-status').value,
    value: document.getElementById('f-value').value,
    currency: document.getElementById('f-currency').value,
    renewalReminderDays: document.getElementById('f-reminder').value,
    startDate: document.getElementById('f-start').value || null,
    endDate: document.getElementById('f-end').value || null,
    description: document.getElementById('f-description').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    tags: document.getElementById('f-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    parties: getParties(),
  };

  try {
    if (editingId) {
      await apiFetch(`${API}/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Contract updated successfully', 'success');
    } else {
      await apiFetch(API, { method: 'POST', body: JSON.stringify(payload) });
      showToast('Contract created successfully', 'success');
    }
    closeModal();
    await refresh();
  } catch (err) {
    showToast('Error saving contract: ' + err.message, 'error');
  }
}

// ── Edit / Delete ────────────────────────────────────────────────────────────

function editContract(id) {
  const c = allContracts.find(x => x.id === id);
  if (c) openModal(c);
}

function confirmDelete(id) {
  deletingId = id;
  document.getElementById('confirm-modal').style.display = 'flex';
}

async function deleteContract() {
  if (!deletingId) return;
  try {
    await apiFetch(`${API}/${deletingId}`, { method: 'DELETE' });
    document.getElementById('confirm-modal').style.display = 'none';
    document.getElementById('detail-modal').style.display = 'none';
    deletingId = null;
    showToast('Contract deleted', 'success');
    await refresh();
  } catch (err) {
    showToast('Error deleting contract: ' + err.message, 'error');
  }
}

// ── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV() {
  if (allContracts.length === 0) {
    showToast('No contracts to export', 'warning');
    return;
  }

  const headers = ['Contract #', 'Title', 'Type', 'Status', 'Start Date', 'End Date', 'Value', 'Currency', 'Parties', 'Tags', 'Description', 'Notes', 'Created', 'Updated'];
  const csvEsc = (val) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const rows = allContracts.map(c => [
    c.contractNumber,
    c.title,
    c.type,
    c.status,
    c.startDate || '',
    c.endDate || '',
    c.value || '',
    c.currency,
    (c.parties || []).map(p => `${p.name} (${p.role})`).join('; '),
    (c.tags || []).join('; '),
    c.description,
    c.notes,
    c.createdAt,
    c.updatedAt,
  ].map(csvEsc).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contracts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${allContracts.length} contract(s) to CSV`, 'success');
}

// ── Refresh ──────────────────────────────────────────────────────────────────

async function refresh() {
  await Promise.all([loadContracts(), loadStats(), loadExpiring()]);
}

// ── Event Listeners ──────────────────────────────────────────────────────────

document.getElementById('add-contract-btn').onclick = () => openModal();
document.getElementById('export-csv-btn').onclick = exportCSV;
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal-cancel').onclick = closeModal;
document.getElementById('contract-form').onsubmit = saveContract;
document.getElementById('add-party-btn').onclick = () => addPartyRow();

document.getElementById('detail-close').onclick = () => document.getElementById('detail-modal').style.display = 'none';
document.getElementById('detail-close-btn').onclick = () => document.getElementById('detail-modal').style.display = 'none';
document.getElementById('detail-edit-btn').onclick = () => {
  document.getElementById('detail-modal').style.display = 'none';
  editContract(editingId);
};
document.getElementById('detail-delete-btn').onclick = () => {
  document.getElementById('detail-modal').style.display = 'none';
  confirmDelete(editingId);
};

document.getElementById('confirm-close').onclick = () => document.getElementById('confirm-modal').style.display = 'none';
document.getElementById('confirm-cancel').onclick = () => document.getElementById('confirm-modal').style.display = 'none';
document.getElementById('confirm-delete').onclick = deleteContract;

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

// Sort
document.querySelectorAll('[data-sort]').forEach(th => {
  th.onclick = () => {
    if (sortField === th.dataset.sort) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = th.dataset.sort;
      sortDir = 'asc';
    }
    renderTable();
  };
});

// Search & filter (debounced)
let searchTimer;
document.getElementById('search-input').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadContracts, 300);
};
document.getElementById('filter-status').onchange = loadContracts;
document.getElementById('filter-type').onchange = loadContracts;

// Keyboard: Escape closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────
refresh();
