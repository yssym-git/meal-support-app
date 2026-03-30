// CORS proxy for browser-side fetching of external pages
const CORS_PROXY = 'https://api.allorigins.win/raw?url='

interface StoreInfo {
  patterns: string[]
  domain: string
  rssUrls: string[]
  salePaths: string[]
}

export interface StoreFlyer {
  storeName: string
  items: string[]
}

const KNOWN_STORES: StoreInfo[] = [
  {
    patterns: ['イオン', 'AEON', 'aeon'],
    domain: 'https://www.aeon.com',
    rssUrls: [],
    salePaths: ['/topics/sale/'],
  },
  {
    patterns: ['西友', 'Seiyu', 'seiyu'],
    domain: 'https://www.seiyu.co.jp',
    rssUrls: ['/feed/'],
    salePaths: [],
  },
  {
    patterns: ['マルエツ', 'maruetsu'],
    domain: 'https://www.maruetsu.co.jp',
    rssUrls: [],
    salePaths: ['/sale/'],
  },
  {
    patterns: ['ライフ', 'lifecorp'],
    domain: 'https://www.lifecorp.jp',
    rssUrls: [],
    salePaths: ['/catalog/'],
  },
  {
    patterns: ['サミット', 'summit'],
    domain: 'https://www.summitstore.co.jp',
    rssUrls: [],
    salePaths: ['/topics/'],
  },
  {
    patterns: ['ヨークマート', 'yorkmart'],
    domain: 'https://www.yorkmart.com',
    rssUrls: [],
    salePaths: ['/topics/'],
  },
  {
    patterns: ['ベルク', 'belc'],
    domain: 'https://www.belc.jp',
    rssUrls: [],
    salePaths: ['/topics/'],
  },
  {
    patterns: ['オーケー', 'OKストア'],
    domain: 'https://www.ok-corporation.jp',
    rssUrls: [],
    salePaths: ['/news/'],
  },
  {
    patterns: ['コープ', 'coop'],
    domain: 'https://www.co-op.ne.jp',
    rssUrls: ['/rss/'],
    salePaths: [],
  },
  {
    patterns: ['ドン・キホーテ', 'ドンキ', 'donki'],
    domain: 'https://www.donki.com',
    rssUrls: [],
    salePaths: ['/topics/'],
  },
  {
    patterns: ['業務スーパー', '業務用スーパー', 'gyomu'],
    domain: 'https://www.gyomusuper.jp',
    rssUrls: [],
    salePaths: ['/com/sale/', '/com/topics/'],
  },
  {
    patterns: ['石黒総合食品', '石黒', 'ishiso'],
    domain: 'https://www.ishiso.co.jp',
    rssUrls: [],
    salePaths: ['/sale/', '/topics/', '/news/'],
  },
  {
    patterns: ['リコス', 'RICOS', 'ricos'],
    domain: '',
    rssUrls: [],
    salePaths: [],
  },
]

async function fetchText(url: string): Promise<string> {
  const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Simple robots.txt parser: returns true if the given path is allowed for User-agent: *
async function isAllowedByRobots(domain: string, path: string): Promise<boolean> {
  try {
    const text = await fetchText(`${domain}/robots.txt`)
    const lines = text.split('\n')
    let inAllAgents = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^user-agent:\s*\*/i.test(trimmed)) {
        inAllAgents = true
      } else if (/^user-agent:/i.test(trimmed) && !/\*/i.test(trimmed)) {
        inAllAgents = false
      }
      if (inAllAgents && /^disallow:/i.test(trimmed)) {
        const disallowed = trimmed.replace(/^disallow:\s*/i, '').trim()
        if (disallowed && path.startsWith(disallowed)) return false
      }
    }
    return true
  } catch {
    return false
  }
}

// Extract item titles from RSS/Atom XML
function parseRssItems(xml: string): string[] {
  const titles: string[] = []
  const matches = xml.matchAll(/<title[^>]*>(.*?)<\/title>/gis)
  for (const m of matches) {
    const raw = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
    if (raw && raw.length < 80) titles.push(raw)
  }
  return titles.slice(1, 11)
}

// Extract sale-related keywords from HTML
function extractSaleKeywords(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, '').replace(/\s+/g, ' ')
  const results = new Set<string>()
  const patterns = [
    /[\u3040-\u9FFF]{2,8}[\s　]*\d+円/g,
    /特売[^\n。]{0,20}/g,
    /お買い得[^\n。]{0,20}/g,
    /半額[^\n。]{0,20}/g,
    /目玉商品[^\n。]{0,20}/g,
    /週末限定[^\n。]{0,20}/g,
  ]
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const keyword = m[0].trim()
      if (keyword.length > 2) results.add(keyword)
    }
  }
  return [...results].slice(0, 10)
}

function findStoreInfo(storeName: string): StoreInfo | undefined {
  return KNOWN_STORES.find(info =>
    info.patterns.some(p =>
      storeName.includes(p) || storeName.toLowerCase().includes(p.toLowerCase()),
    ),
  )
}

async function fetchSingleStoreFlyerItems(storeName: string): Promise<string[]> {
  const info = findStoreInfo(storeName)
  if (!info || !info.domain) return []

  for (const rssPath of info.rssUrls) {
    const allowed = await isAllowedByRobots(info.domain, rssPath)
    if (!allowed) continue
    try {
      const xml = await fetchText(`${info.domain}${rssPath}`)
      const items = parseRssItems(xml)
      if (items.length > 0) return items
    } catch {
      // Try next source
    }
  }

  for (const salePath of info.salePaths) {
    const allowed = await isAllowedByRobots(info.domain, salePath)
    if (!allowed) continue
    try {
      const html = await fetchText(`${info.domain}${salePath}`)
      const keywords = extractSaleKeywords(html)
      if (keywords.length > 0) return keywords
    } catch {
      // Try next source
    }
  }

  return []
}

// Returns per-store flyer data (store name + items list)
export async function fetchStoreFlyersByStore(storeNames: string[]): Promise<StoreFlyer[]> {
  if (storeNames.length === 0) return []

  const results = await Promise.allSettled(
    storeNames.map(async name => ({
      storeName: name,
      items: await fetchSingleStoreFlyerItems(name),
    })),
  )

  return results
    .filter((r): r is PromiseFulfilledResult<StoreFlyer> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(s => s.items.length > 0)
}

// Flat list of all items across stores (for backward compatibility)
export async function fetchStoreFlyerItems(storeNames: string[]): Promise<string[]> {
  const byStore = await fetchStoreFlyersByStore(storeNames)
  const all = byStore.flatMap(s => s.items)
  return [...new Set(all)].slice(0, 15)
}
