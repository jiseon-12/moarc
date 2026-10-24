# MOARC PARTNERS 공식 포털 v3

> **내 컴퓨터에서 바로 보기:** `preview/index.html`을 더블클릭하세요.
> `public/index.html`을 직접 열면 디자인이 깨져 보입니다(웹서버 배포용 절대경로 사용). 배포는 아래 1번대로 Vercel에 올리면 정상입니다.
> 로컬 서버로 보려면: `npx serve public` → http://localhost:3000

대한변리사회(kpaa.or.kr)형 **기관 포털 템플릿**의 멀티페이지 홈페이지 + **Google(Gmail · Drive · Calendar) 연동 관리자 모드**.

- 공개 사이트: 7개 대메뉴 · 34개 하위 페이지 + 메인 · 통합검색 · 사이트맵 · 영문 · 404 (총 40페이지)
- 관리자 모드: `/admin` — Google 계정 로그인, 온라인 접수·심사, 게시판, 일정, 자료실, 메일, 사이트 설정
- 서버: Vercel Functions 5개 (`api/`), 외부 npm 의존성 없음 (Google REST API 직접 호출)

---

## 1. 배포 (GitHub → Vercel)

1. 이 폴더 전체를 GitHub 저장소에 올립니다. (`node_modules/` 제외)
2. Vercel → **Add New Project** → 저장소 Import → 설정 변경 없이 **Deploy**
   (`vercel.json`이 `public/`을 정적 사이트로, `api/`를 서버 함수로 지정합니다. `public/`은 이미 빌드되어 있습니다.)
3. 아래 **2. Google 연동 설정**을 마친 뒤 **Redeploy**.

## 2. Google 연동 설정 (관리자 모드 사용 시 필수)

### 2-1. Google Cloud Console
1. https://console.cloud.google.com 에서 새 프로젝트 생성
2. **API 및 서비스 → 라이브러리**에서 사용 설정: **Gmail API**, **Google Drive API**, **Google Calendar API**
3. **OAuth 동의 화면**
   - Google Workspace(회사 도메인) 계정 → 사용자 유형 **내부** (권장, 심사 불필요)
   - 개인 Gmail 계정 → **외부** 선택 후 **앱 게시(프로덕션)** 상태로 변경
     ⚠ “테스트” 상태로 두면 연동이 **7일마다 만료**됩니다. 게시 시 “확인되지 않은 앱” 경고가 뜨지만 관리자 본인만 사용하므로 [고급 → 이동]으로 진행하면 됩니다.
4. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 웹 애플리케이션**
   - 승인된 리디렉션 URI: `https://<도메인>/api/oauth-callback`
     (예: `https://www.moarc.co.kr/api/oauth-callback`, Vercel 기본 주소도 쓰려면 `https://<프로젝트>.vercel.app/api/oauth-callback` 추가)

### 2-2. Vercel 환경변수 (Settings → Environment Variables)

| 변수 | 필수 | 설명 |
| :--- | :---: | :--- |
| `GOOGLE_CLIENT_ID` | ● | OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | ● | OAuth 클라이언트 보안 비밀 |
| `ADMIN_ID` / `ADMIN_PASSWORD` | ● | 관리자 아이디·비밀번호 로그인 (비밀번호 8자 이상, 강력하게). Google 로그인과 함께 쓸 수 있습니다. |
| `ADMIN_EMAILS` | ○ | Google 계정 로그인 허용 목록, 쉼표 구분 (예: `jiseon.kim@moarc.co.kr,contact@moarc.co.kr`) |
| `SESSION_SECRET` | ● | 임의의 긴 문자열 32자 이상 (로그인 세션 서명용) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | 권장 | Vercel Marketplace → **Upstash Redis** 추가 시 자동 생성. Google 연동 토큰을 자동 저장합니다. |
| `GOOGLE_REFRESH_TOKEN` | KV 없을 때 | KV가 없으면 연동 직후 화면에 표시되는 토큰을 여기에 저장 |
| `GOOGLE_ACCOUNT_EMAIL` | 선택 | KV 없을 때 연동 계정 표시용 |
| `PUBLIC_BASE_URL` | 선택 | 커스텀 도메인 고정 (예: `https://www.moarc.co.kr`) |
| `MOARC_WEBHOOK_URL` | 선택 | 접수 시 추가로 Make/Slack 등에 JSON 전송 |

### 2-3. 연동
1. `https://<도메인>/admin` 접속 → **Google 계정으로 로그인** (`ADMIN_EMAILS`에 있는 계정만 허용)
2. 상단 배너 또는 **Google 연동** 메뉴 → **Google 계정 연동** → 권한 허용
   - 기관 대표 계정(예: contact@)으로 연동하면 모든 메일이 그 주소로 발송되고, 데이터가 그 계정의 Drive에 저장됩니다.
3. KV가 없다면 표시된 토큰을 `GOOGLE_REFRESH_TOKEN`에 저장 후 Redeploy
4. **연동 설정 → 테스트 메일**로 동작 확인

### 요청 권한 (최소 권한)
| 권한 | 용도 | 접근 범위 |
| :--- | :--- | :--- |
| `gmail.send` | 접수 알림·자동 회신·관리자 메일 | **발송만** (받은편지함 읽기 불가) |
| `drive.file` | 접수 데이터·첨부·자료실·게시물 저장 | **이 앱이 만든 파일만** |
| `calendar.app.created` | 공개 일정 | **이 앱이 만든 캘린더만** (개인 캘린더 접근 불가) |

