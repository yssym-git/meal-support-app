import type { MealHistory, Settings, ShoppingItem } from '../types'

const KEYS = {
  history: 'meal-history',
  settings: 'meal-settings',
  shopping: 'shopping-list',
  flyerItems: 'flyer-items',
} as const

// --- Settings ---
export const defaultSettings: Settings = {
  familySize: 2,
  allergies: [],
  favoriteStores: [],
  walkingDistanceKm: 1,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}

// --- History ---
export function loadHistory(): MealHistory[] {
  try {
    const raw = localStorage.getItem(KEYS.history)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addHistory(entry: MealHistory): void {
  const history = loadHistory()
  history.unshift(entry)
  // 最大90件保持
  localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 90)))
}

export function getRecentMenuTitles(days = 7): string[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return loadHistory()
    .filter(h => new Date(h.date).getTime() > cutoff)
    .map(h => h.menuTitle)
}

export function getWeeklyStats() {
  const now = Date.now()
  const thisWeek = loadHistory().filter(
    h => now - new Date(h.date).getTime() < 7 * 24 * 60 * 60 * 1000,
  )
  const lastWeek = loadHistory().filter(h => {
    const age = now - new Date(h.date).getTime()
    return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000
  })
  const quickOrRestRate = (list: MealHistory[]) =>
    list.length === 0
      ? 0
      : list.filter(h => h.course !== 'full').length / list.length
  return {
    thisWeekRate: quickOrRestRate(thisWeek),
    lastWeekRate: quickOrRestRate(lastWeek),
    totalSavedMinutes: thisWeek.reduce((s, h) => s + h.savedMinutes, 0),
    count: thisWeek.length,
  }
}

// --- Shopping ---
export function loadShoppingList(): ShoppingItem[] {
  try {
    const raw = localStorage.getItem(KEYS.shopping)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveShoppingList(items: ShoppingItem[]): void {
  localStorage.setItem(KEYS.shopping, JSON.stringify(items))
}
