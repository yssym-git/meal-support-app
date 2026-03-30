import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MealProposal, SituationInput, CourseType, FatigueLevel } from '../types'
import { fetchMealProposals, fetchPraiseMessage, fetchRecipe } from '../lib/claude'
import type { Recipe } from '../lib/claude'
import { loadSettings, getRecentMenuTitles, addHistory, getWeeklyStats } from '../lib/storage'

const COURSE_META: Record<CourseType, { label: string; emoji: string; color: string; badge: string }> = {
  full:   { label: '全力コース',      emoji: '👨‍🍳', color: 'border-green-400 bg-green-50',   badge: 'bg-green-400' },
  normal: { label: 'ちゃんとコース',  emoji: '🍳',  color: 'border-blue-400 bg-blue-50',    badge: 'bg-blue-400' },
  quick:  { label: '時短コース',      emoji: '⚡',  color: 'border-yellow-400 bg-yellow-50', badge: 'bg-yellow-400' },
  frozen: { label: '冷凍・惣菜コース', emoji: '❄️', color: 'border-cyan-400 bg-cyan-50',    badge: 'bg-cyan-400' },
  rest:   { label: 'お休みコース',    emoji: '🛋️', color: 'border-purple-400 bg-purple-50', badge: 'bg-purple-400' },
}

function getSavedMinutes(course: CourseType, estimated: number): number {
  if (course === 'rest') return 45
  if (course === 'frozen') return Math.max(0, 45 - estimated)
  if (course === 'quick') return Math.max(0, 45 - estimated)
  return 0
}

function getRecommendedCourse(fatigue: FatigueLevel, cookingMinutes: number): CourseType {
  if (fatigue >= 4 && cookingMinutes <= 15) return 'rest'
  if (cookingMinutes === 0) return 'rest'
  if (cookingMinutes <= 15) return 'frozen'
  if (cookingMinutes <= 30) return 'quick'
  if (cookingMinutes <= 60) return 'normal'
  return 'full'
}

