export const formatInt = (value: number): string => Math.round(value).toLocaleString('en-US')

export const formatPercent = (value: number | null): string => (value === null ? '—' : `${Math.round(value * 100)}%`)

/** 3 hr 12 min, 45 min, 2 days 4 hr */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours ? `${days} ${days === 1 ? 'day' : 'days'} ${restHours} hr` : `${days} ${days === 1 ? 'day' : 'days'}`
}

export const formatMiles = (miles: number): string => `${formatInt(miles)} miles`

export const formatFeet = (feet: number): string => `${formatInt(feet)} ft`

export const photoHref = (id: string): string => `/photos/${id}`

export const cameraHref = (filter: string): string => `/?cameras=${encodeURIComponent(filter)}`

export const lensHref = (filter: string): string => `/?lenses=${encodeURIComponent(filter)}`
