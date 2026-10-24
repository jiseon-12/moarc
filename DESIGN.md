---
name: MOARC PARTNERS Brand Portal
version: 3.1
colors:
  moarc-blue: '#1F6BFF'     # 성장과 혁신 — 주요 CTA, 활성 탭, 포인트
  deep-blue: '#0C2D6B'      # 신뢰와 전문성 — 로고, 상단 유틸리티 바, 기관 전용 영역, 푸터
  silver: '#C9CDD3'         # 고급감과 미래 — 카드 테두리, 구분선
  light-silver: '#EEF1F6'   # 깨끗한 배경 — 페이지 배경, 입력 필드, 표 헤더
  charcoal: '#1F2430'       # 가독성 텍스트 — 헤드라인, 본문
  on-surface-variant: '#4B5565'  # 보조 텍스트
  semantic:
    success: '#059669'      # emerald-600 — 검증 완료, 접수 완료
    attention: '#F59E0B'    # amber-500 — 신규 접수, 시연 모드 안내
    risk: '#DC2626'         # red-600 — As-Is 비교, 입력 오류
typography:
  sans: 'Pretendard Variable'       # 국문·영문 본문 및 헤드라인
  data: 'Space Grotesk'             # 숫자, 날짜, 라벨(KICKER), 카운트다운
  hero: 62px / 800 / -0.02em (mobile 40px)
  section-title: 30px / 800
  body: 15–17px / 400 / line-height 1.7
  label: 11–12px / 700 / uppercase / tracking 0.2em
radius:
  chip: 4–6px
  control: 8px
  card: 12–16px
  panel: 16–24px
  pill: 9999px   # CTA 버튼, 상태 배지
layout:
  container: 1360px
  gutter: 16px (mobile) / 24px / 48px (lg)
  header: 116px (utility 36px + GNB 80px, fixed)
  breakpoints: sm 640 · md 768 · lg 1024 · xl 1280 (데스크톱 GNB) · 2xl 1536
---

## 브랜드 방향

공식 BI 가이드의 **화이트·실버·블루** 라이트 테마. 키워드: 세련된 · 고급스러운 · 진취적인 · 미래지향적인 · 액셀러레이터.
대한변리사회(KPAA) 포털의 기관형 정보 구조(유틸리티 바, 전체메뉴, 대상별 퀵메뉴, 멀티탭 게시판)를 모아크 브랜드로 재해석한다.

> v1 초기 다크 테마(`#080E1E` / `#00D2FF`, Newsreader·Hanken Grotesk)는 폐기되었다.

## 로고

- 공식 로고 파일: `public/assets/brand/logo-navy.png`(밝은 배경) / `logo-white.png`(DEEP BLUE·어두운 배경). 텍스트로 로고를 다시 조판하지 않는다.
- 헤더 44px(모바일 34px) · 푸터 46px 높이. O–R 사이 실버 아크는 분리·변색하지 않는다.

## 컬러 사용 규칙

- **MOARC BLUE**는 화면당 1차 행동(CTA) 1개와 활성 상태에만 쓴다. 넓은 면적에는 `moarc-blue/10` 틴트를 쓴다.
- **DEEP BLUE**는 신뢰가 필요한 고정 영역(유틸리티 바, 기관·심사역 전용, 푸터, 서브페이지 배너 그라디언트 시작점)에 쓴다.
- 서브페이지 배너: `deep-blue → moarc-blue` 좌→우 그라디언트.
- 텍스트 대비: 본문 charcoal / 보조 `#4B5565` (흰 배경 기준 WCAG AA 충족).

## 컴포넌트

- **portal-card**: 흰 배경, 1px silver 테두리, 아주 옅은 deep-blue 그림자. hover 시 테두리 moarc-blue + 블루 그림자.
- **버튼**: 1차 = moarc-blue 캡슐(hover deep-blue). 2차 = 흰 배경 + silver 테두리. 기관용 = deep-blue.
- **날짜 배지(게시판)**: 56px 정사각, 일(day) Space Grotesk 18px/800 + 연월 10px.
- **입력 필드**: light-silver 배경, silver 테두리, 포커스 시 moarc-blue 테두리. 오류 시 red 테두리 + 3px 옅은 링.
- **모달**: 최대 높이 90vh, 헤더(kicker + 제목) / 스크롤 본문 / 액션 푸터. ESC·배경 클릭으로 닫힘.
- **토스트**: deep-blue 배경, 좌측 4px 상태색 보더, 우하단, 4.2초.
- **배정표 하이라이트**: 일치 셀 moarc-blue 배경 + 흰 텍스트.

## 모션

- 뷰 전환 0.28s 페이드업, 모달 0.2s, 카드 hover 0.25s.
- `prefers-reduced-motion` 시 모든 애니메이션·스무스 스크롤 비활성.

## 구현

토큰은 `src/input.css`의 `@theme` 블록에 정의되어 Tailwind 유틸리티(`bg-moarc-blue`, `text-deep-blue`, `border-moarc-silver`, `bg-light-silver`, `text-charcoal`, `font-label-data` 등)로 사용된다.


## 레이아웃 템플릿 (v3 — KPAA형 기관 포털)

| 영역 | 규격 |
| :--- | :--- |
| 유틸리티 바 | 36px · 13px 회색 텍스트 · 우측 통합검색/KOR·ENG/관리자/전체메뉴 (1280px 미만 숨김) |
| GNB | 80px · 대메뉴 17px/700 · 활성/호버 하단 3px MOARC BLUE · 호버 시 전체 하위메뉴 펼침 |
| 서브비주얼 | 240px(모바일 150px) · DEEP→MOARC BLUE 그라디언트 + 아크 |
| 로케이션 바 | 서브비주얼에 28px 겹침 · 홈(DEEP BLUE) + 대/소메뉴 드롭다운 + 공유/인쇄 |
| LNB | 240px · 상단 그라디언트 헤더 + 하위메뉴 리스트 (1024px 미만 숨김) |
| 본문 제목 | 32px/800 + 하단 2px CHARCOAL 라인 · 섹션 제목 22px + 좌측 블루 바 |
| 표·게시판 | 상단 2px DEEP BLUE 라인 · 행 구분 #DDE2EA · th 배경 #F7F9FC |
| 폼 | 라벨 200px 회색 칸 + 입력 (모바일 세로 배치) |
| 푸터 | #1A2233 · 정책 링크 + 유관기관 셀렉트 / 로고 + 기관 정보 |
