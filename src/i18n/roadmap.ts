import type { Locale } from "./config";

// The roadmap from high school to a US college through athletic recruiting, shown on the
// student's account page (src/components/account/roadmap.tsx). Rules checked 2026-10-08;
// each step lists where the facts come from. When a rule changes, change it here.

export type StepKey =
  | "goal"
  | "grades"
  | "english"
  | "results"
  | "ncaa"
  | "profile"
  | "video"
  | "list"
  | "contact"
  | "visits"
  | "tests"
  | "offer"
  | "commit"
  | "apply"
  | "documents"
  | "i20"
  | "visa"
  | "arrive";

export type PhaseKey = "prepare" | "noticed" | "offer" | "enroll";

export type StepDef = {
  key: StepKey;
  phase: PhaseKey;
  // Months before the August the student starts college: the "by" date shown next to the step.
  monthsBefore: number;
};

export const steps: StepDef[] = [
  { key: "goal", phase: "prepare", monthsBefore: 36 },
  { key: "grades", phase: "prepare", monthsBefore: 36 },
  { key: "english", phase: "prepare", monthsBefore: 30 },
  { key: "results", phase: "prepare", monthsBefore: 30 },
  { key: "ncaa", phase: "noticed", monthsBefore: 26 },
  { key: "profile", phase: "noticed", monthsBefore: 26 },
  { key: "video", phase: "noticed", monthsBefore: 26 },
  { key: "list", phase: "noticed", monthsBefore: 25 },
  { key: "contact", phase: "noticed", monthsBefore: 24 },
  { key: "visits", phase: "offer", monthsBefore: 20 },
  { key: "tests", phase: "offer", monthsBefore: 18 },
  { key: "offer", phase: "offer", monthsBefore: 15 },
  { key: "commit", phase: "offer", monthsBefore: 12 },
  { key: "apply", phase: "enroll", monthsBefore: 9 },
  { key: "i20", phase: "enroll", monthsBefore: 5 },
  { key: "visa", phase: "enroll", monthsBefore: 3 },
  { key: "documents", phase: "enroll", monthsBefore: 2 },
  { key: "arrive", phase: "enroll", monthsBefore: 0 },
];

type Source = { label: string; url: string };

export type StepText = {
  title: string;
  // One line: why this step matters.
  why: string;
  todo: string[];
  // Where the student updates the data that ticks this step automatically, if any.
  auto?: string;
  sources: Source[];
};

const src = {
  ncaaD1: { label: "NCAA: Division I initial eligibility", url: "https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/division-i/" },
  ncaaD2: { label: "NCAA: Division II initial eligibility", url: "https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/division-ii/" },
  ncaaIntl: { label: "NCAA: International students", url: "https://www.ncaa.org/eligibility-center/international-student-athletes/" },
  ec: { label: "NCAA Eligibility Center", url: "https://www.eligibilitycenter.org/" },
  naia: { label: "NAIA: International students", url: "https://www.naia.org/student-athletes/prospective/international-students/" },
  house: { label: "AJGA: House v. NCAA and college golf", url: "https://www.ajga.org/parents/college-recruiting/house-v-ncaa" },
  ajga: { label: "AJGA: College recruiting", url: "https://www.ajga.org/parents/collegegolf.asp" },
  toefl: { label: "ETS: TOEFL iBT scores (1–6 scale from Jan 2026)", url: "https://www.ets.org/toefl/institutions/ibt/score-scale-update.html" },
  duolingo: { label: "Duolingo English Test", url: "https://englishtest.duolingo.com/" },
  ielts: { label: "IELTS", url: "https://www.ielts.org/" },
  sat: { label: "SAT", url: "https://satsuite.collegeboard.org/sat" },
  act: { label: "ACT", url: "https://www.act.org/" },
  nli: { label: "ESPN: NCAA ends the National Letter of Intent", url: "https://www.espn.com/college-sports/story/_/id/41702974/ncaa-approves-elimination-national-letter-intent-program" },
  i20: { label: "Study in the States: the Form I-20", url: "https://studyinthestates.dhs.gov/students/prepare/students-and-the-form-i-20" },
  sevis: { label: "I-901 SEVIS fee", url: "https://www.fmjfee.com/" },
  visa: { label: "U.S. Department of State: Student visas", url: "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html" },
} satisfies Record<string, Source>;

