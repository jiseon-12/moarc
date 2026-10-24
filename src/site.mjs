// 사이트 정보 구조(IA) — GNB · 메가메뉴 · LNB · 로케이션 · 사이트맵 · 모바일 메뉴가 모두 이 설정에서 생성됩니다.
// 페이지 본문: src/pages/<경로>.html  (예: /company/greeting → src/pages/company/greeting.html)

export const SITE = {
  name: '주식회사 모아크파트너스',
  brand: 'MOARC PARTNERS',
  url: 'https://www.moarc.co.kr',
  slogan: '가능성을 모아, 가치의 미래를 열다.',
  sloganEn: 'Accelerating Potential into Value',
  description: 'MOARC PARTNERS는 AI와 혁신 기술을 기반으로 사람, 기업, 산업의 성장을 가속하는 액셀러레이터(AC)이자 개인투자조합 GP입니다.',
  version: '3.1.0'
};

export const MENU = [
  {
    id: 'company', title: '모아크파트너스', en: 'ABOUT MOARC', icon: 'apartment',
    desc: '사람과 기술, 그리고 가능성을 연결합니다.',
    children: [
      { id: 'greeting', title: '인사말', path: '/company/greeting' },
      { id: 'vision', title: '미션 · 비전', path: '/company/vision' },
      { id: 'history', title: '연혁', path: '/company/history' },
      { id: 'experts', title: '조직 · 전문가그룹', path: '/company/experts' },
      { id: 'brand', title: 'CI · BI', path: '/company/brand' },
      { id: 'location', title: '오시는 길', path: '/company/location' }
    ]
  },
  {
    id: 'business', title: '주요사업', en: 'OUR BUSINESS', icon: 'hub',
    desc: '아이디어가 성장하는 여정을 함께합니다.',
    children: [
      { id: 'overview', title: '사업 개요', path: '/business/overview' },
      { id: 'education', title: '교육', path: '/business/education' },
      { id: 'consulting', title: '컨설팅', path: '/business/consulting' },
      { id: 'acceleration', title: '액셀러레이팅', path: '/business/acceleration' },
      { id: 'investment', title: '투자', path: '/business/investment' },
      { id: 'growth', title: 'M&A · 성장전략', path: '/business/growth' }
    ]
  },
  {
    id: 'programs', title: '프로그램', en: 'PROGRAMS', icon: 'rocket_launch',
    desc: '기업의 단계에 맞춘 성장 프로그램을 운영합니다.',
    children: [
      { id: 'ir-forum', title: '정례 IR 피칭 포럼', path: '/programs/ir-forum' },
      { id: 'mentoring', title: '맞춤형 멘토링', path: '/programs/mentoring' },
      { id: 'scaleup', title: '스케일업 액셀러레이팅', path: '/programs/scaleup' },
      { id: 'public', title: '공공기관 위탁사업', path: '/programs/public' }
    ]
  },
  {
    id: 'portfolio', title: '포트폴리오', en: 'PORTFOLIO', icon: 'business_center',
    desc: '함께 성장한 기업과 성과를 소개합니다.',
    children: [
      { id: 'companies', title: '포트폴리오 기업', path: '/portfolio/companies' },
      { id: 'timetable', title: '멘토링 배정표', path: '/portfolio/timetable' },
      { id: 'performance', title: '주요 성과', path: '/portfolio/performance' }
    ]
  },
  {
    id: 'news', title: '알림마당', en: 'NEWS & NOTICE', icon: 'campaign',
    desc: '모아크파트너스의 새로운 소식을 전합니다.',
    children: [
      { id: 'notice', title: '공지사항', path: '/news/notice', board: 'notice' },
      { id: 'ir', title: 'IR · 멘토링 공고', path: '/news/ir', board: 'ir' },
      { id: 'press', title: '보도자료', path: '/news/press', board: 'press' },
      { id: 'activity', title: '주요동정', path: '/news/activity', board: 'activity' },
      { id: 'schedule', title: '주요일정', path: '/news/schedule' },
      { id: 'recruit', title: '인재채용', path: '/news/recruit', board: 'recruit' }
    ]
  },
  {
    id: 'resources', title: '정보마당', en: 'RESOURCES', icon: 'library_books',
    desc: '사업 운영 자료와 자주 묻는 질문을 안내합니다.',
    children: [
      { id: 'library', title: '자료실', path: '/resources/library' },
      { id: 'ax-pipeline', title: 'AX 행정 자동화', path: '/resources/ax-pipeline' },
      { id: 'ethics', title: '윤리경영 · 감사리스크 0%', path: '/resources/ethics' },
      { id: 'faq', title: '자주하는 질문', path: '/resources/faq' }
    ]
  },
  {
    id: 'apply', title: '참여 · 신청', en: 'APPLY & CONTACT', icon: 'edit_document',
    desc: '프로그램 참가와 협업 문의를 온라인으로 접수합니다.',
    children: [
      { id: 'startup', title: '스타트업 참가신청', path: '/apply/startup' },
      { id: 'rfp', title: '기관 위탁 협의', path: '/apply/rfp' },
      { id: 'expert', title: '전문가(멘토) 등록', path: '/apply/expert' },
      { id: 'contact', title: '문의하기', path: '/apply/contact' }
    ]
  }
];

