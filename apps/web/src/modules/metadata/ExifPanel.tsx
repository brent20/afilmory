import '~/modules/viewer/PhotoViewer.css'

import type { PhotoManifestItem, PickedExif } from '@afilmory/builder'
import { MotionButtonBase, ScrollArea } from '@afilmory/ui'
import { clsxm, Spring } from '@afilmory/utils'
import { useAtomValue } from 'jotai'
import { m } from 'motion/react'
import type { FC, ReactNode } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { isExiftoolLoadedAtom } from '~/atoms/app'
import { siteConfig } from '~/config'
import { useMobile } from '~/hooks/useMobile'
import {
  CarbonIsoOutline,
  FocalLengthIcon,
  LensElementIcon,
  MaterialSymbolsExposure,
  MaterialSymbolsShutterSpeed,
  TablerAperture,
} from '~/icons'
import { convertExifGPSToDecimal } from '~/lib/map-utils'
import { getRenderablePhotoRegions } from '~/modules/viewer/photo-region-bounds'

import { ExifRowGroup, ExifSection } from './ExifSection'
import { formatExifData, Row } from './formatExifData'
import { HistogramChart } from './HistogramChart'
import { MiniMap } from './MiniMap'
import { PhotoRegionsSection } from './PhotoRegionsSection'
import { RawExifViewer } from './RawExifViewer'

/**
 * Same layout as `Row`, but the value is a link.
 *
 * Affordance is deliberately quiet: a dotted underline and a faint arrow at rest.
 * On hover the text stays full-contrast (no accent-coloured text, which is hard to
 * read on the dark glass panel); the accent shows up as a soft wash behind it instead.
 *
 * `sameTab` keeps the link in the current tab (used for the in-site camera/lens filters
 * on mobile, where a new tab per tap piles up quickly).
 */
