
/**
 * Download an original photo with its metadata removed, keeping only:
 *   - creator (Artist) and copyright, re-written as fresh EXIF + XMP
 *   - creator email, copyright usage terms, and copyright info URL in XMP
 *   - orientation, so the photo is never shown rotated wrongly
 *   - the colour profile (ICC) and basic JPEG headers, so colours look the same
 *
 * Everything else (camera, lens, GPS, dates, keywords, captions, IPTC,
 * thumbnails...) is dropped. Only JPEG files can be cleaned; any other
 * type is downloaded unchanged.
 */

interface Identity {
  artist?: string
  copyright?: string
  creatorEmail?: string
  usageTerms?: string
  copyrightInfoUrl?: string
  orientation?: number
}

const textEncoder = new TextEncoder()

/** EXIF text is usually UTF-8, but older software writes Latin-1. */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const startsWith = (
  data: Uint8Array,
  offset: number,
  text: string,
): boolean => {
  if (offset + text.length > data.length) return false
  for (let i = 0; i < text.length; i++) {
    if (data[offset + i] !== text.charCodeAt(i)) return false
  }
  return true
}

/** Read Artist, Copyright and Orientation from an EXIF APP1 payload. */
function readExifIdentity(
  data: Uint8Array,
  payloadStart: number,
  payloadEnd: number,
): Identity {
  const result: Identity = {}
  // payload = "Exif\0\0" + TIFF block
  const tiff = payloadStart + 6
  if (tiff + 8 > payloadEnd) return result

  const view = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  )
  const little = data[tiff] === 0x49 // "II"
  if (!little && data[tiff] !== 0x4D) return result

  const u16 = (o: number) => view.getUint16(o, little)
  const u32 = (o: number) => view.getUint32(o, little)

  const ifd = tiff + u32(tiff + 4)
  if (ifd + 2 > payloadEnd) return result
  const count = u16(ifd)

  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > payloadEnd) break

    const tag = u16(entry)
    const type = u16(entry + 2)
    const n = u32(entry + 4)

    if (tag === 0x0112 && type === 3 && n === 1) {
      result.orientation = u16(entry + 8)
    }
    else if (
      (tag === 0x013B || tag === 0x8298)
      && type === 2
      && n > 1
    ) {
      const start = n <= 4
        ? entry + 8
        : tiff + u32(entry + 8)

      if (start + n > payloadEnd) continue

      const value = decodeText(
        data.subarray(start, start + n - 1),
      ).replace(/\0+$/, '').trim()

      if (!value) continue

      if (tag === 0x013B) result.artist = value
      else result.copyright = value
    }
  }

  return result
}

/**
 * Read the additional metadata from an XMP APP1 payload.
 * The original XMP is discarded after its supported fields are extracted.
 */

function buildXmpSegment({
  artist,
  copyright,
  creatorEmail,
  usageTerms,
  copyrightInfoUrl,
}: Identity): Uint8Array | null {
  if (
    !artist
    && !copyright
    && !creatorEmail
    && !usageTerms
    && !copyrightInfoUrl
  ) {
    return null
  }

  const creator = artist
    ? '<dc:creator><rdf:Seq><rdf:li>'
      + `${escapeXml(artist)}`
      + '</rdf:li></rdf:Seq></dc:creator>'
    : ''

  const rights = copyright
    ? '<dc:rights><rdf:Alt>'
      + `<rdf:li xml:lang="x-default">${escapeXml(copyright)}</rdf:li>`
      + '</rdf:Alt></dc:rights>'
      + '<xmpRights:Marked>True</xmpRights:Marked>'
    : ''

  const email = creatorEmail
    ? '<Iptc4xmpCore:CreatorContactInfo>'
      + `<Iptc4xmpCore:CiEmailWork>${escapeXml(creatorEmail)}</Iptc4xmpCore:CiEmailWork>`
      + '</Iptc4xmpCore:CreatorContactInfo>'
    : ''

  const terms = usageTerms
    ? '<xmpRights:UsageTerms><rdf:Alt>'
      + `<rdf:li xml:lang="x-default">${escapeXml(usageTerms)}</rdf:li>`
      + '</rdf:Alt></xmpRights:UsageTerms>'
    : ''

  const webStatement = copyrightInfoUrl
    ? `<xmpRights:WebStatement>${escapeXml(copyrightInfoUrl)}</xmpRights:WebStatement>`
    : ''

  const copyrightUrl = copyrightInfoUrl
    ? `<photoshop:CopyrightInfoURL>${escapeXml(copyrightInfoUrl)}</photoshop:CopyrightInfoURL>`
    : ''

  const xmp =
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    + '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<rdf:Description rdf:about=""'
    + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
    + ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"'
    + ' xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"'
    + ' xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">'
    + `${creator}${rights}${email}${terms}${webStatement}${copyrightUrl}`
    + '</rdf:Description></rdf:RDF></x:xmpmeta>'
    + '<?xpacket end="w"?>'

  return buildApp1(
    textEncoder.encode('http://ns.adobe.com/xap/1.0/\0'),
    textEncoder.encode(xmp),
  )
}


