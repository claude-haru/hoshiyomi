/**
 * 解釈のための参照テーブル。
 * 星座・ハウス・天体の基礎的な意味づけ。ここを充実させると合成される文章の質が上がる。
 */
import type { SignKey } from '../astro/zodiac.ts';
import type { BodyId } from '../astro/ephemeris.ts';

export interface SignRef {
  ja: string;
  element: '火' | '地' | '風' | '水';
  quality: '活動' | '不動' | '柔軟';
  rulerJa: string;
  /** 一言でいう性質 */
  core: string;
  /** 物事への取り組み方（合成用の連用形フレーズ。例:「じっくり腰を据えて」） */
  style: string;
  /** 強み */
  light: string;
  /** 注意点 */
  shadow: string;
  keywords: string[];
}

export const SIGN_TABLE: Record<SignKey, SignRef> = {
  aries: {
    ja: 'おひつじ座', element: '火', quality: '活動', rulerJa: '火星',
    core: '思い立ったらすぐ動く、開拓者の星座',
    style: '勢いよく先陣を切って',
    light: '決断が速く、ゼロからの立ち上げに強い。困難にも正面から向かう',
    shadow: '短気になりやすく、続ける前に飽きたり衝突したりしがち',
    keywords: ['行動力', '独立', 'スピード', '勇気', '負けん気'],
  },
  taurus: {
    ja: 'おうし座', element: '地', quality: '不動', rulerJa: '金星',
    core: '五感を大切に、地に足をつけて積み上げる星座',
    style: 'じっくり腰を据えて',
    light: '粘り強く、一度決めたことを安定して続けられる。現実的な価値感覚',
    shadow: '変化を嫌い、動き出すまでに時間がかかる。所有欲・頑固さ',
    keywords: ['安定', '継続', '豊かさ', '五感', 'マイペース'],
  },
  gemini: {
    ja: 'ふたご座', element: '風', quality: '柔軟', rulerJa: '水星',
    core: '情報を集めて軽やかにつなぐ、知的な風の星座',
    style: '状況を見ながら機敏に',
    light: '好奇心旺盛で言葉が巧み。複数のことを並行して回せる',
    shadow: '興味が移ろいやすく、浅く広くになりがち。落ち着きに欠ける',
    keywords: ['好奇心', 'コミュニケーション', '機転', '多才', '情報'],
  },
  cancer: {
    ja: 'かに座', element: '水', quality: '活動', rulerJa: '月',
    core: '身内を守り育てる、情の深い星座',
    style: '相手の気持ちを汲みながら',
    light: '面倒見がよく共感力が高い。安心できる居場所づくりが得意',
    shadow: '感情の波が大きく、身内とそれ以外で線を引きやすい',
    keywords: ['共感', '守り', '家庭', '記憶', '情'],
  },
  leo: {
    ja: 'しし座', element: '火', quality: '不動', rulerJa: '太陽',
    core: '自分を堂々と表現する、主役の星座',
    style: '自信をもって前に出て',
    light: '華があり人を惹きつける。責任感と気前のよさ、創造性',
    shadow: 'プライドが高く、認められないと拗ねる。演出過剰になりがち',
    keywords: ['自己表現', '存在感', '創造', '誇り', '寛大さ'],
  },
  virgo: {
    ja: 'おとめ座', element: '地', quality: '柔軟', rulerJa: '水星',
    core: '細部を整え役に立とうとする、実務の星座',
    style: '手順を整えて丁寧に',
    light: '分析力と実務能力が高い。地道な改善と献身',
    shadow: '完璧主義で自他に厳しい。心配性・批判的になりがち',
    keywords: ['分析', '実務', '健康管理', '奉仕', '改善'],
  },
  libra: {
    ja: 'てんびん座', element: '風', quality: '活動', rulerJa: '金星',
    core: 'バランスと調和を求める、社交の星座',
    style: '相手との釣り合いをとりながら',
    light: '公平で洗練された対人感覚。人と人をつなぐ調整力',
    shadow: '決断を先延ばしにしやすく、人に合わせて自分を見失う',
    keywords: ['調和', '対人関係', '美意識', '公平', '協調'],
  },
  scorpio: {
    ja: 'さそり座', element: '水', quality: '不動', rulerJa: '冥王星（火星）',
    core: '一つのことに深く沈み込み、本質をつかむ星座',
    style: '深く集中して徹底的に',
    light: '洞察力と集中力、危機に強い精神力。強い絆を結ぶ',
    shadow: '執着と猜疑心。white/black で割り切り、根に持ちやすい',
    keywords: ['深さ', '集中', '再生', '絆', '探究'],
  },
  sagittarius: {
    ja: 'いて座', element: '火', quality: '柔軟', rulerJa: '木星',
    core: '意味と可能性を求めて遠くへ向かう、冒険の星座',
    style: '大きく構えて前向きに',
    light: '楽観的で視野が広い。学びと挑戦で成長し続ける',
    shadow: '大雑把で飽きっぽい。言い過ぎ・広げ過ぎで詰めが甘い',
    keywords: ['探求', '自由', '楽観', '学び', '海外・遠方'],
  },
  capricorn: {
    ja: 'やぎ座', element: '地', quality: '活動', rulerJa: '土星',
    core: '目標に向かって現実的に積み上げる、達成の星座',
    style: '長期の見通しを立てて着実に',
    light: '責任感と忍耐、計画性。時間をかけて確かな実績を築く',
    shadow: '慎重すぎて動けない。損得や立場を優先し、堅くなりがち',
    keywords: ['目標達成', '責任', '忍耐', '社会的地位', '自己管理'],
  },
  aquarius: {
    ja: 'みずがめ座', element: '風', quality: '不動', rulerJa: '天王星（土星）',
    core: '既存の枠にとらわれず独自の視点をもつ、革新の星座',
    style: '一歩引いて客観的に',
    light: '独創的で先進的。分け隔てのない仲間意識と論理性',
    shadow: '感情より理屈が先で、距離をとりがち。あまのじゃく',
    keywords: ['独創', '自由', '仲間・ネットワーク', '客観', '革新'],
  },
  pisces: {
    ja: 'うお座', element: '水', quality: '柔軟', rulerJa: '海王星（木星）',
    core: '境界をとかして大きなものに溶け込む、共感の星座',
    style: '流れに沿って感じ取りながら',
    light: '想像力と慈愛が豊か。芸術・癒し・献身の才',
    shadow: '流されやすく現実逃避しがち。境界があいまいで疲れやすい',
    keywords: ['共感', '想像力', '癒し', '無償の愛', 'あいまいさ'],
  },
};

