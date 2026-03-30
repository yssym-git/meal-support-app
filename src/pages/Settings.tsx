import { useState, useEffect } from 'react'
import { loadSettings, saveSettings } from '../lib/storage'
import type { Settings, Supermarket } from '../types'

type PlaceResult = {
  place_id: string
  name: string
  vicinity: string
  geometry: { location: { lat: number; lng: number } }
  opening_hours?: { open_now?: boolean }
}

async function searchPlaces(lat: number, lng: number, radius: number, apiKey: string, keyword?: string): Promise<PlaceResult[]> {
  const base = `/maps-api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&language=ja&key=${apiKey}`
  const url = keyword ? `${base}&keyword=${encodeURIComponent(keyword)}` : `${base}&type=supermarket`
  const res = await fetch(url)
  const data = await res.json()
  return data.results ?? []
}

async function fetchNearbyStores(lat: number, lng: number, radiusKm: number): Promise<Supermarket[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return []

  const radius = radiusKm * 1000

  // Run generic supermarket search + keyword searches for specific chains in parallel
  const specificKeywords = ['業務スーパー', 'リコス', '石黒総合食品']
  const [genericResults, ...keywordResults] = await Promise.all([
    searchPlaces(lat, lng, radius, apiKey),
    ...specificKeywords.map(kw => searchPlaces(lat, lng, radius, apiKey, kw)),
  ])

  // Merge and deduplicate by place_id
  const seen = new Set<string>()
  const merged: PlaceResult[] = []
  for (const place of [...genericResults, ...keywordResults.flat()]) {
    if (!seen.has(place.place_id)) {
      seen.add(place.place_id)
      merged.push(place)
    }
  }

  const top = merged.slice(0, 10)
  if (top.length === 0) return []

  const origins = `${lat},${lng}`
  const destinations = top
    .map(p => `${p.geometry.location.lat},${p.geometry.location.lng}`)
    .join('|')

  const matrixUrl =
    `/maps-api/distancematrix/json` +
    `?origins=${origins}&destinations=${destinations}&mode=walking&language=ja&key=${apiKey}`
  const matrixRes = await fetch(matrixUrl)
  const matrix = await matrixRes.json()

  return top.map((p, i) => ({
    placeId: p.place_id,
    name: p.name,
    address: p.vicinity,
    distanceText: matrix.rows?.[0]?.elements?.[i]?.distance?.text ?? '不明',
    durationText: matrix.rows?.[0]?.elements?.[i]?.duration?.text ?? '不明',
    isOpen: p.opening_hours?.open_now,
  }))
}

