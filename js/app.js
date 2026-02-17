import { loginWithGoogle, logout, watchAuth } from './auth.js';
import { addGeneratedTicket, fetchTicketsPage, getDrawResult, getLatestDraw } from './db.js';

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailEl = document.getElementById('user-email');

const generateBtn = document.getElementById('generate-btn');
const generatedList = document.getElementById('generated-list');

const recordCard = document.getElementById('record-card');
const recordOpenBtn = document.getElementById('record-open-btn');
const recordPanel = document.getElementById('record-panel');
const recordDrawNoInput = document.getElementById('record-draw-no');
const tabUploadBtn = document.getElementById('tab-upload');
const tabManualBtn = document.getElementById('tab-manual');
const panelUpload = document.getElementById('panel-upload');
const panelManual = document.getElementById('panel-manual');
const ticketImageInput = document.getElementById('ticket-image-input');
const uploadAnalyzeBtn = document.getElementById('upload-analyze-btn');
const manualSaveBtn = document.getElementById('manual-save-btn');

const drawCard = document.getElementById('draw-card');
const ticketList = document.getElementById('ticket-list');
const loadMoreBtn = document.getElementById('load-more-btn');
const gaemiLineEl = document.getElementById('gaemi-line');

let currentUser = null;
let cursor = null;
let hasMore = true;
let pendingGeneratedLine = null;

loginBtn.onclick = async () => {
  try {
    await loginWithGoogle();
  } catch (e) {
    console.error('[로그인 오류]', e);
    alert(`Google 로그인 실패: ${e.code || ''} ${e.message || ''}`);
  }
};

logoutBtn.onclick = async () => {
  try {
    await logout();
  } catch (e) {
    console.error('[로그아웃 오류]', e);
  }
};

generateBtn.onclick = onGenerate;
loadMoreBtn.onclick = () => loadTickets(true);
tabUploadBtn.onclick = () => switchRecordTab('upload');
tabManualBtn.onclick = () => switchRecordTab('manual');
uploadAnalyzeBtn.onclick = onUploadAnalyzeAndSave;
manualSaveBtn.onclick = onManualSave;
recordOpenBtn.onclick = toggleRecordPanel;

function switchRecordTab(mode) {
  const isUpload = mode === 'upload';
  tabUploadBtn.classList.toggle('active', isUpload);
  tabManualBtn.classList.toggle('active', !isUpload);
  panelUpload.classList.toggle('hidden', !isUpload);
  panelManual.classList.toggle('hidden', isUpload);
}

function toggleRecordPanel() {
  const isHidden = recordPanel.classList.toggle('hidden');
  recordOpenBtn.textContent = isHidden ? '기록 등록 열기' : '기록 등록 닫기';
}

function getKstNow() {
  // 한국 시간 기준 계산
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function getNextSaturdayDeadlineKst() {
  const now = getKstNow();
  const target = new Date(now);
  const day = now.getDay();
  const diff = (6 - day + 7) % 7;
  target.setDate(now.getDate() + diff);
  target.setHours(20, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 7);
  return target;
}

function formatRemain(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return d > 0 ? `${d}일 ${h}시간 ${m}분` : `${h}시간 ${m}분`;
}

async function updateGaemiLine() {
  const deadline = getNextSaturdayDeadlineKst();
  const remainText = formatRemain(deadline.getTime() - getKstNow().getTime());

  try {
    const latest = await getLatestDraw();
    if (latest?.numbers?.length === 6) {
      const nums = latest.numbers.map((n) => String(n).padStart(2, '0')).join(', ');
      gaemiLineEl.textContent = `직전 ${latest.drawNo}회 당첨번호: ${nums} + 보너스 ${latest.bonus} · 판매 마감까지 ${remainText}`;
      return;
    }
  } catch (_) {
    // draws 데이터가 아직 없으면 마감 카운트다운만 노출
  }

  gaemiLineEl.textContent = `이번 회차 로또복권 판매 마감까지 ${remainText} 남았어요 (토요일 20:00)`;
}

updateGaemiLine();
setInterval(updateGaemiLine, 60 * 1000);

watchAuth(async (user) => {
  currentUser = user;
  ticketList.innerHTML = '';
  cursor = null;
  hasMore = true;

  if (user) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    userEmailEl.textContent = user.email;
    recordCard.classList.remove('hidden');
    drawCard.classList.remove('hidden');
    recordPanel.classList.add('hidden');
    recordOpenBtn.textContent = '기록 등록 열기';
    await loadTickets(false);
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userEmailEl.textContent = '';
    recordCard.classList.add('hidden');
    drawCard.classList.add('hidden');
    recordPanel.classList.add('hidden');
    recordOpenBtn.textContent = '기록 등록 열기';
    ticketList.innerHTML = '';
    loadMoreBtn.classList.add('hidden');
  }
});