/** Build a minimal EXIF APP1 segment. */
function buildExifSegment({
  artist,
  copyright,
  orientation,
}: Identity): Uint8Array | null {
  const entries: {
    tag: number
    type: number
    count: number
    bytes: Uint8Array
  }[] = []

  if (orientation && orientation >= 1 && orientation <= 8) {
    const bytes = new Uint8Array(2)
    new DataView(bytes.buffer).setUint16(0, orientation, true)
    entries.push({
      tag: 0x0112,
      type: 3,
      count: 1,
      bytes,
    })
  }

  for (
    const [tag, value] of [
      [0x013B, artist],
      [0x8298, copyright],
    ] as const
  ) {
    if (!value) continue

    const text = textEncoder.encode(value)
    const bytes = new Uint8Array(text.length + 1)
    bytes.set(text)

    entries.push({
      tag,
      type: 2,
      count: bytes.length,
      bytes,
    })
  }

  if (entries.length === 0) return null

  const ifdSize = 2 + entries.length * 12 + 4
  const dataStart = 8 + ifdSize
  let dataSize = 0

  for (const e of entries) {
    if (e.bytes.length > 4) {
      dataSize += e.bytes.length + (e.bytes.length % 2)
    }
  }

  const tiff = new Uint8Array(dataStart + dataSize)
  const view = new DataView(tiff.buffer)

  tiff.set([0x49, 0x49, 0x2A, 0x00])
  view.setUint32(4, 8, true)
  view.setUint16(8, entries.length, true)

  let dataCursor = dataStart

  entries.forEach((e, i) => {
    const at = 10 + i * 12

    view.setUint16(at, e.tag, true)
    view.setUint16(at + 2, e.type, true)
    view.setUint32(at + 4, e.count, true)

    if (e.bytes.length <= 4) {
      tiff.set(e.bytes, at + 8)
    }
    else {
      view.setUint32(at + 8, dataCursor, true)
      tiff.set(e.bytes, dataCursor)
      dataCursor += e.bytes.length + (e.bytes.length % 2)
    }
  })

  return buildApp1(
    textEncoder.encode('Exif\0\0'),
    tiff,
  )
}

const escapeXml = (s: string) =>
  s.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Build an XMP APP1 segment containing creator and copyright metadata. */
function buildXmpSegment({
  artist,
  copyright,
  creatorEmail,
  usageTerms,
  copyrightInfoUrl,
}: Identity): Uint8Array | null {
  if (
    !artist
    && !copyright
    && !creatorEmail
    && !usageTerms
    && !copyrightInfoUrl
  ) {
    return null
  }

  const creator = artist
    ? '<dc:creator><rdf:Seq><rdf:li>'
      + `${escapeXml(artist)}`
      + '</rdf:li></rdf:Seq></dc:creator>'
    : ''

  const rights = copyright
    ? '<dc:rights><rdf:Alt>'
      + `<rdf:li xml:lang="x-default">${escapeXml(copyright)}</rdf:li>`
      + '</rdf:Alt></dc:rights>'
      + '<xmpRights:Marked>True</xmpRights:Marked>'
    : ''

  const email = creatorEmail
    ? '<Iptc4xmpCore:CiEmailWork>'
      + `${escapeXml(creatorEmail)}`
      + '</Iptc4xmpCore:CiEmailWork>'
    : ''

  const terms = usageTerms
    ? '<xmpRights:UsageTerms><rdf:Alt>'
      + `<rdf:li xml:lang="x-default">${escapeXml(usageTerms)}</rdf:li>`
      + '</rdf:Alt></xmpRights:UsageTerms>'
    : ''

  const webStatement = copyrightInfoUrl
    ? `<xmpRights:WebStatement>${escapeXml(copyrightInfoUrl)}</xmpRights:WebStatement>`
    : ''

  const xmp =
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
    + '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
    + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<rdf:Description rdf:about=""'
    + ' xmlns:dc="http://purl.org/dc/elements/1.1/"'
    + ' xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"'
    + ' xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/">'
    + `${creator}${rights}${email}${terms}${webStatement}`
    + '</rdf:Description></rdf:RDF></x:xmpmeta>'
    + '<?xpacket end="w"?>'

  return buildApp1(
    textEncoder.encode('http://ns.adobe.com/xap/1.0/\0'),
    textEncoder.encode(xmp),
  )
}

function buildApp1(
  header: Uint8Array,
  body: Uint8Array,
): Uint8Array | null {
  const length = 2 + header.length + body.length

  if (length > 0xFFFF) return null

  const out = new Uint8Array(2 + length)
  out[0] = 0xFF
  out[1] = 0xE1
  out[2] = length >> 8
  out[3] = length & 0xFF
  out.set(header, 4)
  out.set(body, 4 + header.length)

  return out
}

