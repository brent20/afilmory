import { ActionButton } from '@afilmory/ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { isPrivateShare } from '~/lib/private-share'
import type { PhotoManifest } from '~/types/photo'

/** Download button shown only on private share pages (/?s=<secret>). */
export const PrivateDownloadButton = ({
  photo,
  disabled,
  className,
}: {
  photo: PhotoManifest
  disabled?: boolean
  className?: string
}) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)

  if (!isPrivateShare()) return null

  const handleDownload = async () => {
    setBusy(true)
    try {
      const { downloadCleanPhoto } = await import('~/lib/download-clean')
      const { cleaned } = await downloadCleanPhoto(photo)
      if (!cleaned) {
        toast.info(t('photo.downloadUnstripped'))
      }
    }
    catch (error) {
      console.error('Failed to download photo:', error)
      toast.error(t('photo.downloadError'))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <ActionButton
      disabled={disabled || busy}
      className={className}
      onClick={handleDownload}
      title={t('photo.download')}
      aria-label={t('photo.download')}
    >
      {busy ? <i className="i-mingcute-loading-3-line animate-spin" /> : <i className="i-mingcute-download-2-line" />}
    </ActionButton>
  )
}
