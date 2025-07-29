# QNote - 6자리 PIN 기반 노트 시스템

GitHub Pages를 사용한 간단한 공개 노트 시스템입니다.

## 기능

- 6자리 PIN으로 노트 접근
- 자동 폴더 구조 생성 (예: /1/2/3/4/5/6/Qnote.txt)
- GitHub Issues를 통한 자동 파일 생성
- 10KB 파일 크기 제한
- 복사 기능

## 설정 방법

### 1. GitHub Personal Access Token 생성 (필수)

1. GitHub 로그인
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token" 클릭
4. 다음 권한 선택:
   - `repo` (전체 선택)
   - `workflow`
5. Token 생성 후 복사

### 2. Token 설정

`app.js` 파일에서 `GITHUB_TOKEN` 값 설정:

```javascript
const GITHUB_TOKEN = 'YOUR_PERSONAL_ACCESS_TOKEN_HERE';
```

### 3. GitHub Actions 권한 설정

1. 레포지토리 Settings → Actions → General
2. "Workflow permissions"에서 "Read and write permissions" 선택
3. Save

### 4. GitHub Pages 활성화

1. Settings → Pages
2. Source: "Deploy from a branch" 선택
3. Branch: "main", 폴더: "/ (root)" 선택
4. Save

## 사용 방법

1. https://r2cuerdame.github.io/QNote/ 접속
2. 6자리 PIN 입력
3. 노트 작성/편집
4. 저장 버튼 클릭 → GitHub Issue 생성 → Actions가 자동으로 파일 생성

## 주의사항

- 공개 저장소이므로 민감한 정보는 저장하지 마세요
- 파일 크기는 10KB로 제한됩니다
- GitHub API rate limit에 주의하세요 (인증 없이 시간당 60회, 인증 시 5000회)

## 문제 해결

### 404 오류 발생 시
- GitHub Personal Access Token이 설정되어 있는지 확인
- Token 권한이 올바른지 확인
- 레포지토리가 public인지 확인

### 저장이 안 될 때
- GitHub Actions가 활성화되어 있는지 확인
- Workflow permissions가 "Read and write"로 설정되어 있는지 확인
- Issue가 생성되었는지 확인 (Issues 탭)