type RoadmapDictionary = {
  title: string;
  lead: string;
  progress: (done: number, total: number) => string;
  now: string;
  next: string;
  allDone: string;
  by: (date: Date) => string;
  noEntryYear: string;
  markDone: string;
  undo: string;
  autoDone: string;
  sources: string;
  showAll: string;
  hideAll: string;
  disclaimer: string;
  phases: Record<PhaseKey, { title: string; when: string }>;
  steps: Record<StepKey, StepText>;
};

const en: RoadmapDictionary = {
  title: "Your road to a US college",
  lead: "Every step from now until your first day on campus, in order. Tick a step when it's done; some tick themselves from your profile.",
  progress: (done, total) => `${done} of ${total} steps done`,
  now: "Now",
  next: "Next",
  allDone: "Every step is done. Welcome to college golf!",
  by: (date) => `By ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
  noEntryYear: "Set the year you want to start college (Academics) to see a date for each step.",
  markDone: "Mark as done",
  undo: "Mark as not done",
  autoDone: "Done (from your profile)",
  sources: "Sources",
  showAll: "Show all steps",
  hideAll: "Hide steps",
  disclaimer: "Rules change. Check each official site before paying a fee or signing anything.",
  phases: {
    prepare: { title: "Get ready", when: "About 3 years before college" },
    noticed: { title: "Get noticed", when: "About 2 years before" },
    offer: { title: "Visits and offers", when: "2 years to 1 year before" },
    enroll: { title: "Enrollment and visa", when: "The final year" },
  },
  steps: {
    goal: {
      title: "Decide when and where you want to play",
      why: "Your timeline and level shape every step that follows.",
      todo: [
        "Pick the year you want to start college. US colleges start in August or September.",
        "Learn the levels: NCAA Division I, II and III, NAIA, and junior colleges (NJCAA).",
        "Talk about cost with your family. A scholarship often covers only part of the cost.",
        "At Division I schools in the House settlement, golf teams have up to 9 roster spots and coaches split aid among them.",
      ],
      auto: "Ticks itself when your start year and target levels are saved in Academics.",
      sources: [src.ncaaD1, src.house],
    },
    grades: {
      title: "Keep your school grades up",
      why: "College eligibility counts your grades from year nine (age 14–15) onward.",
      todo: [
        "NCAA Division I needs 16 core courses (English or your native language, math, science, social science and more) and a core GPA of at least 2.3. Division II needs 2.2.",
        "Division I: 10 of the 16 core courses must be done before your final year, 7 of them in English, math or science.",
        "SAT and ACT are no longer needed for NCAA eligibility, but some colleges still ask for them for admission.",
        "Keep copies of every year's report card from year nine.",
      ],
      auto: "Ticks itself when your GPA is saved in Academics.",
      sources: [src.ncaaD1, src.ncaaD2, src.ncaaIntl],
    },
    english: {
      title: "Study English and take a test",
      why: "Colleges need an English test score from students whose school language isn't English.",
      todo: [
        "Common minimums: TOEFL iBT 4–4.5 on the new 1–6 scale (about 80 on the old 0–120 scale), IELTS 6.0–6.5, Duolingo 105–120. Each college sets its own.",
        "Take a first test early to see where you are, then retake. Scores are valid for 2 years.",
        "Practice speaking: coaches will call you.",
      ],
      auto: "Ticks itself when you add a TOEFL, IELTS or Duolingo score.",
      sources: [src.toefl, src.ielts, src.duolingo],
    },
    results: {
      title: "Play tournaments and build a record",
      why: "Coaches recruit on 18-hole scoring average and results in strong events.",
      todo: [
        "Play national and international junior events. Rankings such as WAGR help coaches compare you.",
        "Link your results on AthNi with “This is me”, and request any missing tournament.",
        "Protect your amateur status: don't take prize money beyond expenses or sign with an agent. Doing so can end NCAA eligibility.",
      ],
      auto: "Ticks itself when your scoring average is saved or a result is confirmed.",
      sources: [src.ec, src.ajga],
    },
    ncaa: {
      title: "Register with the NCAA Eligibility Center",
      why: "You need an NCAA ID to be recruited and certified for Division I or II.",
      todo: [
        "Start with a free Profile Page account.",
        "Upgrade to the Academic and Amateurism Certification account before an official visit or signing. The fee for students outside the US and Canada is about US$160.",
        "Division III only needs an Amateurism-Only account. NAIA uses its own center (PlayNAIA, about US$170 plus an InCred evaluation).",
        "Save your NCAA ID in Academics on AthNi.",
      ],
      auto: "Ticks itself when your NCAA status is “Registered” or “Certified”.",
      sources: [src.ec, src.ncaaIntl, src.naia],
    },
    profile: {
      title: "Finish your AthNi profile and show it to coaches",
      why: "Verified college coaches find you here.",
      todo: [
        "Fill in your English name, graduation year, scoring average and test scores.",
        "Turn on “Show my profile to verified college coaches” at the top of this page.",
      ],
      auto: "Ticks itself when your English name, graduation year and scoring average are saved and your profile is shown to coaches.",
      sources: [],
    },
    video: {
      title: "Make a swing video",
      why: "Coaches who can't watch you play in person judge your swing from video.",
      todo: [
        "2–3 minutes: driver, irons, wedges, chipping and putting, filmed from the front and down the line.",
        "Put your name, graduation year and the filming date at the start.",
        "Upload to YouTube (unlisted is fine) and save the link in Golf.",
      ],
      auto: "Ticks itself when a video link is saved.",
      sources: [src.ajga],
    },
    list: {
      title: "Make a list of colleges",
      why: "Contacting the right colleges saves time for you and the coaches.",
      todo: [
        "Compare your scoring average with each team's players on the AthNi college pages.",
        "Look at majors, location, team size and cost too.",
        "List 15–30 colleges across levels. Add at least 5 to “Colleges I'm interested in”.",
      ],
      auto: "Ticks itself when 5 colleges are on your list.",
      sources: [],
    },
    contact: {
      title: "Contact coaches",
      why: "Most international players are found because they wrote first.",
      todo: [
        "Email each head coach: who you are, graduation year, scoring average, upcoming events, your AthNi profile and video links.",
        "Division I coaches may contact you from June 15 after your sophomore year (about age 16). You can write to them any time before that.",
        "Send updates after good results. Write each college a personal email, not one copied to all.",
      ],
      auto: "Ticks itself when a college on your list is set to “Contacted” or later.",
      sources: [src.ajga],
    },
    visits: {
      title: "Visit colleges or meet online",
      why: "You'll spend four years there. Meet the coach and team first.",
      todo: [
        "Division I official visits (paid by the college) can start August 1 before your junior year, one per college.",
        "You need the NCAA Certification account before an official visit.",
        "Unofficial visits at your own cost and video calls also count.",
      ],
      sources: [src.ajga, src.ec],
    },
    tests: {
      title: "Take the SAT or ACT if your colleges need it",
      why: "Not needed for NCAA eligibility, but some colleges use it for admission or academic scholarships.",
      todo: [
        "Check each college's admission page: many are test-optional.",
        "Both tests are offered outside the US. Book early; seats fill up.",
      ],
      auto: "Ticks itself when you add an SAT or ACT score.",
      sources: [src.sat, src.act],
    },
    offer: {
      title: "Get an offer",
      why: "An offer says how much athletic aid a college will give you.",
      todo: [
        "Compare offers by total yearly cost after aid, not the scholarship alone.",
        "Ask about your roster spot, academics and how many players travel to events.",
      ],
      auto: "Ticks itself when a college on your list is set to “Offer” or “Committed”.",
      sources: [src.house],
    },
    commit: {
      title: "Choose your college and sign",
      why: "Signing makes the offer of athletic aid binding.",
      todo: [
        "The National Letter of Intent was ended in 2025. You sign the college's written offer of athletics aid instead.",
        "After you sign, other colleges must stop recruiting you.",
        "Read the agreement with your family. A parent signs too if you are under 18.",
      ],
      auto: "Ticks itself when a college on your list is set to “Committed”.",
      sources: [src.nli],
    },
    apply: {
      title: "Apply for admission",
      why: "Being recruited is not admission. You still apply to the college.",
      todo: [
        "Send the application, essays, transcripts with English translations, and English test scores. The coach tells you the deadline.",
        "Pay the application fee.",
      ],
      sources: [],
    },
    i20: {
      title: "Get your Form I-20",
      why: "The I-20 from your college is what lets you apply for a student visa.",
      todo: [
        "After admission, send the college proof of funds (for example, a bank statement and a sponsor letter) for the cost aid doesn't cover.",
        "Check your name and dates on the I-20 and sign it. A parent signs too if you are under 18.",
      ],
      sources: [src.i20],
    },
    visa: {
      title: "Get your F-1 student visa",
      why: "You need an F-1 visa to study in the US.",
      todo: [
        "Pay the I-901 SEVIS fee (US$350) online.",
        "Fill in the DS-160 form, pay the visa fee (US$185) and book an interview at a US embassy or consulate.",
        "Bring your passport, I-20, SEVIS receipt and proof of funds. Visas can be issued up to 365 days before your start date.",
      ],
      sources: [src.sevis, src.visa, src.i20],
    },
    documents: {
      title: "Send final documents to the NCAA",
      why: "The NCAA certifies you only after it has your final records.",
      todo: [
        "After graduation, your school sends transcripts from year nine and proof of graduation, in the original language plus a certified line-by-line English translation.",
        "Records must come from your school, the issuing body or the translator, not from you. Each page carries your name and NCAA ID.",
        "Request your final amateurism certification in your Eligibility Center account.",
      ],
      auto: "Ticks itself when your NCAA status is “Certified”.",
      sources: [src.ncaaIntl, src.ec],
    },
    arrive: {
      title: "Move to the US and start college",
      why: "The last step.",
      todo: [
        "You can enter the US up to 30 days before the start date on your I-20. Carry the I-20 with you, not in checked luggage.",
        "Bring vaccination records and arrange health insurance as your college asks.",
      ],
      sources: [src.i20],
    },
  },
};

const ja: RoadmapDictionary = {
  title: "アメリカの大学までのロードマップ",
  lead: "今から大学に入学するまでにやることを、順番に並べました。終わったらチェックを付けてください。プロフィールの入力から自動でチェックが付くものもあります。",
  progress: (done, total) => `${total}ステップ中 ${done} 完了`,
  now: "いまここ",
  next: "次にやること",
  allDone: "すべて完了しました。カレッジゴルフへようこそ！",
  by: (date) => `目安: ${date.getFullYear()}年${date.getMonth() + 1}月まで`,
  noEntryYear: "「学業」で入学したい年を入れると、各ステップの目安の時期が出ます。",
  markDone: "完了にする",
  undo: "未完了に戻す",
  autoDone: "完了（プロフィールから判定）",
  sources: "出典",
  showAll: "すべてのステップを見る",
  hideAll: "閉じる",
  disclaimer: "ルールは変わることがあります。費用を払う前や署名の前に、必ず各公式サイトで確認してください。",
  phases: {
    prepare: { title: "準備", when: "入学の約3年前から" },
    noticed: { title: "コーチに知ってもらう", when: "入学の約2年前から" },
    offer: { title: "訪問とオファー", when: "入学の2年前〜1年前" },
    enroll: { title: "入学手続きとビザ", when: "最後の1年" },
  },
  steps: {
    goal: {
      title: "いつ、どのレベルでプレーしたいか決める",
      why: "入学の時期と目指すレベルで、この先のすべての予定が決まります。",
      todo: [
        "大学に入学したい年を決める（アメリカの大学は8〜9月に始まります）。",
        "レベルを知る: NCAA ディビジョン1・2・3、NAIA、短期大学（NJCAA）。",
        "費用について家族と話す。奨学金は学費の一部だけのことが多いです。",
        "ハウス和解に参加しているディビジョン1の大学では、ゴルフ部は最大9人で、奨学金はコーチが選手の間で配分します。",
      ],
      auto: "「学業」で入学したい年と目指すレベルを保存すると自動で完了になります。",
      sources: [src.ncaaD1, src.house],
    },
    grades: {
      title: "学校の成績を保つ",
      why: "NCAA の資格審査は、9年生（日本の中学3年生）からの成績を見ます。",
      todo: [
        "NCAA ディビジョン1は、主要科目（国語・英語、数学、理科、社会など）16単位と、その平均（コアGPA）2.3以上が必要です。ディビジョン2は2.2以上。",
        "ディビジョン1は、最終学年が始まるまでに16単位のうち10単位（うち7単位は国語・英語、数学、理科）を終えている必要があります。",
        "SAT・ACT は NCAA の資格には不要になりました。ただし入学審査で求める大学もあります。",
        "9年生からの成績表（通知表）を毎年保管しておく。",
      ],
      auto: "「学業」で評定平均かGPAを保存すると自動で完了になります。",
      sources: [src.ncaaD1, src.ncaaD2, src.ncaaIntl],
    },
    english: {
      title: "英語を勉強して、テストを受ける",
      why: "英語圏以外の学校の生徒は、英語のテストのスコアを求められます。",
      todo: [
        "よくある基準: TOEFL iBT 新スケール（1〜6）で4〜4.5（旧スケール0〜120でおよそ80）、IELTS 6.0〜6.5、Duolingo 105〜120。基準は大学ごとに違います。",
        "早めに一度受けて今の位置を知り、そのあと受け直す。スコアの有効期限は2年です。",
        "話す練習もしておく。コーチから電話やビデオ通話が来ます。",
      ],
      auto: "TOEFL・IELTS・Duolingo のスコアを追加すると自動で完了になります。",
      sources: [src.toefl, src.ielts, src.duolingo],
    },
    results: {
      title: "大会に出て、記録を残す",
      why: "コーチは18ホールの平均スコアと、レベルの高い大会での成績を見て選手を探します。",
      todo: [
        "全国大会や国際大会に出る。WAGR などのランキングがあると、コーチが比べやすくなります。",
        "AthNi で「これは自分です」から成績を紐付け、載っていない大会は申請する。",
        "アマチュア資格を守る: 経費を超える賞金を受け取ったり、代理人と契約したりしない。NCAA の出場資格を失うことがあります。",
      ],
      auto: "「ゴルフ」で平均スコアを保存するか、成績の紐付けが承認されると自動で完了になります。",
      sources: [src.ec, src.ajga],
    },
    ncaa: {
      title: "NCAA Eligibility Center に登録する",
      why: "ディビジョン1・2でスカウトされ、資格の認定を受けるには NCAA ID が必要です。",
      todo: [
        "まず無料の Profile Page アカウントを作る。",
        "公式訪問や署名の前に、Academic and Amateurism Certification アカウントに切り替える。アメリカ・カナダ以外の生徒の登録料は約160ドル。",
        "ディビジョン3だけなら Amateurism-Only アカウント。NAIA は別の窓口（PlayNAIA、約170ドル＋InCred の成績評価）。",
        "NCAA ID を AthNi の「学業」に保存する。",
      ],
      auto: "「学業」の NCAA 登録状況を「登録済み」か「認定済み」にすると自動で完了になります。",
      sources: [src.ec, src.ncaaIntl, src.naia],
    },
    profile: {
      title: "AthNi のプロフィールを仕上げて、コーチに公開する",
      why: "認証済みの大学コーチは、ここであなたを見つけます。",
      todo: [
        "英語の名前、卒業年、平均スコア、テストのスコアを入れる。",
        "このページ上部の「認証済みの大学コーチにプロフィールを公開する」をオンにする。",
      ],
      auto: "英語の名前・卒業年・平均スコアを保存し、コーチに公開すると自動で完了になります。",
      sources: [],
    },
    video: {
      title: "スイング動画を作る",
      why: "直接プレーを見られないコーチは、動画でスイングを判断します。",
      todo: [
        "2〜3分: ドライバー、アイアン、ウェッジ、アプローチ、パター。正面と後方から撮る。",
        "最初に名前、卒業年、撮影日を入れる。",
        "YouTube にアップロードし（限定公開で可）、「ゴルフ」にリンクを保存する。",
      ],
      auto: "動画のリンクを保存すると自動で完了になります。",
      sources: [src.ajga],
    },
    list: {
      title: "志望校リストを作る",
      why: "合う大学に連絡すると、自分にとってもコーチにとっても時間の無駄がありません。",
      todo: [
        "AthNi の大学ページで、自分の平均スコアを各チームの選手と比べる。",
        "専攻、場所、チームの人数、費用も見る。",
        "レベルを混ぜて15〜30校を選ぶ。「志望校リスト」に5校以上追加する。",
      ],
      auto: "志望校を5校追加すると自動で完了になります。",
      sources: [],
    },
    contact: {
      title: "コーチに連絡する",
      why: "海外の選手の多くは、自分から連絡したことで見つけてもらっています。",
      todo: [
        "各大学のヘッドコーチにメールする: 自己紹介、卒業年、平均スコア、今後の大会、AthNi のプロフィールと動画のリンク。",
        "ディビジョン1のコーチから連絡できるのは、10年生（日本の高校1年生）が終わった6月15日から。こちらからはいつでも送れます。",
        "良い成績が出たら近況を送る。全校に同じ文面ではなく、大学ごとに書く。",
      ],
      auto: "志望校のどれかを「連絡済み」以降にすると自動で完了になります。",
      sources: [src.ajga],
    },
    visits: {
      title: "大学を訪問する、またはオンラインで話す",
      why: "4年間過ごす場所です。先にコーチとチームに会っておきます。",
      todo: [
        "ディビジョン1の公式訪問（大学の費用負担）は、11年生（日本の高校2年生）が始まる前の8月1日から。1校につき1回。",
        "公式訪問の前に NCAA の Certification アカウントが必要です。",
        "自費の非公式訪問や、ビデオ通話でもかまいません。",
      ],
      sources: [src.ajga, src.ec],
    },
    tests: {
      title: "必要なら SAT か ACT を受ける",
      why: "NCAA の資格には不要ですが、入学審査や学業奨学金に使う大学があります。",
      todo: [
        "志望校の入学ページで確認する。テスト不要の大学も多いです。",
        "どちらもアメリカ国外で受けられます。席が埋まるので早めに予約する。",
      ],
      auto: "SAT か ACT のスコアを追加すると自動で完了になります。",
      sources: [src.sat, src.act],
    },
    offer: {
      title: "オファーをもらう",
      why: "オファーには、大学が出すスポーツ奨学金の額が書かれています。",
      todo: [
        "奨学金の額だけでなく、奨学金を引いた後の年間の総費用で比べる。",
        "チームでの立場、学業、大会に何人連れて行くかも聞く。",
      ],
      auto: "志望校のどれかを「オファー」か「進学決定」にすると自動で完了になります。",
      sources: [src.house],
    },
    commit: {
      title: "進学先を決めて署名する",
      why: "署名すると、スポーツ奨学金のオファーが確定します。",
      todo: [
        "National Letter of Intent（NLI）は2025年に廃止されました。代わりに大学の奨学金の書面（athletics aid agreement）に署名します。",
        "署名すると、ほかの大学はあなたの勧誘をやめなければなりません。",
        "家族と一緒に内容を読む。18歳未満なら保護者も署名します。",
      ],
      auto: "志望校のどれかを「進学決定」にすると自動で完了になります。",
      sources: [src.nli],
    },
    apply: {
      title: "大学に出願する",
      why: "スカウトされても、入学が決まったわけではありません。大学への出願は別に必要です。",
      todo: [
        "願書、エッセイ、成績証明書と英訳、英語テストのスコアを出す。締め切りはコーチが教えてくれます。",
        "出願料を払う。",
      ],
      sources: [],
    },
    i20: {
      title: "I-20 を受け取る",
      why: "大学が発行する I-20 があって、はじめて学生ビザを申請できます。",
      todo: [
        "合格後、奨学金で足りない分を払えることを示す資料（銀行の残高証明、保護者の支援書など）を大学に出す。",
        "届いた I-20 の名前と日付を確認して署名する。18歳未満なら保護者も署名します。",
      ],
      sources: [src.i20],
    },
    visa: {
      title: "F-1 学生ビザを取る",
      why: "アメリカで勉強するには F-1 ビザが必要です。",
      todo: [
        "I-901 SEVIS 費（350ドル）をオンラインで払う。",
        "DS-160 を入力し、ビザ申請料（185ドル）を払って、アメリカ大使館・領事館の面接を予約する。",
        "面接にはパスポート、I-20、SEVIS の領収書、資金の資料を持って行く。ビザは入学日の365日前から発給されます。",
      ],
      sources: [src.sevis, src.visa, src.i20],
    },
    documents: {
      title: "最終書類を NCAA に送る",
      why: "NCAA は最終の書類がそろってから資格を認定します。",
      todo: [
        "卒業後、学校から9年生以降の成績証明書と卒業証明書を送ってもらう。元の言語のものと、1行ずつ訳した認証付きの英訳の両方が必要です。",
        "書類は学校・発行元・翻訳者から送る必要があり、本人からは受け付けられません。各ページに名前と NCAA ID を入れます。",
        "Eligibility Center のアカウントで、アマチュア資格の最終認定を申請する。",
      ],
      auto: "「学業」の NCAA 登録状況を「認定済み」にすると自動で完了になります。",
      sources: [src.ncaaIntl, src.ec],
    },
    arrive: {
      title: "渡米して入学する",
      why: "最後のステップです。",
      todo: [
        "入国できるのは I-20 に書かれた開始日の30日前から。I-20 は預け荷物ではなく手荷物に入れる。",
        "大学の指示に従って、予防接種の記録と健康保険を準備する。",
      ],
      sources: [src.i20],
    },
  },
};

const dictionaries: Record<Locale, RoadmapDictionary> = { en, ja };

export const getRoadmapDictionary = (locale: Locale) => dictionaries[locale];