/**
 * Returns a cleaned JPEG, or null if it cannot safely be rewritten.
 * Fallback supplies metadata when it is not embedded in the original file.
 */
export function cleanJpeg(
  input: Uint8Array,
  fallback: Identity = {},
): Uint8Array | null {
  if (
    input.length < 4
    || input[0] !== 0xFF
    || input[1] !== 0xD8
  ) {
    return null
  }

  const kept: Uint8Array[] = []
  const identity: Identity = {}
  let pos = 2
  let scanStart = -1

  while (pos + 4 <= input.length) {
    if (input[pos] !== 0xFF) return null

    const marker = input[pos + 1]
    if (marker === 0xFF) {
      pos++
      continue
    }

    if (marker === 0xDA) {
      scanStart = pos
      break
    }

    const length = (input[pos + 2] << 8) | input[pos + 3]
    const end = pos + 2 + length

    if (length < 2 || end > input.length) return null

    const segment = input.subarray(pos, end)
    const payload = pos + 4

    let keep = true

    if (marker === 0xE1) {
      if (startsWith(input, payload, 'Exif\0\0')) {
        const found = readExifIdentity(input, payload, end)

        identity.artist ??= found.artist
        identity.copyright ??= found.copyright
        identity.orientation ??= found.orientation
      }
      else {
        const found = readXmpIdentity(input, payload, end)

        identity.creatorEmail ??= found.creatorEmail
        identity.usageTerms ??= found.usageTerms
        identity.copyrightInfoUrl ??= found.copyrightInfoUrl
      }

      // Drop original EXIF/XMP after extracting supported fields.
      keep = false
    }
    else if (marker === 0xE0) {
      keep = true
    }
    else if (marker === 0xE2) {
      keep = startsWith(input, payload, 'ICC_PROFILE\0')
    }
    else if (marker === 0xEE) {
      keep = startsWith(input, payload, 'Adobe')
    }
    else if (
      (marker >= 0xE3 && marker <= 0xEF)
      || marker === 0xFE
    ) {
      keep = false
    }

    if (keep) kept.push(segment)
    pos = end
  }

  if (scanStart < 0) return null

  const merged: Identity = {
    artist: identity.artist ?? fallback.artist,
    copyright: identity.copyright ?? fallback.copyright,
    creatorEmail: identity.creatorEmail ?? fallback.creatorEmail,
    usageTerms: identity.usageTerms ?? fallback.usageTerms,
    copyrightInfoUrl:
      identity.copyrightInfoUrl ?? fallback.copyrightInfoUrl,
    orientation: identity.orientation,
  }

  const fresh = [
    buildExifSegment(merged),
    buildXmpSegment(merged),
  ].filter((s): s is Uint8Array => s !== null)

  // Place new segments right after the JFIF header, if present.
  const insertAt =
    kept.length > 0 && kept[0][1] === 0xE0 ? 1 : 0

  const ordered = [
    ...kept.slice(0, insertAt),
    ...fresh,
    ...kept.slice(insertAt),
  ]

  const tail = input.subarray(scanStart)
  const total =
    2
    + ordered.reduce((sum, s) => sum + s.length, 0)
    + tail.length

  const out = new Uint8Array(total)
  out[0] = 0xFF
  out[1] = 0xD8

  let cursor = 2

  for (const s of ordered) {
    out.set(s, cursor)
    cursor += s.length
  }

  out.set(tail, cursor)

  return out
}

interface DownloadablePhoto {
  id: string
  originalUrl: string
  exif?: {
    Artist?: string | null
    Copyright?: string | null
  } | null
}

const fileNameFor = (photo: DownloadablePhoto): string => {
  try {
    const last = new URL(
      photo.originalUrl,
      window.location.href,
    ).pathname.split('/').pop() || ''

    const decoded = decodeURIComponent(last)

    if (decoded.includes('.')) return decoded
  }
  catch {}

  return `${photo.id}.jpg`
}

/** Fetches the original, strips unwanted metadata, and saves it. */
export async function downloadCleanPhoto(
  photo: DownloadablePhoto,
): Promise<{ cleaned: boolean }> {
  const response = await fetch(photo.originalUrl)

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }

  const original = new Uint8Array(await response.arrayBuffer())

  const cleaned = cleanJpeg(original, {
    artist: photo.exif?.Artist || undefined,
    copyright: photo.exif?.Copyright || undefined,
  })

  const blob = new Blob(
    [
      (cleaned ?? original) as BlobPart,
    ],
    {
      type: cleaned
        ? 'image/jpeg'
        : response.headers.get('content-type')
          || 'application/octet-stream',
    },
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileNameFor(photo)

  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  return { cleaned: cleaned !== null }
}