function ballClass(n) {
  if (n <= 10) return 'ball-yellow';
  if (n <= 20) return 'ball-blue';
  if (n <= 30) return 'ball-red';
  if (n <= 40) return 'ball-gray';
  return 'ball-green';
}

function randomLine() {
  const s = new Set();
  while (s.size < 6) s.add(Math.floor(Math.random() * 45) + 1);
  return [...s].sort((a, b) => a - b);
}

function getRecordDrawNo() {
  const drawNo = Number(recordDrawNoInput.value);
  if (!drawNo) {
    alert('회차를 입력해 주세요.');
    recordDrawNoInput.focus();
    return null;
  }
  return drawNo;
}

async function onGenerate() {
  // 번호 생성은 단순 추천 1조합만 제공
  const line = randomLine();
  pendingGeneratedLine = line;

  generatedList.innerHTML = `
    <div class="nums">${line.map((n) => `<span class="ball ${ballClass(n)}">${String(n).padStart(2, '0')}</span>`).join('')}</div>
    <p class="muted">다시 누르면 새 조합을 추천해드려요.</p>
  `;
}

async function onUploadAnalyzeAndSave() {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');

  const file = ticketImageInput.files?.[0];
  if (!file) {
    alert('복권 사진을 먼저 업로드해 주세요.');
    return;
  }

  try {
    const qrRaw = await decodeQrFromImageFile(file);
    if (!qrRaw) {
      alert('QR코드를 찾지 못했어요. QR이 선명하게 보이도록 다시 촬영해 주세요.');
      return;
    }

    const parsed = parseDhlotteryQrUrl(qrRaw);
    if (!parsed) {
      alert('유효한 동행복권 QR 형식이 아니어서 저장하지 않았어요.');
      return;
    }

    // 회차 입력값이 있으면 우선 사용, 없으면 QR 회차 자동 사용
    const inputDrawNo = Number(recordDrawNoInput.value);
    const drawNo = inputDrawNo || parsed.drawNo;

    await addGeneratedTicket({
      uid: currentUser.uid,
      email: currentUser.email,
      drawNo,
      lines: parsed.lines,
      source: 'qr',
    });

    recordDrawNoInput.value = String(drawNo);
    ticketImageInput.value = '';
    alert(`QR 인식 성공! ${drawNo}회차 ${parsed.lines.length}줄을 자동 등록했어요.`);

    ticketList.innerHTML = '';
    cursor = null;
    hasMore = true;
    await loadTickets(false);
  } catch (e) {
    console.error('[QR 인식 오류]', e);
    alert('QR 인식 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
  }
}

function parseManualLine(text) {
  const nums = (text || '')
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((n) => Number(n));

  if (nums.length !== 6) return null;
  if (nums.some((n) => n < 1 || n > 45)) return null;
  const unique = [...new Set(nums)];
  if (unique.length !== 6) return null;
  return unique.sort((a, b) => a - b);
}

function parseDhlotteryQrUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return null;
  }

  if (!url.hostname.includes('dhlottery.co.kr')) return null;
  const v = url.searchParams.get('v');
  if (!v) return null;

  const drawNo = Number((v.match(/^\d{4,5}/) || [])[0]);
  if (!drawNo) return null;

  const lineChunks = [...v.matchAll(/q(\d{12})/g)].map((m) => m[1]);
  if (!lineChunks.length) return null;

  const lines = lineChunks
    .map((chunk) => {
      const nums = chunk.match(/.{1,2}/g).map((x) => Number(x));
      if (nums.length !== 6) return null;
      if (nums.some((n) => n < 1 || n > 45)) return null;
      if (new Set(nums).size !== 6) return null;
      return nums.sort((a, b) => a - b);
    })
    .filter(Boolean)
    .slice(0, 5);

  if (!lines.length) return null;
  return { drawNo, lines };
}

