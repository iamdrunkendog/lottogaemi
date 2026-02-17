import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// TODO: 배포 전 본인 값으로 유지 (apiKey는 공개 가능하지만 보안 규칙은 필수)
const firebaseConfig = {
  apiKey: 'AIzaSyCvmnfACzC6Fmq8nGRiIuQwcJqNXpo-vso',
  authDomain: 'lottogaemi.firebaseapp.com',
  projectId: 'lottogaemi',
  storageBucket: 'lottogaemi.firebasestorage.app',
  messagingSenderId: '530903532801',
  appId: '1:530903532801:web:e033ab46930b829dce8700',
  measurementId: 'G-5DHQ7J2S54',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
