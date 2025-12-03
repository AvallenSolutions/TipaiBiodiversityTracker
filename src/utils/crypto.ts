import { v4 as uuidv4 } from 'uuid'

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export async function generateUniqueHash(
  userId: string,
  timestamp: string,
  latitude: number,
  longitude: number
): Promise<{ id: string; hash: string }> {
  const id = uuidv4()

  const dataString = `${id}|${userId}|${timestamp}|${latitude}|${longitude}`
  const hash = await sha256(dataString)

  return { id, hash }
}

export async function verifyHash(
  id: string,
  userId: string,
  timestamp: string,
  latitude: number,
  longitude: number,
  expectedHash: string
): Promise<boolean> {
  const dataString = `${id}|${userId}|${timestamp}|${latitude}|${longitude}`
  const computedHash = await sha256(dataString)
  return computedHash === expectedHash
}
