import Anthropic from '@anthropic-ai/sdk'
import type { FatigueLevel, MealProposal, Settings, FlyerItem, CourseType } from '../types'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const FATIGUE_LABELS: Record<FatigueLevel, string> = {
  1: 'とても元気',
  2: 'まあまあ元気',
  3: 'ふつう',
  4: 'やや疲れている',
  5: 'かなり疲れている',
}

const COURSE_LABELS: Record<CourseType, string> = {
  full: '全力コース',
  normal: 'ちゃんとコース',
  quick: '時短コース',
  frozen: '冷凍・惣菜コース',
  rest: 'お休みコース',
}

function getMealTime(time: string): '朝食' | '昼食' | '夕食' {
  const [h] = time.split(':').map(Number)
  if (h >= 5 && h < 10) return '朝食'
  if (h >= 10 && h < 15) return '昼食'
  return '夕食'
}

export async function fetchMealProposals(params: {
  fatigue: FatigueLevel
  cookingStartTime: string
  cookingMinutes: number
  weather: string
  settings: Settings
  recentMenus: string[]
}): Promise<MealProposal[]> {
  const { fatigue, cookingStartTime, cookingMinutes, weather, settings, recentMenus } = params

  const mealTime = getMealTime(cookingStartTime)

  const allergyNote =
    settings.allergies.length > 0
      ? `アレルギー・NG食材: ${settings.allergies.join('、')}`
      : 'アレルギーなし'

  const recentNote =
    recentMenus.length > 0
      ? `最近食べた献立（なるべく重複を避ける）: ${recentMenus.slice(0, 5).join('、')}`
      : ''

  const prompt = `あなたは「手抜きを肯定する」メンタルケア型の献立提案アシスタントです。
ユーザーを責めず、どのコースを選んでも正解だと伝えるやさしいトーンで提案してください。

【今日の状況】
- 食事の種類: ${mealTime}（${cookingStartTime}頃）
- 疲れ度: ${FATIGUE_LABELS[fatigue]}（${fatigue}/5）
- 料理に使える時間: ${cookingMinutes}分
- 天気: ${weather === 'rainy' ? '雨' : weather === 'cloudy' ? '曇り' : '晴れ'}
- 家族人数: ${settings.familySize}人
- ${allergyNote}
${recentNote ? `- ${recentNote}` : ''}

「${mealTime}」として適した献立を5コースそれぞれ1つ提案してください。
JSON配列で返してください（他のテキストは不要）。

[
  {
    "course": "full",
    "title": "${mealTime}向けのしっかり手作りメニュー名（60分以上）",
    "description": "やさしいひとこと説明（1〜2文）",
    "items": ["材料1", "材料2"],
    "estimatedMinutes": 調理時間（整数、60以上）
  },
  {
    "course": "normal",
    "title": "${mealTime}向けの普通の手作りメニュー名（30〜60分）",
    "description": "やさしいひとこと説明",
    "items": ["材料1", "材料2"],
    "estimatedMinutes": 調理時間（整数、30〜60）
  },
  {
    "course": "quick",
    "title": "${mealTime}向けの簡単手作りメニュー名（15〜30分）",
    "description": "やさしいひとこと説明",
    "items": ["材料1", "材料2"],
    "estimatedMinutes": 調理時間（整数、15〜30）
  },
  {
    "course": "frozen",
    "title": "冷凍食品・惣菜を使った${mealTime}向けメニュー名",
    "description": "今日はこれで十分！という応援メッセージ込みで",
    "items": ["冷凍食品や惣菜1", "追加するもの"],
    "estimatedMinutes": 調理時間（整数、15以下）
  },
  {
    "course": "rest",
    "title": "デリバリー・外食のおすすめ",
    "description": "今日はしっかり休もう、という応援メッセージ込みで",
    "items": ["Uber Eats", "出前館"],
    "estimatedMinutes": 0
  }
]`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('献立提案の解析に失敗しました')
  return JSON.parse(jsonMatch[0]) as MealProposal[]
}

export interface Recipe {
  ingredients: { name: string; amount: string }[]
  steps: string[]
}

export async function fetchRecipe(params: {
  title: string
  course: CourseType
  familySize: number
  mealItems: string[]
}): Promise<Recipe> {
  const { title, course, familySize, mealItems } = params

  if (course === 'rest') {
    return {
      ingredients: [],
      steps: ['お好みのデリバリーサービスや外食先を選んでゆっくり休んでください 🛋️'],
    }
  }

  const itemsHint =
    mealItems.length > 0 ? `ヒント（必ずしも全て使う必要はない）: ${mealItems.join('、')}` : ''

  const prompt = `「${title}」の材料と作り方を${familySize}人分で教えてください。
${itemsHint}

以下のJSON形式のみで返してください（前後に説明不要）：
{
  "ingredients": [
    { "name": "材料名", "amount": "${familySize}人分の分量（例: 300g、大さじ2、1個）" }
  ],
  "steps": [
    "手順の説明（簡潔に1ステップ1文）"
  ]
}`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('レシピの解析に失敗しました')
  return JSON.parse(jsonMatch[0]) as Recipe
}

export async function fetchPraiseMessage(params: {
  course: CourseType
  menuTitle: string
  savedMinutes: number
  stats: { thisWeekRate: number; lastWeekRate: number; totalSavedMinutes: number; count: number }
}): Promise<string> {
  const { course, menuTitle, savedMinutes, stats } = params

  const courseLabel = COURSE_LABELS[course]
  const personalNote =
    stats.count > 0 && stats.thisWeekRate > stats.lastWeekRate
      ? '先週より時短率が上がっています。'
      : stats.totalSavedMinutes > 60
        ? `今週だけで合計${stats.totalSavedMinutes}分の自由時間を生み出しています。`
        : ''

  const prompt = `あなたは「手抜きを肯定する」メンタルケア型アプリのアシスタントです。
ユーザーが「${courseLabel}」で「${menuTitle}」を選びました。
${savedMinutes > 0 ? `この選択で約${savedMinutes}分の自由時間が生まれます。` : ''}
${personalNote}

ユーザーへの短いポジティブメッセージを1〜3文で作成してください。
・「${savedMinutes}分の自由時間を生成しました！」のようなゲーム風表現を使う
・絵文字を1〜2個使う
・責めない、褒める、ユーモアがある
・余計な説明なしに、メッセージ本文だけ返す`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  return message.content[0].type === 'text' ? message.content[0].text.trim() : ''
}

export async function extractFlyerItems(base64Image: string, mimeType: string): Promise<FlyerItem[]> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `このチラシ画像から商品情報を抽出してJSON配列で返してください。
他のテキストは不要です。

[
  {
    "name": "商品名",
    "price": 価格（整数、円）,
    "unit": "単位（例: 100g、1パック）",
    "validUntil": "有効期限（例: 12/25、記載なければnull）"
  }
]`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []
  return JSON.parse(jsonMatch[0]) as FlyerItem[]
}
