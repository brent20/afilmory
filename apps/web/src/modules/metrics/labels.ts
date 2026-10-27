import { formatHour, formatHourShort } from '~/lib/metrics'

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => formatHourShort(h))
export const HOUR_TITLES = Array.from({ length: 24 }, (_, h) => formatHour(h))
