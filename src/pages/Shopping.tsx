import { useState, useEffect } from 'react'
import { loadShoppingList, saveShoppingList } from '../lib/storage'
import type { ShoppingItem } from '../types'

export default function Shopping() {
  const [items, setItems] = useState<ShoppingItem[]>([])

  useEffect(() => {
    setItems(loadShoppingList())
  }, [])

  function toggle(id: string) {
    const updated = items.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
    setItems(updated)
    saveShoppingList(updated)
  }

  function remove(id: string) {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    saveShoppingList(updated)
  }

  function addItem() {
    const name = prompt('追加する商品名を入力してください')?.trim()
    if (!name) return
    const newItem: ShoppingItem = { id: crypto.randomUUID(), name, checked: false, source: 'manual' }
    const updated = [...items, newItem]
    setItems(updated)
    saveShoppingList(updated)
  }

  function clearChecked() {
    const updated = items.filter(i => !i.checked)
    setItems(updated)
    saveShoppingList(updated)
  }

  function shareToLine() {
    const text = items
      .filter(i => !i.checked)
      .map(i => `□ ${i.name}`)
      .join('\n')
    const encoded = encodeURIComponent(`🛒 買い物リスト\n\n${text}`)
    window.open(`https://line.me/R/msg/text/?${encoded}`, '_blank')
  }

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">買い物リスト 🛒</h2>
        <div className="flex gap-2">
          {checked.length > 0 && (
            <button onClick={clearChecked} className="text-xs text-gray-400 underline">
              完了済みを削除
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">🛒</p>
          <p>まだ買い物リストがありません</p>
          <p className="text-sm mt-1">献立を選ぶと自動で追加されます</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {unchecked.map((item, i) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 ${i < unchecked.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <button
                  onClick={() => toggle(item.id)}
                  className="w-6 h-6 rounded-full border-2 border-orange-400 flex items-center justify-center flex-shrink-0"
                />
                <span className="flex-1 text-gray-800">{item.name}</span>
                <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 text-lg">×</button>
              </div>
            ))}
          </div>

          {checked.length > 0 && (
            <div className="bg-gray-50 rounded-2xl overflow-hidden">
              {checked.map((item, i) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i < checked.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <button
                    onClick={() => toggle(item.id)}
                    className="w-6 h-6 rounded-full bg-orange-400 border-2 border-orange-400 flex items-center justify-center flex-shrink-0"
                  >
                    <span className="text-white text-xs">✓</span>
                  </button>
                  <span className="flex-1 text-gray-400 line-through">{item.name}</span>
                  <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-400 text-lg">×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        onClick={addItem}
        className="w-full border-2 border-dashed border-orange-300 text-orange-400 font-semibold py-3 rounded-2xl hover:bg-orange-50 transition-colors"
      >
        + 手動で追加
      </button>

      {unchecked.length > 0 && (
        <button
          onClick={shareToLine}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">💬</span> LINEでシェア
        </button>
      )}
    </div>
  )
}
