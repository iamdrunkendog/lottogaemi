import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { db } from './firebase.js';

// tickets/{id}
// {
//   uid, email, drawNo, lines: [[1,2,3,4,5,6], ...],
//   status: 'pending'|'win'|'lose', resultSummary,
//   source: 'manual'|'qr'|'generator', createdAt
// }

export async function addGeneratedTicket({ uid, email, drawNo, lines }) {
  return addDoc(collection(db, 'tickets'), {
    uid,
    email,
    drawNo,
    lines,
    source: 'generator',
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function fetchTicketsPage({ uid, cursor = null, pageSize = 10 }) {
  let q = query(
    collection(db, 'tickets'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (cursor) {
    q = query(
      collection(db, 'tickets'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(pageSize)
    );
  }

  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}

// draws/{drawNo}
// { numbers:[6], bonus:number, drawDate:'YYYY-MM-DD' }
export async function getDrawResult(drawNo) {
  const ref = doc(db, 'draws', String(drawNo));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}
