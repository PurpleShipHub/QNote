# QNote - 6자리 PIN 기반 노트 시스템

GitHub Pages + Netlify Functions를 사용한 공개 노트 시스템입니다.

## 기능

- 6자리 PIN으로 노트 접근
- **로그인 없이 자동 저장**
- 10KB 파일 크기 제한
- 복사 기능
- GitHub Actions로 자동 파일 생성

## 설정 방법

### 1. Netlify 배포 (백엔드)

1. https://app.netlify.com 가입 (무료)
2. "Import an existing project" 클릭
3. GitHub 연결 → `QNote` 레포지토리 선택
4. 환경변수 설정:
   - Key: `GITHUB_TOKEN`
   - Value: 아까 만든 GitHub Personal Access Token
5. "Deploy site" 클릭
6. 배포 완료 후 사이트 URL 복사 (예: `happy-cat-123456.netlify.app`)

### 2. app.js 수정

`app.js`의 5번째 줄에서 Netlify URL 설정:
```javascript
const NETLIFY_FUNCTION_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8888/.netlify/functions' 
    : 'https://YOUR-SITE-NAME.netlify.app/.netlify/functions';
```
`YOUR-SITE-NAME`을 실제 Netlify 사이트 이름으로 변경

### 3. 변경사항 푸시
```bash
git add .
git commit -m "Update Netlify URL"
git push
```

## 사용 방법

1. https://r2cuerdame.github.io/QNote/ 접속
2. 6자리 PIN 입력
3. 노트 작성/편집
4. 저장 버튼 클릭 → **자동 저장** (로그인 불필요!)

## 시스템 구조

```
사용자 → GitHub Pages (프론트엔드)
         ↓
         Netlify Functions (백엔드)
         ↓
         GitHub API (Issue 생성)
         ↓
         GitHub Actions (파일 생성)
```

## 장점

- **로그인 불필요**: 누구나 바로 사용 가능
- **무료**: GitHub Pages + Netlify 모두 무료
- **안전**: 토큰은 서버에만 저장
- **간단**: 복잡한 설정 없음

## 문제 해결

### Netlify 함수가 작동하지 않을 때
- Netlify 대시보드에서 Functions 탭 확인
- 환경변수 `GITHUB_TOKEN` 설정 확인
- 함수 로그 확인

### 기존 방식으로 돌아가기
Netlify 설정이 어려우면 자동으로 기존 방식(Issue 페이지 열기)으로 작동합니다.