export default function Settings() {
  const [settings, setSettings] = useState<Settings>(loadSettings())
  const [saved, setSaved] = useState(false)
  const [allergyInput, setAllergyInput] = useState('')
  const [storeInput, setStoreInput] = useState('')
  const [stores, setStores] = useState<Supermarket[]>([])
  const [storeLoading, setStoreLoading] = useState(false)
  const [storeError, setStoreError] = useState('')

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  function handleSave() {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addAllergy() {
    const v = allergyInput.trim()
    if (!v || settings.allergies.includes(v)) return
    setSettings(s => ({ ...s, allergies: [...s.allergies, v] }))
    setAllergyInput('')
  }

  function removeAllergy(a: string) {
    setSettings(s => ({ ...s, allergies: s.allergies.filter(x => x !== a) }))
  }

  function addStore() {
    const v = storeInput.trim()
    if (!v || settings.favoriteStores.includes(v)) return
    setSettings(s => ({ ...s, favoriteStores: [...s.favoriteStores, v] }))
    setStoreInput('')
  }

  function removeStore(st: string) {
    setSettings(s => ({ ...s, favoriteStores: s.favoriteStores.filter(x => x !== st) }))
  }

  function findNearbyStores() {
    if (!navigator.geolocation) {
      setStoreError('このブラウザはGeolocationに対応していません')
      return
    }
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setStoreError('.envにVITE_GOOGLE_MAPS_API_KEYを設定してください')
      return
    }
    setStoreLoading(true)
    setStoreError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const results = await fetchNearbyStores(
            pos.coords.latitude,
            pos.coords.longitude,
            settings.walkingDistanceKm,
          )
          setStores(results)
          if (results.length === 0) setStoreError('近くにスーパーが見つかりませんでした')
        } catch {
          setStoreError('スーパーの取得に失敗しました')
        } finally {
          setStoreLoading(false)
        }
      },
      () => {
        setStoreError('位置情報の取得が許可されていません')
        setStoreLoading(false)
      },
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      <h2 className="text-xl font-bold text-gray-800">設定 ⚙️</h2>

      {/* 家族人数 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">家族の人数</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSettings(s => ({ ...s, familySize: Math.max(1, s.familySize - 1) }))}
            className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 text-xl font-bold"
          >
            −
          </button>
          <span className="text-2xl font-bold text-gray-800 w-8 text-center">{settings.familySize}</span>
          <button
            onClick={() => setSettings(s => ({ ...s, familySize: Math.min(10, s.familySize + 1) }))}
            className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 text-xl font-bold"
          >
            ＋
          </button>
          <span className="text-gray-500">人</span>
        </div>
      </div>

      {/* アレルギー */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">アレルギー・食べられないもの</h3>
        <div className="flex gap-2">
          <input
            value={allergyInput}
            onChange={e => setAllergyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAllergy()}
            placeholder="例: えび、そば"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button onClick={addAllergy} className="bg-orange-400 text-white px-4 rounded-xl text-sm font-bold">
            追加
          </button>
        </div>
        {settings.allergies.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {settings.allergies.map(a => (
              <span
                key={a}
                className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full flex items-center gap-1"
              >
                {a}
                <button onClick={() => removeAllergy(a)} className="hover:text-red-800">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* よく行くスーパー */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">よく行くスーパー</h3>
        <div className="flex gap-2">
          <input
            value={storeInput}
            onChange={e => setStoreInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStore()}
            placeholder="例: イオン、西友"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <button onClick={addStore} className="bg-orange-400 text-white px-4 rounded-xl text-sm font-bold">
            追加
          </button>
        </div>
        {settings.favoriteStores.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {settings.favoriteStores.map(st => (
              <span
                key={st}
                className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full flex items-center gap-1"
              >
                {st}
                <button onClick={() => removeStore(st)} className="hover:text-orange-900">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 徒歩圏内距離 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">徒歩圏内の距離</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.5}
            value={settings.walkingDistanceKm}
            onChange={e => setSettings(s => ({ ...s, walkingDistanceKm: Number(e.target.value) }))}
            className="flex-1 accent-orange-400"
          />
          <span className="text-gray-700 font-bold w-16">{settings.walkingDistanceKm} km</span>
        </div>
      </div>

      {/* 周辺スーパー表示 */}
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-700">周辺のスーパー 📍</h3>
        <button
          onClick={findNearbyStores}
          disabled={storeLoading}
          className="w-full border-2 border-orange-300 text-orange-500 font-bold py-2 rounded-xl hover:bg-orange-50 transition-colors disabled:opacity-50"
        >
          {storeLoading ? '取得中...' : '現在地から探す'}
        </button>
        {storeError && <p className="text-sm text-red-500">{storeError}</p>}
        {stores.length > 0 && (
          <div className="space-y-2">
            {stores.map(s => (
              <div key={s.placeId} className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl">
                <span className="text-lg mt-0.5">🏪</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate">{s.address}</p>
                  <p className="text-xs text-orange-600 mt-0.5">
                    🚶 {s.durationText}（{s.distanceText}）
                  </p>
                </div>
                {s.isOpen !== undefined && (
                  <span className={`text-xs font-bold ${s.isOpen ? 'text-green-500' : 'text-gray-400'}`}>
                    {s.isOpen ? '営業中' : '閉店中'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <button
        onClick={handleSave}
        className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-4 rounded-2xl transition-colors"
      >
        {saved ? '保存しました ✓' : '設定を保存する'}
      </button>
    </div>
  )
}
