import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FatigueLevel, SituationInput } from '../types'
import { loadHistory } from '../lib/storage'

const FATIGUE_LABELS: Record<FatigueLevel, { label: string; emoji: string; color: string }> = {
  1: { label: 'とても元気！', emoji: '😄', color: 'text-green-500' },
  2: { label: 'まあまあ元気', emoji: '🙂', color: 'text-lime-500' },
  3: { label: 'ふつう', emoji: '😐', color: 'text-yellow-500' },
  4: { label: 'やや疲れた', emoji: '😔', color: 'text-orange-500' },
  5: { label: 'かなり疲れた', emoji: '😩', color: 'text-red-500' },
}

const WEATHER_OPTIONS = [
  { value: 'sunny', label: '晴れ', emoji: '☀️' },
  { value: 'cloudy', label: '曇り', emoji: '☁️' },
  { value: 'rainy', label: '雨', emoji: '🌧️' },
] as const

function getNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getMealTimeLabel(time: string): string {
  const [h] = time.split(':').map(Number)
  if (h >= 5 && h < 10) return '朝食'
  if (h >= 10 && h < 15) return '昼食'
  return '夕食'
}

function getCookingMinutesLabel(minutes: number): string {
  if (minutes === 0) return '料理しない'
  if (minutes <= 15) return `約${minutes}分`
  if (minutes <= 30) return `約${minutes}分（時短コース向け）`
  if (minutes <= 60) return `約${minutes}分（ちゃんとコース向け）`
  return `約${minutes}分（全力コース向け）`
}

export default function Home() {
  const navigate = useNavigate()
  const [fatigue, setFatigue] = useState<FatigueLevel>(3)
  const [cookingStartTime, setCookingStartTime] = useState(getNow())
  const [cookingMinutes, setCookingMinutes] = useState(30)
  const [weather, setWeather] = useState<SituationInput['weather']>('sunny')
  const history = loadHistory()
  const recentCount = history.filter(h => {
    const age = Date.now() - new Date(h.date).getTime()
    return age < 7 * 24 * 60 * 60 * 1000
  }).length

  function handleSubmit() {
    const situation: SituationInput = { fatigue, cookingStartTime, cookingMinutes, weather }
    sessionStorage.setItem('situation', JSON.stringify(situation))
    navigate('/proposal')
  }

  const fi = FATIGUE_LABELS[fatigue]
  const mealTimeLabel = getMealTimeLabel(cookingStartTime)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
      <div className="text-center">
        <p className="text-gray-500 text-sm">今日も一日お疲れさまです 🌸</p>
      </div>

      {/* 疲れ度 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-4">今日の疲れ度は？</h2>
        <div className={`text-center mb-3 ${fi.color}`}>
          <span className="text-4xl">{fi.emoji}</span>
          <p className="text-sm font-semibold mt-1">{fi.label}</p>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          value={fatigue}
          onChange={e => setFatigue(Number(e.target.value) as FatigueLevel)}
          className="w-full accent-orange-400"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>元気</span>
          <span>疲れた</span>
        </div>
      </div>

      {/* 料理開始時間 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-3">
          料理できそうな時間は？
          <span className="ml-2 text-sm font-normal text-orange-400">{mealTimeLabel}向けに提案します</span>
        </h2>
        <input
          type="time"
          value={cookingStartTime}
          onChange={e => setCookingStartTime(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>

      {/* 料理に使える時間 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-3">料理に使える時間は？</h2>
        <div className="text-center mb-3">
          <span className="text-2xl font-bold text-orange-500">{cookingMinutes}</span>
          <span className="text-gray-500 ml-1">分</span>
          <p className="text-xs text-gray-400 mt-1">{getCookingMinutesLabel(cookingMinutes)}</p>
        </div>
        <input
          type="range"
          min={0}
          max={90}
          step={5}
          value={cookingMinutes}
          onChange={e => setCookingMinutes(Number(e.target.value))}
          className="w-full accent-orange-400"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0分</span>
          <span>90分</span>
        </div>
      </div>

      {/* 天気 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-700 mb-3">今日のお天気は？</h2>
        <div className="flex gap-3">
          {WEATHER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setWeather(opt.value)}
              className={`flex-1 flex flex-col items-center py-3 rounded-xl border-2 transition-colors ${
                weather === opt.value
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-xs mt-1 text-gray-600">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 今週の実績 */}
      {recentCount > 0 && (
        <div className="bg-orange-100 rounded-2xl p-4 text-sm text-orange-700">
          今週はすでに {recentCount} 回らくごはんを使いました 👏
        </div>
      )}

      {/* 献立を見るボタン */}
      <button
        onClick={handleSubmit}
        className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-4 rounded-2xl text-lg shadow transition-colors"
      >
        今日の献立を見る 🍽️
      </button>
    </div>
  )
}
