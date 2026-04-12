import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, SwitchCamera, X, Image, Mic, Square, CheckCircle } from 'lucide-react'
import type { MediaType } from '@/types'

interface MediaCaptureProps {
  onMediaCapture: (blob: Blob, type: MediaType) => void
  onDone: () => void
}

export default function MediaCapture({ onMediaCapture, onDone }: MediaCaptureProps) {
  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [shutterFlash, setShutterFlash] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Audio state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Captured media previews
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([])
  const [audioRecorded, setAudioRecorded] = useState(false)

  // Gallery file input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Camera ────────────────────────────────────────────────

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraError(null)
    stopStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraOpen(true)
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Unable to access camera. Please check your device settings.'
      setCameraError(msg)
      setCameraOpen(false)
    }
  }, [stopStream])

  const handleOpenCamera = () => {
    startCamera(facingMode)
  }

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }

  const handleCloseCamera = () => {
    stopStream()
    setCameraOpen(false)
  }

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Haptic feedback
    navigator.vibrate?.(50)

    // Shutter flash
    setShutterFlash(true)
    setTimeout(() => setShutterFlash(false), 250)

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          setCapturedPhotos((prev) => [...prev, url])
          onMediaCapture(blob, 'photo')
        }
      },
      'image/jpeg',
      0.85,
    )
  }

  // ─── Gallery ───────────────────────────────────────────────

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const type: MediaType = file.type.startsWith('video/') ? 'video' : 'photo'
    const url = URL.createObjectURL(file)

    if (type === 'photo') {
      setCapturedPhotos((prev) => [...prev, url])
    }
    onMediaCapture(file, type)

    // Reset so the same file can be chosen again
    e.target.value = ''
  }

  // ─── Audio ─────────────────────────────────────────────────

  const startRecording = async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        setAudioRecorded(true)
        onMediaCapture(blob, 'audio')
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow microphone access in your browser settings.'
          : 'Unable to access microphone. Please check your device settings.'
      setCameraError(msg)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // ─── Cleanup ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopStream()
      mediaRecorderRef.current?.stop()
      if (timerRef.current) clearInterval(timerRef.current)
      capturedPhotos.forEach((url) => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4">
      <h2 className="font-heading text-2xl font-semibold text-gray-800">Capture Media</h2>

      {/* Error banner */}
      {cameraError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {cameraError}
        </div>
      )}

      {/* ── Fullscreen camera overlay ──────────────────────── */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[60] bg-black">
          {/* Live preview */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {/* Shutter flash */}
          {shutterFlash && (
            <div className="animate-shutter-flash pointer-events-none absolute inset-0 bg-white" />
          )}

          {/* Overlay controls */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent px-8 pb-10 pt-16">
            {/* Close */}
            <button
              type="button"
              onClick={handleCloseCamera}
              className="rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
              aria-label="Close camera"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Shutter — 72px native camera size */}
            <button
              type="button"
              onClick={handleCapture}
              className="h-[72px] w-[72px] rounded-full border-4 border-white bg-white/25 backdrop-blur-sm transition active:scale-90 active:bg-white/40"
              aria-label="Capture photo"
            />

            {/* Flip camera */}
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="rounded-full bg-white/20 p-3 text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-95"
              aria-label="Switch camera"
            >
              <SwitchCamera className="h-6 w-6" />
            </button>
          </div>

          {/* Photo counter badge */}
          {capturedPhotos.length > 0 && (
            <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-tipai-700 text-sm font-bold text-white shadow-lg">
              {capturedPhotos.length}
            </div>
          )}
        </div>
      )}

      {/* ── Camera / gallery buttons (when camera closed) ─── */}
      {!cameraOpen && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleOpenCamera}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-tipai-700 px-4 py-4 text-sm font-semibold text-white transition hover:bg-tipai-800 active:scale-[0.98]"
          >
            <Camera className="h-5 w-5" />
            Open Camera
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-200 active:scale-[0.98]"
          >
            <Image className="h-5 w-5" />
            Choose from Gallery
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleGalleryChange}
          />
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Captured photo previews ────────────────────────── */}
      {capturedPhotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600">
            Photos captured ({capturedPhotos.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {capturedPhotos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Captured ${i + 1}`}
                className="h-20 w-20 flex-shrink-0 rounded-lg object-cover ring-1 ring-gray-200"
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Audio section ──────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-600">Audio Recording</p>

        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200 active:scale-[0.98]"
          >
            <Mic className="h-5 w-5" />
            Record Audio
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 active:scale-[0.98]"
            >
              <Square className="h-4 w-4 fill-current" />
              Stop
            </button>
            <div className="flex items-center gap-2 text-sm text-red-600">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Recording {formatTime(recordingTime)}
            </div>
          </div>
        )}

        {audioRecorded && (
          <div className="flex items-center gap-2 text-sm text-tipai-600">
            <CheckCircle className="h-4 w-4" />
            Audio recorded
          </div>
        )}
      </div>

      {/* ── Done ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onDone}
        className="w-full rounded-xl bg-tipai-700 py-3.5 text-sm font-semibold text-white transition hover:bg-tipai-800 active:scale-[0.98]"
      >
        Done — Continue to Details
      </button>
    </div>
  )
}