export default function Proposal() {
  const navigate = useNavigate()
  const [proposals, setProposals] = useState<MealProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<MealProposal | null>(null)
  const [praiseMsg, setPraiseMsg] = useState('')
  const [praiseLoading, setPraiseLoading] = useState(false)
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [recommendedCourse, setRecommendedCourse] = useState<CourseType>('normal')

  const settings = loadSettings()

  useEffect(() => {
    const raw = sessionStorage.getItem('situation')
    if (!raw) { navigate('/'); return }
    const situation: SituationInput = JSON.parse(raw)
    const recentMenus = getRecentMenuTitles(7)

    setRecommendedCourse(getRecommendedCourse(situation.fatigue, situation.cookingMinutes))

    fetchMealProposals({ ...situation, settings, recentMenus })
      .then(setProposals)
      .catch(() => setError('献立の取得に失敗しました。APIキーを確認してください。'))
      .finally(() => setLoading(false))
  }, [navigate])

  async function handleSelect(proposal: MealProposal) {
    setSelected(proposal)
    setRecipe(null)
    setPraiseLoading(true)
    setRecipeLoading(true)

    const savedMinutes = getSavedMinutes(proposal.course, proposal.estimatedMinutes)
    const stats = getWeeklyStats()

    addHistory({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      fatigue: (JSON.parse(sessionStorage.getItem('situation') || '{}') as SituationInput).fatigue,
      course: proposal.course,
      menuTitle: proposal.title,
      savedMinutes,
    })

    // Fetch praise and recipe concurrently
    const [praiseResult, recipeResult] = await Promise.allSettled([
      fetchPraiseMessage({ course: proposal.course, menuTitle: proposal.title, savedMinutes, stats }),
      fetchRecipe({ title: proposal.title, course: proposal.course, familySize: settings.familySize, mealItems: proposal.items }),
    ])

    setPraiseMsg(
      praiseResult.status === 'fulfilled' ? praiseResult.value : '今日の選択、最高です！✨'
    )
    setPraiseLoading(false)

    setRecipe(
      recipeResult.status === 'fulfilled' ? recipeResult.value : null
    )
    setRecipeLoading(false)
  }

  async function copyIngredients() {
    if (!recipe || recipe.ingredients.length === 0) return
    const lines = [
      `【${selected?.title}】`,
      `材料（${settings.familySize}人分）`,
      ...recipe.ingredients.map(i => `・${i.name}：${i.amount}`),
    ]
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 border-4 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-500">献立を考え中...🍳</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <p className="text-red-500">{error}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-orange-500 underline">
          ホームに戻る
        </button>
      </div>
    )
  }

  if (selected) {
    const meta = COURSE_META[selected.course]
    const savedMinutes = getSavedMinutes(selected.course, selected.estimatedMinutes)
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 選択した献立 */}
        <div className={`rounded-2xl p-5 border-2 ${meta.color}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${meta.badge}`}>
              {meta.emoji} {meta.label}
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">{selected.title}</h2>
          <p className="text-gray-500 text-sm mt-1">{selected.description}</p>
          {savedMinutes > 0 && (
            <p className="mt-3 text-lg font-bold text-orange-500">
              ⏱️ {savedMinutes}分の自由時間を生成しました！
            </p>
          )}
        </div>

        {/* 称賛メッセージ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm min-h-[64px] flex items-center justify-center">
          {praiseLoading ? (
            <div className="w-6 h-6 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
          ) : (
            <p className="text-gray-700 text-center leading-relaxed text-sm">{praiseMsg}</p>
          )}
        </div>

        {/* 材料・作り方 */}
        {recipeLoading ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">材料と作り方を取得中...</p>
          </div>
        ) : recipe && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 材料 */}
            {recipe.ingredients.length > 0 && (
              <div>
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                  <h3 className="font-bold text-gray-700">材料（{settings.familySize}人分）</h3>
                </div>
                <table className="w-full">
                  <tbody>
                    {recipe.ingredients.map((ing, i) => (
                      <tr key={i} className={i < recipe.ingredients.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-800">{ing.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-500 text-right">{ing.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* コピーボタン */}
                <div className="px-4 pb-3">
                  <button
                    onClick={copyIngredients}
                    className={`w-full py-2 rounded-xl text-sm font-bold transition-colors ${
                      copied
                        ? 'bg-green-100 text-green-600'
                        : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                    }`}
                  >
                    {copied ? '✓ コピーしました！' : '材料をコピー 📋'}
                  </button>
                </div>
              </div>
            )}

            {/* 作り方 */}
            {recipe.steps.length > 0 && (
              <div className="border-t border-gray-100">
                <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                  <h3 className="font-bold text-gray-700">作り方</h3>
                </div>
                <ol className="divide-y divide-gray-50">
                  {recipe.steps.map((step, i) => (
                    <li key={i} className="px-4 py-3 flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-400 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => { setSelected(null); setPraiseMsg(''); setRecipe(null) }}
          className="w-full bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-2xl"
        >
          別のコースを見る
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <p className="text-center text-gray-500 text-sm">どれでも正解です。今日の気分で選んでください 😊</p>
      {proposals.map(p => {
        const meta = COURSE_META[p.course]
        const isRecommended = p.course === recommendedCourse
        return (
          <div key={p.course} className={`rounded-2xl p-5 border-2 ${meta.color} ${isRecommended ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${meta.badge}`}>
                  {meta.emoji} {meta.label}
                </span>
                {isRecommended && (
                  <span className="text-xs font-bold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">
                    おすすめ
                  </span>
                )}
              </div>
              {p.estimatedMinutes > 0 && (
                <span className="text-xs text-gray-500">約{p.estimatedMinutes}分</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{p.title}</h3>
            <p className="text-gray-500 text-sm mb-3">{p.description}</p>
            {p.items.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {p.items.map(item => (
                  <span key={item} className="text-xs bg-white/70 border border-white px-2 py-0.5 rounded-full text-gray-600">
                    {item}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => handleSelect(p)}
              className="w-full bg-white/80 hover:bg-white border border-current font-bold py-2 rounded-xl text-gray-700 transition-colors"
            >
              これにする！
            </button>
          </div>
        )
      })}
    </div>
  )
}
