import '~/modules/viewer/PhotoViewer.css'

import type { PhotoManifestItem, PickedExif } from '@afilmory/builder'
import { MotionButtonBase, ScrollArea } from '@afilmory/ui'
import { clsxm, Spring } from '@afilmory/utils'
import { isNil } from 'es-toolkit/compat'
import { useAtomValue } from 'jotai'
import { m } from 'motion/react'
import type { FC, ReactNode } from 'react'
import { Fragment, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MiniMap } from './MiniMap'
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
import { getRenderablePhotoRegions } from '~/modules/viewer/photo-region-bounds'
import { convertExifGPSToDecimal } from '~/lib/map-utils'
import { ExifRowGroup, ExifSection } from './ExifSection'
import { formatExifData, Row } from './formatExifData'
import { HistogramChart } from './HistogramChart'
import { PhotoRegionsSection } from './PhotoRegionsSection'
import { RawExifViewer } from './RawExifViewer'

/**
 * Same layout as `Row`, but the value is a link.
 *
 * Affordance is deliberately quiet: a dotted underline and a faint arrow at rest.
 * On hover the text stays full-contrast (no accent-coloured text, which is hard to
 * read on the dark glass panel); the accent shows up as a soft wash behind it instead.
 */
const LinkRow: FC<{ label: string, value: string, href: string, title?: string, icon?: ReactNode }> = ({
  label,
  value,
  href,
  title,
  icon,
}) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-text-secondary flex shrink-0 items-center gap-1.5">
      {icon}
      {label}
    </span>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="group text-text hover:bg-accent/15 focus-visible:bg-accent/15 -my-0.5 -mr-1.5 inline-flex min-w-0 items-center justify-end gap-1 rounded-md px-1.5 py-0.5 text-right underline decoration-white/40 decoration-dotted underline-offset-4 transition-colors duration-200 hover:decoration-white hover:decoration-solid focus-visible:decoration-white focus-visible:decoration-solid"
    >
      <span className="min-w-0">{value}</span>
      <i className="i-mingcute-arrow-right-up-line shrink-0 text-xs opacity-40 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
    </a>
  </div>
)

const rowIconClassName = 'shrink-0 text-sm text-white/70'

