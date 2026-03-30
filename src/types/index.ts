export type FatigueLevel = 1 | 2 | 3 | 4 | 5

export type CourseType = 'full' | 'normal' | 'quick' | 'frozen' | 'rest'

export interface MealProposal {
  course: CourseType
  title: string
  description: string
  items: string[]
  estimatedMinutes: number
}

export interface ShoppingItem {
  id: string
  name: string
  checked: boolean
  source: 'proposal' | 'flyer' | 'manual'
}

export interface MealHistory {
  id: string
  date: string // ISO date string
  fatigue: FatigueLevel
  course: CourseType
  menuTitle: string
  savedMinutes: number
}

export interface FlyerItem {
  name: string
  price: number
  unit?: string
  validUntil?: string
}

export interface Settings {
  familySize: number
  allergies: string[]
  favoriteStores: string[]
  walkingDistanceKm: number
}

export interface Supermarket {
  placeId: string
  name: string
  address: string
  distanceText: string
  durationText: string
  isOpen?: boolean
}

export interface SituationInput {
  fatigue: FatigueLevel
  cookingStartTime: string // "HH:MM"
  cookingMinutes: number
  weather: 'sunny' | 'cloudy' | 'rainy'
}