async function decodeQrFromImageFile(file) {
  const jsQR = (await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.es6.min.js')).default;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // 1차: 원본 전체 스캔
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  ctx.drawImage(bitmap, 0, 0);
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let result = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
  if (result?.data) return result.data;

  // 2차: 중앙 영역 확대 스캔 (복권 전체 촬영 대비)
  const cropW = Math.floor(bitmap.width * 0.7);
  const cropH = Math.floor(bitmap.height * 0.7);
  const sx = Math.floor((bitmap.width - cropW) / 2);
  const sy = Math.floor((bitmap.height - cropH) / 2);

  canvas.width = cropW;
  canvas.height = cropH;
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  result = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });

  return result?.data || null;
}

async function onManualSave() {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');

  const drawNo = getRecordDrawNo();
  if (!drawNo) return;

  const inputs = [...document.querySelectorAll('.manual-line')];
  const lines = inputs
    .map((el) => parseManualLine(el.value.trim()))
    .filter(Boolean)
    .slice(0, 5);

  if (lines.length === 0) {
    alert('최소 1줄 이상 올바르게 입력해 주세요. (예: 1,3,11,19,29,32)');
    return;
  }

  await addGeneratedTicket({
    uid: currentUser.uid,
    email: currentUser.email,
    drawNo,
    lines,
  });

  alert(`${lines.length}줄 저장 완료!`);
  inputs.forEach((el) => {
    el.value = '';
  });
  ticketImageInput.value = '';

  ticketList.innerHTML = '';
  cursor = null;
  hasMore = true;
  await loadTickets(false);
}

function evaluateLine(line, draw) {
  const hit = line.filter((n) => draw.numbers.includes(n)).length;
  const bonusHit = line.includes(draw.bonus);

  if (hit === 6) return '1등';
  if (hit === 5 && bonusHit) return '2등';
  if (hit === 5) return '3등';
  if (hit === 4) return '4등';
  if (hit === 3) return '5등';
  return '낙첨';
}

async function decorateTicketStatus(ticket) {
  const draw = await getDrawResult(ticket.drawNo);
  if (!draw) return { badge: ['대기중', 'pending'], lineResults: [] };

  const lineResults = ticket.lines.map((line) => evaluateLine(line, draw));
  const won = lineResults.some((r) => r !== '낙첨');
  return {
    badge: [won ? '당첨' : '낙첨', won ? 'win' : 'lose'],
    lineResults,
  };
}

async function loadTickets(append = true) {
  if (!currentUser || !hasMore) return;

  const { items, nextCursor } = await fetchTicketsPage({
    uid: currentUser.uid,
    cursor,
    pageSize: 8,
  });

  if (!append) ticketList.innerHTML = '';

  for (const t of items) {
    const { badge, lineResults } = await decorateTicketStatus(t);
    const linesHtml = t.lines
      .map((line, idx) => {
        const balls = line.map((n) => `<span class="ball ${ballClass(n)}">${String(n).padStart(2, '0')}</span>`).join('');
        const result = lineResults[idx] ? ` <span class="muted">→ ${lineResults[idx]}</span>` : '';
        return `<div class="nums">${balls}${result}</div>`;
      })
      .join('');

    const el = document.createElement('div');
    el.className = 'ticket';
    el.innerHTML = `
      <div>
        <b>${t.drawNo}회차</b>
        <span class="badge ${badge[1]}">${badge[0]}</span>
      </div>
      <div class="muted">${t.source || 'manual'} · ${t.email || ''}</div>
      ${linesHtml}
    `;
    ticketList.appendChild(el);
  }

  cursor = nextCursor;
  hasMore = items.length > 0;
  if (hasMore) loadMoreBtn.classList.remove('hidden');
  else loadMoreBtn.classList.add('hidden');
}