/** GNB에 노출되지 않는 이용안내 그룹 (푸터 링크) */
export const UTIL_GROUP = {
  id: 'guide', title: '이용안내', en: 'SITE GUIDE', icon: 'info', hidden: true,
  desc: '홈페이지 이용에 필요한 정책을 안내합니다.',
  children: [
    { id: 'privacy', title: '개인정보처리방침', path: '/guide/privacy' },
    { id: 'email', title: '이메일무단수집거부', path: '/guide/email' },
    { id: 'sitemap', title: '사이트맵', path: '/guide/sitemap' },
    { id: 'search', title: '통합검색', path: '/guide/search', noindex: true }
  ]
};

export const QUICK_STARTUP = [
  { icon: 'how_to_reg', label: 'IR 포럼 참가신청', href: '/apply/startup' },
  { icon: 'diversity_3', label: '맞춤형 멘토링', href: '/programs/mentoring' },
  { icon: 'schedule', label: '멘토링 배정표', href: '/portfolio/timetable' },
  { icon: 'business_center', label: '포트폴리오 검색', href: '/portfolio/companies' },
  { icon: 'badge', label: '전문가그룹', href: '/company/experts' },
  { icon: 'rocket_launch', label: '스케일업 프로그램', href: '/programs/scaleup' },
  { icon: 'folder_open', label: '자료실', href: '/resources/library' },
  { icon: 'quiz', label: '자주하는 질문', href: '/resources/faq' }
];

export const QUICK_ORG = [
  { icon: 'handshake', label: '기관 위탁 협의', href: '/apply/rfp' },
  { icon: 'request_quote', label: '위탁예산 시뮬레이터', href: '/programs/public#simulator' },
  { icon: 'person_add', label: '전문가(멘토) 등록', href: '/apply/expert' },
  { icon: 'account_tree', label: 'AX 행정 자동화', href: '/resources/ax-pipeline' },
  { icon: 'gavel', label: '윤리경영 선언', href: '/resources/ethics' },
  { icon: 'event', label: '주요일정', href: '/news/schedule' },
  { icon: 'insert_chart', label: '주요 성과', href: '/portfolio/performance' },
  { icon: 'admin_panel_settings', label: '관리자 모드', href: '/admin' }
];

export const SYSTEM_LINKS = [
  { tag: '정보공개', title: '포트폴리오 기업 검색', sub: '육성·투자 기업 DB', icon: 'manage_search', href: '/portfolio/companies' },
  { tag: '신청/접수', title: 'IR 포럼 참가 시스템', sub: '연 5회 정례 IR 온라인 접수', icon: 'app_registration', href: '/apply/startup' },
  { tag: '교육/멘토링', title: '멘토링 배정 조회', sub: '8대 분야 전담 멘토 시간표', icon: 'school', href: '/portfolio/timetable' },
  { tag: '공공위탁', title: '위탁 예산 시뮬레이터', sub: '기관 RFP 사업비 설계', icon: 'calculate', href: '/programs/public#simulator' },
  { tag: 'AX 자동화', title: '5단계 AX 파이프라인', sub: '행정 리드타임 75% 단축', icon: 'account_tree', href: '/resources/ax-pipeline' },
  { tag: '자료실', title: '공개 자료실', sub: '양식·발간자료 내려받기', icon: 'folder_open', href: '/resources/library' }
];

export const PARTNERS = [
  '전남창조경제혁신센터', '(재)목포수산식품지원센터', '한국벤처투자', '중소벤처기업진흥공단',
  '창업진흥원', '호남권엔젤투자허브', '대한변리사회', '특허법인 C&S'
];

export const FAMILY_SITES = [
  { name: '중소벤처기업부', url: 'https://www.mss.go.kr' },
  { name: '창업진흥원 (K-Startup)', url: 'https://www.k-startup.go.kr' },
  { name: '한국벤처투자', url: 'https://www.kvic.or.kr' },
  { name: '중소벤처기업진흥공단', url: 'https://www.kosmes.or.kr' },
  { name: '대한변리사회', url: 'https://www.kpaa.or.kr' }
];

export const CONTACT = {
  company: '주식회사 모아크파트너스 (MOARC Partners Co., Ltd.)',
  ceo: '김지선',
  address: '서울특별시 강남구 테헤란로 123, 모아크빌딩 10F',
  branch: '호남 본부 · 광주·전남 (전남창조경제혁신센터 · 목포수산식품지원센터 협력 거점)',
  tel: '010-1234-5678',
  email: 'contact@moarc.co.kr'
};
