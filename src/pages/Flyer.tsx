import { useState, useRef } from 'react'
import { extractFlyerItems } from '../lib/claude'
import { fetchStoreFlyersByStore } from '../lib/autoFlyer'
import type { StoreFlyer } from '../lib/autoFlyer'
import type { FlyerItem } from '../types'
import { loadSettings } from '../lib/storage'

type Tab = 'scan' | 'stores'

export default function Flyer() {
  const [tab, setTab] = useState<Tab>('scan')

  // --- Scan tab state ---
  const [preview, setPreview] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [items, setItems] = useState<FlyerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // --- Store flyers tab state ---
  const [storeFlyers, setStoreFlyers] = useState<StoreFlyer[]>([])
  const [storeLoading, setStoreLoading] = useState(false)
  const [storeError, setStoreError] = useState('')
  const [storeFetched, setStoreFetched] = useState(false)

  function handleFile(file: File) {
    const mime = file.type || 'image/jpeg'
    setMimeType(mime)
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setItems([])
      setDone(false)
    }
    reader.readAsDataURL(file)
  }

  async function analyze() {
    if (!preview) return
    setLoading(true)
    setError('')
    try {
      const base64 = preview.split(',')[1]
      const extracted = await extractFlyerItems(base64, mimeType)
      setItems(extracted)
      setDone(true)
      sessionStorage.setItem('flyerItems', JSON.stringify(extracted.map(i => i.name)))
    } catch {
      setError('読み取りに失敗しました。別の画像を試してください。')
    } finally {
      setLoading(false)
    }
  }

  async function fetchStoreFlyers() {
    const settings = loadSettings()
    if (settings.favoriteStores.length === 0) {
      setStoreError('設定画面でよく行くスーパーを登録してください。')
      return
    }
    setStoreLoading(true)
    setStoreError('')
    try {
      const results = await fetchStoreFlyersByStore(settings.favoriteStores)
      setStoreFlyers(results)
      setStoreFetched(true)
      if (results.length === 0) {
        setStoreError('取得できた特売情報がありませんでした。robots.txtにより非公開の可能性があります。')
      }
    } catch {
      setStoreError('チラシ情報の取得に失敗しました。')
    } finally {
      setStoreLoading(false)
    }
  }

  function handleTabChange(t: Tab) {
    setTab(t)
    if (t === 'stores' && !storeFetched && !storeLoading) {
      fetchStoreFlyers()
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-800">チラシ 📋</h2>
      </div>

      {/* タブ */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => handleTabChange('scan')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'scan' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
          }`}
        >
          📷 チラシ読み取り
        </button>
        <button
          onClick={() => handleTabChange('stores')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'stores' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'
          }`}
        >
          🏪 周辺店舗チラシ
        </button>
      </div>

      {/* チラシ読み取りタブ */}
      {tab === 'scan' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">特売品を撮影すると献立・買い物リストに活用します</p>

          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-orange-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-orange-50 transition-colors"
          >
            {preview ? (
              <img src={preview} alt="チラシプレビュー" className="max-h-48 mx-auto rounded-xl object-contain" />
            ) : (
              <>
                <p className="text-4xl mb-2">📸</p>
                <p className="text-gray-500">タップして写真を選択</p>
                <p className="text-xs text-gray-400 mt-1">カメラまたはギャラリーから</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {preview && !done && (
            <button
              onClick={analyze}
              disabled={loading}
              className="w-full bg-orange-400 hover:bg-orange-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  読み取り中...
                </>
              ) : (
                '読み取り開始 🔍'
              )}
            </button>
          )}

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {items.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="font-bold text-gray-700">抽出結果 ({items.length}件)</span>
                <span className="text-xs text-green-500 font-semibold">✓ 献立提案に連動済み</span>
              </div>
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 ${i < items.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <span className="text-gray-800">{item.name}</span>
                  <div className="text-right">
                    <span className="font-bold text-orange-500">¥{item.price}</span>
                    {item.unit && <span className="text-xs text-gray-400 ml-1">/{item.unit}</span>}
                    {item.validUntil && (
                      <p className="text-xs text-gray-400">{item.validUntil}まで</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {done && (
            <p className="text-center text-sm text-gray-500">
              ホームから「今日の献立を見る」を押すと<br />特売品を考慮した献立を提案します 🎉
            </p>
          )}
        </div>
      )}

      {/* 周辺店舗チラシタブ */}
      {tab === 'stores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">設定済みの店舗から特売情報を自動取得します</p>
            <button
              onClick={fetchStoreFlyers}
              disabled={storeLoading}
              className="text-xs text-orange-500 font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {storeLoading ? (
                <div className="w-3 h-3 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
              ) : '↻'} 更新
            </button>
          </div>

          {storeLoading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-8 h-8 border-4 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">robots.txtを確認しながら取得中...</p>
            </div>
          )}

          {storeError && !storeLoading && (
            <p className="text-sm text-red-500 text-center">{storeError}</p>
          )}

          {!storeLoading && storeFlyers.length > 0 && (
            <div className="space-y-3">
              {storeFlyers.map(store => (
                <div key={store.storeName} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
                    <span className="text-lg">🏪</span>
                    <span className="font-bold text-gray-800">{store.storeName}</span>
                    <span className="ml-auto text-xs text-gray-400">{store.items.length}件</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {store.items.map((item, i) => (
                      <li key={i} className="px-4 py-2.5 text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-orange-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-center text-gray-400">
                ホームから献立を見るとチラシ活用コースに自動反映されます
              </p>
            </div>
          )}

          {!storeLoading && storeFetched && storeFlyers.length === 0 && !storeError && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">取得できた特売情報がありませんでした</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
