# Lotto Gaemi - Firebase 템플릿

GitHub Pages에서 바로 쓸 수 있는 **서버리스 템플릿**입니다.

## 구성
- Google 로그인 (Firebase Auth)
- 번호 생성 (1~45 중 6개)
- 티켓 저장 (Firestore)
- 최신순 목록 + 더보기 페이징
- 회차 결과(draws 컬렉션)가 있으면 당첨/낙첨 표시

## 파일
- `index.html` - 화면
- `styles.css` - 스타일
- `js/firebase.js` - Firebase 초기화
- `js/auth.js` - 로그인/로그아웃
- `js/db.js` - Firestore CRUD
- `js/app.js` - 화면 로직

## Firebase 콘솔 체크
1. Authentication > Google 활성화
2. Firestore 생성
3. Auth > Authorized domains에 `*.github.io` 도메인 추가

## Firestore 데이터 구조
### tickets 컬렉션
```json
{
  "uid": "firebase uid",
  "email": "user@gmail.com",
  "drawNo": 1206,
  "lines": [[1,2,3,4,5,6]],
  "source": "generator",
  "status": "pending",
  "createdAt": "serverTimestamp"
}
```

### draws 컬렉션 (문서 ID = 회차번호)
```json
{
  "numbers": [1, 2, 3, 4, 5, 6],
  "bonus": 7,
  "drawDate": "2026-02-21"
}
```

## 배포
1. 이 폴더를 GitHub repo에 푸시
2. Repo Settings > Pages > Branch(main)/root
3. 배포 URL 접속

## 보안 규칙 (마지막에 꼭 적용)
아래는 형님 계정만 허용 예시:
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.token.email in ["YOUR_EMAIL@gmail.com"];
    }
  }
}
```

## 다음 단계 추천
- QR URL 파싱 후 자동 ticket 저장
- GitHub Actions로 주 1회 draws 자동 업데이트
- 무한스크롤 자동화(IntersectionObserver)