## 3. 연동 후 동작

| 기능 | Google 서비스 | 내용 |
| :--- | :--- | :--- |
| 온라인 접수 (4종) | Drive · Gmail | 접수 내용을 `MOARC Portal/01_온라인접수`에 JSON으로 저장, 관리자 알림 메일 + 신청자 접수 확인 메일 |
| IR 자료 업로드 | Drive | 신청자가 30MB까지 직접 업로드 → `02_접수첨부파일` (브라우저 → Drive 직접 전송) |
| 접수·심사 | Drive | 상태 변경, 4개 항목 채점, 메모, 처리 이력, CSV 내보내기 |
| 메일 발송 | Gmail | 선정/미선정/서류보완/일정 템플릿, 접수자 선택 일괄 발송 (`{이름}` 치환) |
| 게시판 | Drive | 공지·IR공고·보도자료·주요동정·채용 작성/수정 → 홈페이지 1분 내 반영 |
| 일정 | Calendar | 전용 캘린더 “MOARC PARTNERS 공개일정” → 메인·주요일정 페이지 공개, 방문자 “내 캘린더에 추가” |
| 자료실 | Drive | `03_공개자료실` 업로드, 공개 전환 시 홈페이지 [정보마당 > 자료실] 노출 |
| 사이트 설정 | Drive | 포럼명·마감일시·정원·접수 열기/닫기·자동회신·알림 수신자·메인 긴급공지 |

**연동 전**에도 홈페이지는 정상 동작합니다 (기본 게시물 표시, 접수는 `MOARC_WEBHOOK_URL`이 있으면 웹훅으로, 없으면 이메일 접수 안내).

## 4. 폴더 구조

```
public/                 ← 배포되는 정적 사이트 (빌드 결과물, 직접 수정 X — admin.html · assets/site.js · assets/admin.js 제외)
  admin.html            관리자 모드
  assets/site.js        공개 사이트 런타임 (메가메뉴·게시판·캘린더·폼·업로드·검색 …)
  assets/admin.js       관리자 모드 런타임
src/
  site.mjs              ★ 메뉴(IA) · 퀵메뉴 · 유관기관 · 연락처 설정
  pages/**.html         ★ 페이지 본문 (예: pages/company/greeting.html → /company/greeting)
  input.css             스타일 (Tailwind v4 + KPAA형 컴포넌트)
scripts/build.mjs       정적 사이트 생성기 (페이지·CSS·검색색인·sitemap·vercel.json)
api/                    submit · public · auth · oauth-callback · admin
lib/                    google(REST) · data(Drive/Calendar) · mail · session · token-store · seed(기본 게시물/설정)
```

## 5. 콘텐츠 수정 → 빌드

```bash
npm install
npm run build      # public/ 재생성 (페이지 40개 + CSS + 아이콘 서브셋) + preview/ 미리보기판 생성
```
- 메뉴 추가/변경: `src/site.mjs` → 본문 파일 `src/pages/<경로>.html` 생성 → 빌드
- 게시판 하위메뉴는 `board: 'notice'`처럼 지정하면 본문 파일 없이 자동 생성
- 게시물·일정·자료·마감일 등 **운영 데이터는 관리자 모드에서** 수정 (빌드 불필요)

## 6. 반영 전 확인할 것
- 대표 연락처 `010-1234-5678`, 주소 `테헤란로 123`은 기존 시안 값입니다 → `src/site.mjs`의 `CONTACT` 수정 후 빌드
- 연혁(`src/pages/company/history.html`)은 확인된 2026년 항목만 넣었습니다. 이전 연혁을 추가해 주세요.
- 커스텀 도메인이 `www.moarc.co.kr`이 아니면 `src/site.mjs`의 `SITE.url` 수정 후 빌드

---

## 7. 내 PC에서 실행하기 (로컬)

**Windows: 압축을 푼 폴더에서 `홈페이지_실행(크롬).bat`을 더블클릭**하면 서버가 켜지고 크롬에서 http://localhost:3000 이 열립니다. (창을 닫으면 서버 종료)

Node.js 18 이상(https://nodejs.org 의 LTS)이 설치되어 있으면 됩니다. 추가 설치·로그인은 필요 없습니다.

```bash
# 압축을 푼 폴더에서
npm start            # 또는: node scripts/local.mjs
```
- 홈페이지: http://localhost:3000 · 관리자: http://localhost:3000/admin
- 포트 변경: `PORT=8080 npm start` (Windows PowerShell: `$env:PORT=8080; npm start`)
- 종료: `Ctrl + C`

동봉된 `.env.local`에 로컬용 관리자 계정(`ADMIN_ID`·`ADMIN_PASSWORD`)이 들어 있어 바로 http://localhost:3000/admin 에 로그인할 수 있습니다.

로컬에서 **Google 연동**까지 시험하려면 프로젝트 폴더에 `.env.local` 파일을 만들고 다음을 적은 뒤 다시 실행하세요.
Google Cloud Console의 OAuth 클라이언트에 리디렉션 URI `http://localhost:3000/api/oauth-callback`도 추가해야 합니다.

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ADMIN_EMAILS=내계정@gmail.com
SESSION_SECRET=아무거나-32자-이상의-긴-문자열-입력
```
(`.env.local`은 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다.)
