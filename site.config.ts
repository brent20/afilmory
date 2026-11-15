import { merge } from 'es-toolkit/compat'

import userConfig from './config.json'

export interface SiteConfig {
  name: string
  title: string
  description: string
  url: string
  accentColor: string
  viewer?: ViewerConfig
  author: Author
  social?: Social
  feed?: Feed
  map?: MapConfig
  mapStyle?: string
  mapProjection?: 'globe' | 'mercator'
  telemetry?: {
    vibeloft?: boolean
  }
}

/**
 * Map configuration - can be either:
 * - A string for a single provider: 'maplibre'
 * - An array for multiple providers in priority order: ['maplibre']
 */
type MapConfig = 'maplibre'[]

interface Feed {
  folo?: {
    challenge?: {
      feedId: string
      userId: string
    }
  }
}
interface Author {
  name: string
  url: string
  avatar?: string
}
interface Social {
  twitter?: string
  github?: string
  /** Full URL for the "Contact" header link. Falls back to author.url when empty. */
  contact?: string
  /** Full URL for the "Usage info" header link. Falls back to author.url when empty. */
  usage?: string
}

interface ViewerConfig {
  regions?: {
    accentSource?: 'system' | 'photo'
    labelPlacement?: 'edge' | 'floating'
  }
}

const defaultConfig: SiteConfig = {
  name: 'New Afilmory',
  title: 'New Afilmory',
  description: 'A modern photo gallery website.',
  url: 'https://afilmory.art',
  accentColor: '#007bff',
  viewer: {
    regions: {
      accentSource: 'system',
      labelPlacement: 'edge',
    },
  },
  author: {
    name: 'Afilmory',
    url: 'https://afilmory.art/',
    avatar: 'https://cdn.jsdelivr.net/gh/Afilmory/Afilmory@main/logo.jpg',
  }
}
export const siteConfig = merge(defaultConfig, userConfig) as SiteConfig

export default siteConfig
