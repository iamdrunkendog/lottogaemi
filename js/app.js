import { loginWithGoogle, logout, watchAuth } from './auth.js';
import { addGeneratedTicket, fetchTicketsPage, getDrawResult } from './db.js';

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailEl = document.getElementById('user-email');
const generateBtn = document.getElementById('generate-btn');
const genCountInput = document.getElementById('gen-count');
const generatedList = document.getElementById('generated-list');
const ticketList = document.getElementById('ticket-list');
const loadMoreBtn = document.getElementById('load-more-btn');

let currentUser = null;
let cursor = null;
let hasMore = true;

loginBtn.onclick = () => loginWithGoogle();
logoutBtn.onclick = () => logout();
generateBtn.onclick = onGenerate;
loadMoreBtn.onclick = () => loadTickets(true);

watchAuth(async (user) => {
  currentUser = user;
  ticketList.innerHTML = '';
  cursor = null;
  hasMore = true;

  if (user) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    userEmailEl.textContent = user.email;
    await loadTickets(false);
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    userEmailEl.textContent = '';
    loadMoreBtn.classList.add('hidden');
  }
});

function randomLine() {
  const s = new Set();
  while (s.size < 6) s.add(Math.floor(Math.random() * 45) + 1);
  return [...s].sort((a, b) => a - b);
}

function getNextDrawNo() {
  // TODO: 실제 동행복권 회차 계산/조회 로직으로 교체 가능
  return Number(prompt('저장할 회차를 입력하세요 (예: 1206)', '1206'));
}

async function onGenerate() {
  if (!currentUser) return alert('먼저 로그인해 주세요.');

  const count = Math.min(20, Math.max(1, Number(genCountInput.value || 1)));
  const lines = Array.from({ length: count }, () => randomLine());
  const drawNo = getNextDrawNo();
  if (!drawNo) return;

  generatedList.innerHTML = lines
    .map((line, i) => `<div class="ticket"><b>${i + 1}게임</b> ${line.join(', ')}</div>`)
    .join('');

  await addGeneratedTicket({
    uid: currentUser.uid,
    email: currentUser.email,
    drawNo,
    lines,
  });

  alert('저장 완료!');
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
        const balls = line.map((n) => `<span class="ball">${String(n).padStart(2, '0')}</span>`).join('');
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