const LinkRow: FC<{
  label: string
  value: string
  href: string
  title?: string
  icon?: ReactNode
  sameTab?: boolean
}> = ({ label, value, href, title, icon, sameTab = false }) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-text-secondary flex shrink-0 items-center gap-1.5">
      {icon}
      {label}
    </span>
    <a
      href={href}
      {...(sameTab ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
      title={title}
      className="group text-text hover:bg-accent/15 focus-visible:bg-accent/15 -my-0.5 -mr-1.5 inline-flex min-w-0 items-center justify-end gap-1 rounded-md px-1.5 py-0.5 text-right underline decoration-white/40 decoration-dotted underline-offset-4 transition-colors duration-200 hover:decoration-white hover:decoration-solid focus-visible:decoration-white focus-visible:decoration-solid"
    >
      <span className="min-w-0">{value}</span>
      <i className="i-mingcute-arrow-right-up-line shrink-0 text-xs opacity-40 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
    </a>
  </div>
)

const rowIconClassName = 'shrink-0 text-sm text-white/70'

// Row icons. Same method as the camera row: an `i-mingcute-*` class + `rowIconClassName`.
// (Keep the class names as full literals so the icon plugin can find them.)
const icons = {
  time: <i className={`i-mingcute-time-line ${rowIconClassName}`} />,
  copyright: <i className={`i-mingcute-copyright-line ${rowIconClassName}`} />,
  camera: <i className={`i-mingcute-camera-line ${rowIconClassName}`} />,
  equivalentFocalLength: <i className={`i-mingcute-fullscreen-line ${rowIconClassName}`} />,
  exposureProgram: <i className={`i-mingcute-settings-3-line ${rowIconClassName}`} />,
  meteringMode: <i className={`i-mingcute-aiming-2-line ${rowIconClassName}`} />,
  whiteBalance: <i className={`i-mingcute-sun-line ${rowIconClassName}`} />,
  flash: <i className={`i-mingcute-flash-line ${rowIconClassName}`} />,
  latitude: <i className={`i-mingcute-earth-latitude-line ${rowIconClassName}`} />,
  longitude: <i className={`i-mingcute-earth-longitude-line ${rowIconClassName}`} />,
  altitude: <i className={`i-mingcute-mountain-2-line ${rowIconClassName}`} />,
  city: <i className={`i-mingcute-location-line ${rowIconClassName}`} />,
}

const captureChipClassName = 'border-accent/20 bg-accent/10 flex h-6 items-center gap-2 rounded-md border px-2'

// Capture Mode rows are treated as noise when they show the camera's normal behaviour,
// so they only appear when the value is different. Matched against the raw EXIF strings.
const DEFAULT_METERING_MODE = /multi|pattern|matrix|evaluative/i
const DEFAULT_WHITE_BALANCE = /^auto/i
const FLASH_DID_NOT_FIRE = /no flash|did not fire|not fired|^off$|^disabled$/i

// A camera reporting an equivalent focal length within this ratio of the real one is
// treated as full frame (no crop factor), so the 35mm-equivalent row is hidden.
const FULL_FRAME_TOLERANCE = 0.03

// GPS is shown rounded: 2 decimals is roughly 1 km. Change this to 3 for roughly 100 m.
const GPS_DECIMALS = 2
const roundCoordinate = (value: number) => Number(value.toFixed(GPS_DECIMALS))
const formatCoordinate = (value: number, ref: string) => `${Math.abs(value).toFixed(GPS_DECIMALS)}° ${ref}`

interface ExifPanelBaseProps {
  currentPhoto: PhotoManifestItem
  exifData: PickedExif | null
  activeRegionId?: string | null
  onActiveRegionChange?: (regionId: string | null) => void
}

interface ExifPanelProps extends ExifPanelBaseProps {
  onClose?: () => void
  visible?: boolean
}

export const ExifPanel: FC<ExifPanelProps> = ({
  currentPhoto,
  exifData,
  activeRegionId,
  onActiveRegionChange,
  onClose,
  visible = true,
}) => {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const isExiftoolLoaded = useAtomValue(isExiftoolLoadedAtom)

  return (
    <m.div
      className={`${
        isMobile
          ? 'exif-panel-mobile fixed right-0 bottom-0 left-0 z-10 max-h-[60vh] w-full rounded-t-2xl backdrop-blur-2xl'
          : 'relative w-80 shrink-0 backdrop-blur-2xl'
      } border-accent/20 flex flex-col text-white`}
      initial={{
        opacity: 0,
        ...(isMobile ? { y: 100 } : { x: 100 }),
      }}
      animate={{
        opacity: visible ? 1 : 0,
        ...(isMobile ? { y: visible ? 0 : 100 } : { x: visible ? 0 : 100 }),
      }}
      exit={{
        opacity: 0,
        ...(isMobile ? { y: 100 } : { x: 100 }),
      }}
      transition={Spring.presets.smooth}
      style={{
        pointerEvents: visible ? 'auto' : 'none',
        backgroundImage:
          'linear-gradient(to bottom right, rgba(var(--color-materialMedium)), rgba(var(--color-materialThick)), transparent)',
        boxShadow:
          '0 8px 32px color-mix(in srgb, var(--color-accent) 8%, transparent), 0 4px 16px color-mix(in srgb, var(--color-accent) 6%, transparent), 0 2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Inner glow layer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom right, color-mix(in srgb, var(--color-accent) 5%, transparent), transparent, color-mix(in srgb, var(--color-accent) 5%, transparent))',
        }}
      />
      <div className="relative z-10 mb-4 flex shrink-0 items-center justify-between p-4 pb-0">
        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold`}>{t('exif.header.title')}</h3>
        {!isMobile && isExiftoolLoaded && <RawExifViewer currentPhoto={currentPhoto} />}
        {isMobile && onClose && (
          <button
            type="button"
            className="glassmorphic-btn border-accent/20 flex size-6 items-center justify-center rounded-full border text-white/70 duration-200 hover:text-white"
            onClick={onClose}
          >
            <i className="i-mingcute-close-line text-sm" />
          </button>
        )}
      </div>

      <ExifPanelContent
        currentPhoto={currentPhoto}
        exifData={exifData}
        activeRegionId={activeRegionId}
        onActiveRegionChange={onActiveRegionChange}
      />
    </m.div>
  )
}

interface ExifPanelContentProps extends ExifPanelBaseProps {
  onTagClick?: (tag: string) => void
  rootClassName?: string
  viewportClassName?: string
}

export const ExifPanelContent: FC<ExifPanelContentProps> = ({
  currentPhoto,
  exifData,
  activeRegionId,
  onActiveRegionChange,
  onTagClick,
  rootClassName = 'flex-1 min-h-0 overflow-auto lg:overflow-hidden',
  viewportClassName = 'px-4 pb-4 **:select-text',
}) => {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const formattedExifData = useMemo(() => formatExifData(exifData), [exifData])
  const gpsData = useMemo(() => convertExifGPSToDecimal(exifData), [exifData])

  // Rounded copies for display and for the mini map, so the exact spot isn't shown.
  const displayLatitude = gpsData ? roundCoordinate(gpsData.latitude) : null
  const displayLongitude = gpsData ? roundCoordinate(gpsData.longitude) : null

  const regions = useMemo(
    () =>
      getRenderablePhotoRegions(
        currentPhoto.regions ?? [],
        currentPhoto.width,
        currentPhoto.height,
        currentPhoto.exif?.Orientation,
        currentPhoto.exif?.RegionInfo,
      ),
    [currentPhoto],
  )

  // These must match how the gallery filter names cameras and lenses (see usePhotoViewer.ts).
  const cameraFilterName = useMemo(() => {
    const exif = currentPhoto.exif ?? exifData
    if (!exif?.Make || !exif?.Model) return null
    return `${exif.Make.trim()} ${exif.Model.trim()}`
  }, [currentPhoto.exif, exifData])

  const lensFilterName = useMemo(() => {
    const exif = currentPhoto.exif ?? exifData
    if (!exif?.LensModel) return null
    const lensModel = exif.LensModel.trim()
    const lensMake = exif.LensMake?.trim()
    return lensMake ? `${lensMake} ${lensModel}` : lensModel
  }, [currentPhoto.exif, exifData])

  // Copyright links to the "usage" page from the site config (social.usage in config.json).
  const usageUrl = (() => {
    const url = siteConfig.social?.usage?.trim()
    return url && /^https?:\/\//i.test(url) ? url : null
  })()

  const handleTagClick = useCallback(
    (tag: string) => {
      if (onTagClick) {
        onTagClick(tag)
        return
      }
      window.open(`/?tags=${encodeURIComponent(tag)}`, '_blank', 'noopener,noreferrer')
    },
    [onTagClick],
  )

  const fx = formattedExifData

  // Exposure chips (aperture / shutter / ISO / EV) sit at the top of the panel.
  const showCaptureParameters = !!fx && !!(fx.aperture || fx.shutterSpeed || fx.iso || fx.exposureBias)

  // 35mm equivalent only matters when the sensor isn't full frame.
  const showEquivalentFocalLength = (() => {
    const equivalent = fx?.focalLength35mm
    const actual = fx?.focalLength
    if (!equivalent || !actual) return false
    return Math.abs(equivalent / actual - 1) > FULL_FRAME_TOLERANCE
  })()

  // Capture Mode rows: the exposure program always shows; the rest only when not the default.
  const showMeteringMode = !!fx?.meteringMode && !DEFAULT_METERING_MODE.test(String(exifData?.MeteringMode ?? ''))
  const showWhiteBalance = !!fx?.whiteBalance && !DEFAULT_WHITE_BALANCE.test(String(exifData?.WhiteBalance ?? ''))
  const showFlash = !!fx?.flash && !FLASH_DID_NOT_FIRE.test(String(exifData?.Flash ?? ''))
  const showCaptureMode = !!fx?.exposureProgram || showMeteringMode || showWhiteBalance || showFlash

  return (
    <ScrollArea mask rootClassName={rootClassName} viewportClassName={viewportClassName}>
      <div className={clsxm('flex flex-col', isMobile ? 'gap-3' : 'gap-4')}>
        {showCaptureParameters && fx && (
          <ExifSection title={t('exif.capture.parameters')}>
            <div className="grid grid-cols-2 gap-2">
              {fx.aperture && (
                <div className={captureChipClassName}>
                  <TablerAperture className="text-sm text-white/70" />
                  <span className="text-xs">{fx.aperture}</span>
                </div>
              )}

              {fx.shutterSpeed && (
                <div className={captureChipClassName}>
                  <MaterialSymbolsShutterSpeed className="text-sm text-white/70" />
                  <span className="text-xs">{fx.shutterSpeed}</span>
                </div>
              )}

              {fx.iso && (
                <div className={captureChipClassName}>
                  <CarbonIsoOutline className="text-sm text-white/70" />
                  <span className="text-xs">ISO {fx.iso}</span>
                </div>
              )}

              {fx.exposureBias && (
                <div className={captureChipClassName}>
                  <MaterialSymbolsExposure className="text-sm text-white/70" />
                  <span className="text-xs">{fx.exposureBias}</span>
                </div>
              )}
            </div>
          </ExifSection>
        )}

        {fx && (fx.dateTime || fx.copyright) && (
          <ExifSection title={t('exif.basic.info')}>
            <ExifRowGroup>
              {fx.dateTime && <Row icon={icons.time} label={t('exif.capture.time')} value={fx.dateTime} />}
              {fx.copyright &&
                (usageUrl ? (
                  <LinkRow
                    icon={icons.copyright}
                    label={t('exif.copyright')}
                    value={fx.copyright}
                    href={usageUrl}
                    title="Photo usage and licensing"
                  />
                ) : (
                  <Row icon={icons.copyright} label={t('exif.copyright')} value={fx.copyright} />
                ))}
            </ExifRowGroup>
          </ExifSection>
        )}

        {fx && (fx.camera || fx.lens || fx.focalLength) && (
          <ExifSection title={t('exif.device.info')}>
            <ExifRowGroup>
              {fx.camera &&
                (cameraFilterName ? (
                  <LinkRow
                    icon={icons.camera}
                    label={t('exif.camera')}
                    value={fx.camera}
                    href={`/?cameras=${encodeURIComponent(cameraFilterName)}`}
                    title="Show all photos taken with this camera"
                    sameTab={isMobile}
                  />
                ) : (
                  <Row icon={icons.camera} label={t('exif.camera')} value={fx.camera} />
                ))}
              {fx.lens &&
                (lensFilterName ? (
                  <LinkRow
                    icon={<LensElementIcon className={rowIconClassName} />}
                    label={t('exif.lens')}
                    value={fx.lens}
                    href={`/?lenses=${encodeURIComponent(lensFilterName)}`}
                    title="Show all photos taken with this lens"
                    sameTab={isMobile}
                  />
                ) : (
                  <Row icon={<LensElementIcon className={rowIconClassName} />} label={t('exif.lens')} value={fx.lens} />
                ))}
              {fx.focalLength && (
                <Row
                  icon={<FocalLengthIcon className={rowIconClassName} />}
                  label={t('exif.focal.length.actual')}
                  value={`${fx.focalLength}mm`}
                />
              )}
              {showEquivalentFocalLength && (
                <Row
                  icon={icons.equivalentFocalLength}
                  label={t('exif.focal.length.equivalent')}
                  value={`${fx.focalLength35mm}mm`}
                />
              )}
            </ExifRowGroup>
          </ExifSection>
        )}

        {showCaptureMode && fx && (
          <ExifSection title={t('exif.capture.mode')}>
            <ExifRowGroup>
              {fx.exposureProgram && (
                <Row icon={icons.exposureProgram} label={t('exif.exposureprogram.title')} value={fx.exposureProgram} />
              )}
              {showMeteringMode && (
                <Row icon={icons.meteringMode} label={t('exif.metering.mode.type')} value={fx.meteringMode} />
              )}
              {showWhiteBalance && (
                <Row icon={icons.whiteBalance} label={t('exif.white.balance.title')} value={fx.whiteBalance} />
              )}
              {showFlash && <Row icon={icons.flash} label={t('exif.flash.title')} value={fx.flash} />}
            </ExifRowGroup>
          </ExifSection>
        )}

        <PhotoRegionsSection
          regions={regions}
          activeRegionId={activeRegionId}
          onActiveRegionChange={onActiveRegionChange}
        />

        {currentPhoto.tags && currentPhoto.tags.length > 0 && (
          <ExifSection title={t('exif.tags')}>
            <div className="flex flex-wrap gap-1.5">
              {currentPhoto.tags.map(tag => (
                <MotionButtonBase
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  key={tag}
                  className="glassmorphic-btn border-accent/20 bg-accent/10 inline-flex cursor-pointer items-center rounded-full border px-2 py-1 text-xs text-white/90 backdrop-blur-sm"
                >
                  {tag}
                </MotionButtonBase>
              ))}
            </div>
          </ExifSection>
        )}

        {currentPhoto.toneAnalysis && (
          <ExifSection title={t('exif.tone.analysis.title')}>
            <ExifRowGroup>
              <Row
                label={t('exif.tone.type')}
                value={(() => {
                  const toneTypeMap = {
                    'low-key': t('exif.tone.low-key'),
                    'high-key': t('exif.tone.high-key'),
                    'normal': t('exif.tone.normal'),
                    'high-contrast': t('exif.tone.high-contrast'),
                  }
                  return toneTypeMap[currentPhoto.toneAnalysis!.toneType] || currentPhoto.toneAnalysis!.toneType
                })()}
              />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Row label={t('exif.brightness.title')} value={`${currentPhoto.toneAnalysis.brightness}%`} />
                <Row label={t('exif.contrast.title')} value={`${currentPhoto.toneAnalysis.contrast}%`} />
                <Row
                  label={t('exif.shadow.ratio')}
                  value={`${Math.round(currentPhoto.toneAnalysis.shadowRatio * 100)}%`}
                />
                <Row
                  label={t('exif.highlight.ratio')}
                  value={`${Math.round(currentPhoto.toneAnalysis.highlightRatio * 100)}%`}
                />
              </div>
            </ExifRowGroup>
          </ExifSection>
        )}

        {currentPhoto.toneAnalysis && (
          <ExifSection title={t('exif.histogram')}>
            <HistogramChart thumbnailUrl={currentPhoto.thumbnailUrl} />
          </ExifSection>
        )}

        {gpsData && displayLatitude !== null && displayLongitude !== null && (
          <ExifSection title={t('exif.gps.location.info')} className="gap-3">
            <ExifRowGroup>
              <Row
                icon={icons.latitude}
                label={t('exif.gps.latitude')}
                value={formatCoordinate(gpsData.latitude, gpsData.latitudeRef)}
              />
              <Row
                icon={icons.longitude}
                label={t('exif.gps.longitude')}
                value={formatCoordinate(gpsData.longitude, gpsData.longitudeRef)}
              />
              {typeof gpsData.altitude === 'number' && (
                <Row icon={icons.altitude} label={t('exif.gps.altitude')} value={`${Math.round(gpsData.altitude)}m`} />
              )}
            </ExifRowGroup>

            {currentPhoto.location && (
              <ExifRowGroup>
                {(currentPhoto.location.city || currentPhoto.location.country) && (
                  <Row
                    icon={icons.city}
                    label={t('exif.gps.city')}
                    value={[currentPhoto.location.city, currentPhoto.location.state, currentPhoto.location.country]
                      .filter(Boolean)
                      .join(', ')}
                  />
                )}
                {/* Address row hidden for now
                {currentPhoto.location.locationName && (
                  <Row label={t('exif.gps.address')} value={currentPhoto.location.locationName} ellipsis={true} />
                )}
                */}
              </ExifRowGroup>
            )}

            <MiniMap latitude={displayLatitude} longitude={displayLongitude} photoId={currentPhoto.id} />
          </ExifSection>
        )}
      </div>
    </ScrollArea>
  )
}