export interface HouseRef {
  ja: string;
  /** 扱う領域 */
  theme: string;
  /** 短い言い方 */
  short: string;
  keywords: string[];
}

export const HOUSE_TABLE: Record<number, HouseRef> = {
  1: { ja: '第1ハウス', theme: '自分自身・第一印象・人生への姿勢', short: '自分の見せ方', keywords: ['個性', '体', '始め方'] },
  2: { ja: '第2ハウス', theme: '収入・所有・才能・自己価値', short: 'お金と価値観', keywords: ['稼ぐ力', '資産', '価値観'] },
  3: { ja: '第3ハウス', theme: '身近な人・学び・移動・情報', short: '日常の交流と学び', keywords: ['兄弟姉妹', '会話', '近距離'] },
  4: { ja: '第4ハウス', theme: '家庭・ルーツ・心の基盤', short: '家と心の土台', keywords: ['家族', '住まい', '安心'] },
  5: { ja: '第5ハウス', theme: '恋愛・創造・遊び・子ども', short: '楽しみと恋', keywords: ['恋愛', '趣味', '自己表現'] },
  6: { ja: '第6ハウス', theme: '仕事の実務・健康・習慣', short: '日々の労働と体調', keywords: ['ルーティン', '体調管理', '役割'] },
  7: { ja: '第7ハウス', theme: '結婚・パートナー・1対1の関係', short: '相手との関係', keywords: ['配偶者', '契約', '対等な相手'] },
  8: { ja: '第8ハウス', theme: '共有財産・深い結びつき・継承', short: '他者との共有と深い縁', keywords: ['遺産', '融資', '性', '変容'] },
  9: { ja: '第9ハウス', theme: '高等教育・宗教哲学・遠方', short: '広い世界と探求', keywords: ['海外', '専門', '信条'] },
  10: { ja: '第10ハウス', theme: '仕事・社会的立場・到達点', short: 'キャリアと肩書き', keywords: ['天職', '評価', '目標'] },
  11: { ja: '第11ハウス', theme: '仲間・ネットワーク・未来の希望', short: '仲間と将来像', keywords: ['友人', 'コミュニティ', '理想'] },
  12: { ja: '第12ハウス', theme: '無意識・秘密・奉仕・手放し', short: '見えない領域', keywords: ['潜在意識', '孤独', '救済'] },
};

export interface PlanetRef {
  ja: string;
  /** その天体が司る領域（詳しめ） */
  domain: string;
  /** 文章に埋め込むための短い言い方（「〜の部分」の形で使える名詞句） */
  short: string;
}

export const PLANET_TABLE: Partial<Record<BodyId | 'ascendant' | 'mc', PlanetRef>> = {
  sun: { ja: '太陽', domain: '人生の目的・意志・自分の中心', short: 'こうありたいという意志' },
  moon: { ja: '月', domain: '感情・安心の求め方・素の自分', short: '感情と安心を求める気持ち' },
  mercury: { ja: '水星', domain: '思考・言葉・学び方・伝え方', short: '考え方や伝え方' },
  venus: { ja: '金星', domain: '愛し方・美意識・楽しみ・お金や豊かさの受け取り方', short: '愛し方や楽しみ方' },
  mars: { ja: '火星', domain: '意欲・行動力・怒り・欲しいものの取りに行き方', short: '行動力や欲しいものへの向かい方' },
  jupiter: { ja: '木星', domain: '成長・幸運・寛容さ・世界の広げ方', short: '広げよう・楽観しようとする力' },
  saturn: { ja: '土星', domain: '責任・限界・忍耐・時間をかけて築くもの', short: '慎重に守り・責任を果たそうとする力' },
  uranus: { ja: '天王星', domain: '変革・自由・独自性', short: '自由でありたい・型を破りたい衝動' },
  neptune: { ja: '海王星', domain: '理想・想像力・境界のあいまいさ', short: '夢を見たい・とけ合いたい気持ち' },
  pluto: { ja: '冥王星', domain: '破壊と再生・強い衝動・徹底', short: 'とことん突き詰めようとする衝動' },
  ascendant: { ja: 'アセンダント', domain: '生き方の姿勢・第一印象・体質', short: '生き方の姿勢や見せ方' },
  mc: { ja: 'MC', domain: '社会的な到達点・目指す姿', short: '社会で目指す姿' },
};