const captureChipClassName = 'border-accent/20 bg-accent/10 flex h-6 items-center gap-2 rounded-md border px-2'

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
  const decimalLatitude = gpsData?.latitude ?? null
  const decimalLongitude = gpsData?.longitude ?? null

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

  return (
    <ScrollArea mask rootClassName={rootClassName} viewportClassName={viewportClassName}>
      <div className={clsxm('flex flex-col', isMobile ? 'gap-3' : 'gap-4')}>
        <ExifSection title={t('exif.basic.info')}>
          <ExifRowGroup>
            {formattedExifData?.dateTime && <Row label={t('exif.capture.time')} value={formattedExifData.dateTime} />}
            {formattedExifData?.copyright && (
              usageUrl
                ? (
                    <LinkRow
                      label={t('exif.copyright')}
                      value={formattedExifData.copyright}
                      href={usageUrl}
                      title="Photo usage and licensing"
                    />
                  )
                : <Row label={t('exif.copyright')} value={formattedExifData.copyright} />
            )}
          </ExifRowGroup>
        </ExifSection>

        
   {formattedExifData && (
          <Fragment>
            {(formattedExifData.camera || formattedExifData.lens) && (
              <ExifSection title={t('exif.device.info')}>
                <ExifRowGroup>
                  {formattedExifData.camera && (
                    cameraFilterName
                      ? (
                          <LinkRow
                            icon={<i className={`i-mingcute-camera-line ${rowIconClassName}`} />}
                            label={t('exif.camera')}
                            value={formattedExifData.camera}
                            href={`/?cameras=${encodeURIComponent(cameraFilterName)}`}
                            title="Show all photos taken with this camera"
                          />
                        )
                      : (
                          <Row
                            icon={<i className={`i-mingcute-camera-line ${rowIconClassName}`} />}
                            label={t('exif.camera')}
                            value={formattedExifData.camera}
                          />
                        )
                  )}
                  {formattedExifData.lens && (
                    lensFilterName
                      ? (
                          <LinkRow
                            icon={<LensElementIcon className={rowIconClassName} />}
                            label={t('exif.lens')}
                            value={formattedExifData.lens}
                            href={`/?lenses=${encodeURIComponent(lensFilterName)}`}
                            title="Show all photos taken with this lens"
                          />
                        )
                      : (
                          <Row
                            icon={<LensElementIcon className={rowIconClassName} />}
                            label={t('exif.lens')}
                            value={formattedExifData.lens}
                          />
                        )
                  )}
                  {formattedExifData.focalLength && (
                    <Row
                      icon={<FocalLengthIcon className={rowIconClassName} />}
                      label={t('exif.focal.length.actual')}
                      value={`${formattedExifData.focalLength}mm`}
                    />
                  )}
                  {formattedExifData.maxAperture && (
                    <Row
                      icon={<TablerAperture className={rowIconClassName} />}
                      label={t('exif.max.aperture')}
                      value={`f/${formattedExifData.maxAperture}`}
                    />
                  )}
                </ExifRowGroup>
              </ExifSection>
            )}

        {(formattedExifData.exposureMode
          || formattedExifData.exposureProgram
          || formattedExifData.meteringMode
          || formattedExifData.whiteBalance
          || formattedExifData.flash) && (
          <ExifSection title={t('exif.capture.mode')}>
            <ExifRowGroup>
              {!isNil(formattedExifData.exposureProgram) && (
                <Row label={t('exif.exposureprogram.title')} value={formattedExifData.exposureProgram} />
              )}
              {!isNil(formattedExifData.exposureMode) && (
                <Row label={t('exif.exposure.mode.title')} value={formattedExifData.exposureMode} />
              )}
              {!isNil(formattedExifData.meteringMode) && (
                <Row label={t('exif.metering.mode.type')} value={formattedExifData.meteringMode} />
              )}
              {!isNil(formattedExifData.whiteBalance) && (
                <Row label={t('exif.white.balance.title')} value={formattedExifData.whiteBalance} />
              )}
              {!isNil(formattedExifData.flash) && (
                <Row label={t('exif.flash.title')} value={formattedExifData.flash} />
              )}
            </ExifRowGroup>
          </ExifSection>
        )}

        {formattedExifData
          && (formattedExifData.shutterSpeed
            || formattedExifData.iso
            || formattedExifData.aperture
            || formattedExifData.exposureBias) && (
          <ExifSection title={t('exif.capture.parameters')}>
            <div className="grid grid-cols-2 gap-2">
              {formattedExifData.aperture && (
                <div className={captureChipClassName}>
                  <TablerAperture className="text-sm text-white/70" />
                  <span className="text-xs">{formattedExifData.aperture}</span>
                </div>
              )}

              {formattedExifData.shutterSpeed && (
                <div className={captureChipClassName}>
                  <MaterialSymbolsShutterSpeed className="text-sm text-white/70" />
                  <span className="text-xs">{formattedExifData.shutterSpeed}</span>
                </div>
              )}

              {formattedExifData.iso && (
                <div className={captureChipClassName}>
                  <CarbonIsoOutline className="text-sm text-white/70" />
                  <span className="text-xs">
                    ISO
                    {formattedExifData.iso}
                  </span>
                </div>
              )}

              {formattedExifData.exposureBias && (
                <div className={captureChipClassName}>
                  <MaterialSymbolsExposure className="text-sm text-white/70" />
                  <span className="text-xs">{formattedExifData.exposureBias}</span>
                </div>
              )}
            </div>
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

        

            
          {formattedExifData.gps && (
              <ExifSection title={t('exif.gps.location.info')} className="gap-3">
                <ExifRowGroup>
                  <Row label={t('exif.gps.latitude')} value={formattedExifData.gps.latitude} />
                  <Row label={t('exif.gps.longitude')} value={formattedExifData.gps.longitude} />
                  {formattedExifData.gps.altitude && (
                    <Row label={t('exif.gps.altitude')} value={`${formattedExifData.gps.altitude}m`} />
                  )}
                </ExifRowGroup>

                {currentPhoto.location && (
                  <ExifRowGroup>
                    {(currentPhoto.location.city || currentPhoto.location.country) && (
                      <Row
                        label={t('exif.gps.city')}
                        value={[currentPhoto.location.city, currentPhoto.location.state, currentPhoto.location.country].filter(Boolean).join(', ')}
                      />
                    )}
                                     {/* Address row hidden for now
                    {currentPhoto.location.locationName && (
                      <Row label={t('exif.gps.address')} value={currentPhoto.location.locationName} ellipsis={true} />
                    )}
                    */}

                  </ExifRowGroup>
                )}

                {decimalLatitude !== null && decimalLongitude !== null && (
                  <MiniMap latitude={decimalLatitude} longitude={decimalLongitude} photoId={currentPhoto.id} />
                )}
              </ExifSection>
            )}
          </Fragment>
        )}
      </div>
    </ScrollArea>
  )
}
