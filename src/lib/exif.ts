import exifr from 'exifr'

export interface PhotoExif {
  takenAt: Date | null         // DateTimeOriginal — when the shutter fired
  latitude: number | null
  longitude: number | null
  cameraModel: string | null
}

/**
 * Pull the EXIF metadata we care about for sighting attribution. SLR/DSLR
 * photos almost always have DateTimeOriginal; GPS depends on the body or
 * an attached module. Returns nulls when a tag is missing — the caller
 * decides what to do with the gaps (e.g. fall back to a user-picked location).
 */
export async function extractExif(file: Blob): Promise<PhotoExif> {
  try {
    const data = await exifr.parse(file, {
      pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model'],
      gps: true,
    })
    if (!data) {
      return { takenAt: null, latitude: null, longitude: null, cameraModel: null }
    }
    const takenAtRaw = (data.DateTimeOriginal ?? data.CreateDate) as Date | string | undefined
    const takenAt = takenAtRaw ? new Date(takenAtRaw) : null
    const validDate = takenAt && !isNaN(takenAt.getTime()) ? takenAt : null

    // exifr's gps:true convenience returns numeric latitude/longitude already
    // in decimal degrees, signed for hemisphere.
    const lat = typeof data.latitude === 'number' ? data.latitude : null
    const lng = typeof data.longitude === 'number' ? data.longitude : null

    const make = typeof data.Make === 'string' ? data.Make.trim() : null
    const model = typeof data.Model === 'string' ? data.Model.trim() : null
    const cameraModel = [make, model].filter(Boolean).join(' ') || null

    return { takenAt: validDate, latitude: lat, longitude: lng, cameraModel }
  } catch {
    return { takenAt: null, latitude: null, longitude: null, cameraModel: null }
  }
}
