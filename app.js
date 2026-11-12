(() => {
  'use strict';
  const STORAGE_KEY = 'verity.registry.v1';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let registry = loadRegistry();
  let verifyCount = Number(localStorage.getItem('verity.verifyCount.v1')) || 0;
  let toastTimeout;

  function loadRegistry() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(entry => entry && typeof entry.hash === 'string') : [];
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(registry)); }
    catch { showToast('Browser storage is full. Export your registry before continuing.'); }
    render();
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  }
  async function sha256(file) {
    if (!window.crypto?.subtle) throw new Error('Secure hashing requires HTTPS or localhost. Please open this app on localhost.');
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function showToast(message) {
    const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3500);
  }
  function formatDate(iso) { return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso)); }
  function id() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

  function render() {
    $('#stat-issued').textContent = registry.length.toLocaleString();
    $('#stat-verified').textContent = verifyCount.toLocaleString();
    $('#stat-revoked').textContent = registry.filter(entry => entry.revoked).length.toLocaleString();
    $('#activity-count').textContent = registry.length;
    $('#registry-count').textContent = `Showing ${registry.length} credential${registry.length === 1 ? '' : 's'}`;
    $('#export-btn').disabled = registry.length === 0;
    const body = $('#activity-body');
    if (!registry.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="5"><span class="empty-icon">▤</span><strong>No credentials yet</strong><span>Your registered credentials will appear here.</span><button class="empty-action" data-scroll="issue">Issue your first credential →</button></td></tr>';
      return;
    }
    body.innerHTML = [...registry].reverse().slice(0, 8).map(entry => `<tr data-id="${escapeHTML(entry.id)}" tabindex="0" aria-label="View ${escapeHTML(entry.title)}"><td><div class="credential-name">${escapeHTML(entry.title)}</div><div class="credential-institution">${escapeHTML(entry.institution)}</div></td><td class="recipient-cell">${escapeHTML(entry.recipient)}</td><td class="date-cell">${formatDate(entry.issuedAt)}</td><td><span class="status-chip${entry.revoked ? ' revoked' : ''}">${entry.revoked ? 'Revoked' : 'Valid'}</span></td><td class="action-cell"><button data-copy="${escapeHTML(entry.hash)}" title="Copy fingerprint" aria-label="Copy fingerprint">⧉</button></td></tr>`).join('');
  }
  function setFileLabel(input, label) {
    const zone = input.closest('.upload-zone'); const name = $(`#${label}`);
    if (input.files?.[0]) { name.textContent = `✓ ${input.files[0].name}`; zone.classList.add('has-file'); }
    else { name.textContent = ''; zone.classList.remove('has-file'); }
  }
  function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) { showToast('Please choose a file smaller than 10 MB.'); return false; }
    return true;
  }
  async function handleIssue(event) {
    event.preventDefault();
    const form = event.currentTarget; const data = new FormData(form); const file = $('#issue-file').files[0];
    if (!file || !validateFile(file)) return;
    const button = $('button[type="submit"]', form); button.disabled = true; button.firstChild.textContent = 'Hashing… ';
    try {
      const hash = await sha256(file);
      if (registry.some(entry => entry.hash === hash)) { showToast('This exact certificate is already registered.'); return; }
      registry.push({ id: id(), recipient: data.get('recipient').trim(), institution: data.get('institution').trim(), title: data.get('title').trim(), hash, fileName: file.name, issuedAt: new Date().toISOString(), revoked: false });
      save(); form.reset(); setFileLabel($('#issue-file'), 'issue-file-name'); showToast('Credential registered in your local demo registry.');
    } catch (error) { showToast(error.message || 'Could not hash this file.'); }
    finally { button.disabled = false; button.firstChild.textContent = '＋ Register credential '; }
  }
  function showResult(type, title, message, entry) {
    const box = $('#verify-result'); box.className = `result-box ${type}`;
    box.innerHTML = `<span class="result-mark">${type === 'success' ? '✓' : type === 'failure' ? '!' : '◈'}</span><div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
    if (entry && type === 'success') {
      const detail = $('<p>', box); detail.className = 'verified-owner'; detail.textContent = `Issued to ${entry.recipient} · ${entry.institution}`; detail.style.cssText = 'font-size:8px;color:#86cbaa;margin:5px 0 0';
    }
  }
  function countCheck() { verifyCount++; localStorage.setItem('verity.verifyCount.v1', String(verifyCount)); render(); }
  async function handleVerify(event) {
    event.preventDefault();
    const file = $('#verify-file').files[0]; const pasted = $('#verify-hash').value.trim().toLowerCase().replace(/^0x/, '').replace(/\s/g, '');
    if (!file && !pasted) { showResult('failure', 'Add a certificate to check', 'Upload a file or paste its SHA-256 fingerprint.'); return; }
    let hash = pasted;
    try {
      if (file) { if (!validateFile(file)) return; showResult('', 'Checking certificate…', 'Computing its SHA-256 fingerprint in your browser.'); hash = await sha256(file); }
      if (!/^[a-f0-9]{64}$/.test(hash)) { showResult('failure', 'Invalid fingerprint', 'A SHA-256 fingerprint contains exactly 64 hexadecimal characters.'); return; }
      const entry = registry.find(item => item.hash === hash); countCheck();
      if (!entry) { showResult('failure', 'Credential not found', 'This fingerprint does not match anything in your local demo registry.'); }
      else if (entry.revoked) { showResult('failure', 'Credential revoked', `Registered on ${formatDate(entry.issuedAt)}. This credential is no longer valid.`, entry); }
      else { showResult('success', 'Credential verified', `Genuine · Registered ${formatDate(entry.issuedAt)} in this browser.`, entry); }
    } catch (error) { showResult('failure', 'Could not check file', error.message || 'Try a different file.'); }
  }
  function openDetail(entry) {
    $('#dialog-content').innerHTML = `<div class="section-eyebrow">CREDENTIAL DETAILS</div><h2 class="detail-title">${escapeHTML(entry.title)}</h2><p class="detail-subtitle">${entry.revoked ? 'Revoked credential' : 'Registered credential'} · ${formatDate(entry.issuedAt)}</p><div class="detail-line"><div class="detail-label">RECIPIENT</div><div class="detail-value">${escapeHTML(entry.recipient)}</div></div><div class="detail-line"><div class="detail-label">ISSUING INSTITUTION</div><div class="detail-value">${escapeHTML(entry.institution)}</div></div><div class="detail-line"><div class="detail-label">SHA-256 FINGERPRINT</div><div class="detail-value detail-hash">${escapeHTML(entry.hash)}</div></div><div class="detail-line"><div class="detail-label">ORIGINAL FILE</div><div class="detail-value">${escapeHTML(entry.fileName)}</div></div><div class="detail-actions"><button class="button button-outline" data-dialog-copy="${escapeHTML(entry.hash)}">⧉ Copy fingerprint</button>${entry.revoked ? '' : `<button class="button" style="background:#35251f;color:#f0b28e;border:1px solid #674331" data-revoke="${escapeHTML(entry.id)}">Revoke credential</button>`}</div>`;
    $('#detail-dialog').showModal();
  }

  $('#issue-form').addEventListener('submit', handleIssue);
  $('#verify-form').addEventListener('submit', handleVerify);
  $('#issue-file').addEventListener('change', event => setFileLabel(event.currentTarget, 'issue-file-name'));
  $('#verify-file').addEventListener('change', event => setFileLabel(event.currentTarget, 'verify-file-name'));
  for (const idName of ['issue-drop', 'verify-drop']) {
    const zone = $(`#${idName}`); zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragging'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
    zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('dragging'); const input = $('input[type="file"]', zone); if (event.dataTransfer.files[0]) { input.files = event.dataTransfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); } });
  }
  document.addEventListener('click', async event => {
    const scroll = event.target.closest('[data-scroll]'); if (scroll) { event.preventDefault(); document.getElementById(scroll.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    const copy = event.target.closest('[data-copy], [data-dialog-copy]'); if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copy || copy.dataset.dialogCopy); showToast('Fingerprint copied.'); } catch { showToast('Clipboard access is unavailable.'); } }
    const row = event.target.closest('tr[data-id]'); if (row && !event.target.closest('[data-copy]')) { const entry = registry.find(item => item.id === row.dataset.id); if (entry) openDetail(entry); }
    const revoke = event.target.closest('[data-revoke]'); if (revoke) { const entry = registry.find(item => item.id === revoke.dataset.revoke); if (entry) { entry.revoked = true; save(); $('#detail-dialog').close(); showToast('Credential revoked in your local registry.'); } }
  });
  document.addEventListener('keydown', event => { const row = event.target.closest('tr[data-id]'); if (row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); const entry = registry.find(item => item.id === row.dataset.id); if (entry) openDetail(entry); } });
  $('#dialog-close').addEventListener('click', () => $('#detail-dialog').close());
  $('#detail-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  $('#dismiss-banner').addEventListener('click', () => $('.privacy-banner').remove());
  $('#theme-toggle').addEventListener('click', () => document.body.classList.toggle('light'));
  $('#export-btn').addEventListener('click', () => {
    const file = new Blob([JSON.stringify({ format: 'verity-registry-export', version: 1, exportedAt: new Date().toISOString(), credentials: registry }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = 'verity-registry.json'; link.click(); URL.revokeObjectURL(link.href); showToast('Registry exported as JSON.');
  });
  render();
})();
