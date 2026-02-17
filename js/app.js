import { loginWithGoogle, logout, watchAuth } from './auth.js';
import { addGeneratedTicket, fetchTicketsPage, getDrawResult, getLatestDraw } from './db.js';

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailEl = document.getElementById('user-email');

const generateBtn = document.getElementById('generate-btn');
const generatedList = document.getElementById('generated-list');

const recordCard = document.getElementById('record-card');
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

function switchRecordTab(mode) {
  const isUpload = mode === 'upload';
  tabUploadBtn.classList.toggle('active', isUpload);
  tabManualBtn.classList.toggle('active', !isUpload);
  panelUpload.classList.toggle('hidden', !isUpload);
  panelManual.classList.toggle('hidden', isUpload);
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
    await loadTickets(false);
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userEmailEl.textContent = '';
    recordCard.classList.add('hidden');
    drawCard.classList.add('hidden');
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
    <div class="ticket">
      <b>추천 1조합</b>
      <div class="nums">${line.map((n) => `<span class="ball ${ballClass(n)}">${String(n).padStart(2, '0')}</span>`).join('')}</div>
      <p class="muted">다시 누르면 새 조합을 추천해드려요.</p>
    </div>
  `;
}

async function onUploadAnalyzeAndSave() {
  if (!currentUser) return alert('로그인 후 이용해 주세요.');

  const drawNo = getRecordDrawNo();
  if (!drawNo) return;

  const file = ticketImageInput.files?.[0];
  if (!file) {
    alert('복권 사진을 먼저 업로드해 주세요.');
    return;
  }

  // OCR/QR 인식은 다음 단계에서 연결 예정 (현재는 UI/저장 흐름만 준비)
  alert('OCR/QR 인식 기능을 다음 단계에서 연결할게요. 우선 직접 입력하기로 저장 가능해요.');
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
