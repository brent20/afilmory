import { clsxm } from '@afilmory/utils'
import type { ReactNode } from 'react'

import {
  CarbonIsoOutline,
  FocalLengthIcon,
  LensElementIcon,
  MaterialSymbolsExposure,
  MaterialSymbolsShutterSpeed,
  TablerAperture,
} from '~/icons'

/**
 * The same glyphs the photo inspector uses for each setting, so a setting looks the same
 * on the metrics page as it does in the EXIF panel (see `modules/metadata/ExifPanel.tsx`).
 *
 * Keep the `i-mingcute-*` class names as full literals so the icon plugin can find them.
 */
const RENDERERS = {
  aperture: (c: string) => <TablerAperture className={c} aria-hidden="true" />,
  shutter: (c: string) => <MaterialSymbolsShutterSpeed className={c} aria-hidden="true" />,
  iso: (c: string) => <CarbonIsoOutline className={c} aria-hidden="true" />,
  focal: (c: string) => <FocalLengthIcon className={c} aria-hidden="true" />,
  exposure: (c: string) => <MaterialSymbolsExposure className={c} aria-hidden="true" />,
  lens: (c: string) => <LensElementIcon className={c} aria-hidden="true" />,
  focalEquiv: (c: string) => <i className={`i-mingcute-fullscreen-line ${c}`} aria-hidden="true" />,
  camera: (c: string) => <i className={`i-mingcute-camera-line ${c}`} aria-hidden="true" />,
  program: (c: string) => <i className={`i-mingcute-settings-3-line ${c}`} aria-hidden="true" />,
  flash: (c: string) => <i className={`i-mingcute-flash-line ${c}`} aria-hidden="true" />,
  sun: (c: string) => <i className={`i-mingcute-sun-line ${c}`} aria-hidden="true" />,
  time: (c: string) => <i className={`i-mingcute-time-line ${c}`} aria-hidden="true" />,
  place: (c: string) => <i className={`i-mingcute-location-line ${c}`} aria-hidden="true" />,
  latitude: (c: string) => <i className={`i-mingcute-earth-latitude-line ${c}`} aria-hidden="true" />,
  altitude: (c: string) => <i className={`i-mingcute-mountain-2-line ${c}`} aria-hidden="true" />,
  frame: (c: string) => <i className={`i-mingcute-frame-line ${c}`} aria-hidden="true" />,
} satisfies Record<string, (className: string) => ReactNode>

export type MetricIconName = keyof typeof RENDERERS

export const MetricIcon = ({ name, className }: { name: MetricIconName, className?: string }) =>
  RENDERERS[name](clsxm('shrink-0', className))
