import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, Mic, X, Check, RotateCcw, SwitchCamera, Upload } from 'lucide-react'

interface MediaCaptureProps {
  onPhotoCapture: (blob: Blob) => void
  onAudioCapture: (blob: Blob) => void
  onSkip: () => void
  initialPhoto?: Blob | null
  initialAudio?: Blob | null
}

export default function MediaCapture({
  onPhotoCapture,
  onAudioCapture,
  onSkip,
  initialPhoto,
  initialAudio
}: MediaCaptureProps) {
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [isRecording, setIsRecording] = useState(false)
  const [hasAudio, setHasAudio] = useState(!!initialAudio)
  const [recordingTime, setRecordingTime] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (initialPhoto) {
      const url = URL.createObjectURL(initialPhoto)
      setCapturedPhotoUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [initialPhoto])

  useEffect(() => {
    return () => {
      stopCamera()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopCamera()
    setCameraError(null)
    setCameraReady(false)

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        videoRef.current.setAttribute('autoplay', 'true')
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.')
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.')
      } else {
        setCameraError(`Could not access camera: ${err.message}`)
      }
    }
  }, [])

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraReady(false)
  }

  async function handleOpenCamera() {
    setShowCamera(true)
    await startCamera(facingMode)
  }

  async function handleSwitchCamera() {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacing)
    await startCamera(newFacing)
  }

  function handleTakePhoto() {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl)
        const url = URL.createObjectURL(blob)
        setCapturedPhotoUrl(url)
        onPhotoCapture(blob)
        stopCamera()
        setShowCamera(false)
      }
    }, 'image/jpeg', 0.9)
  }

  function handleFileCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl)
      const url = URL.createObjectURL(file)
      setCapturedPhotoUrl(url)
      onPhotoCapture(file)
    }
  }

  function retakePhoto() {
    if (capturedPhotoUrl) URL.revokeObjectURL(capturedPhotoUrl)
    setCapturedPhotoUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        onAudioCapture(audioBlob)
        setHasAudio(true)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start(1000)
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        alert('Microphone permission denied. Please allow microphone access in your browser settings.')
      } else {
        alert('Could not access microphone. Please check permissions.')
      }
      console.error('Audio recording error:', error)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-tipai-green-50 to-tipai-green-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <h1 className="text-3xl font-bold text-tipai-green-900 text-center mb-2">
          Capture Media
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Take a photo or record audio (optional)
        </p>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {/* Photo Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Photo</h3>

            {/* Live Camera View */}
            {showCamera && !capturedPhotoUrl && (
              <div className="relative rounded-lg overflow-hidden bg-black mb-3">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-72 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                    <p className="text-white text-center text-sm">{cameraError}</p>
                  </div>
                )}

                {cameraReady && (
                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                    <button
                      onClick={handleSwitchCamera}
                      className="bg-white/30 backdrop-blur-sm rounded-full p-3 hover:bg-white/50 transition-colors"
                    >
                      <SwitchCamera className="w-6 h-6 text-white" />
                    </button>
                    <button
                      onClick={handleTakePhoto}
                      className="bg-white rounded-full w-16 h-16 flex items-center justify-center border-4 border-white/50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="w-12 h-12 bg-white rounded-full border-2 border-gray-300" />
                    </button>
                    <button
                      onClick={() => { stopCamera(); setShowCamera(false) }}
                      className="bg-white/30 backdrop-blur-sm rounded-full p-3 hover:bg-white/50 transition-colors"
                    >
                      <X className="w-6 h-6 text-white" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Captured Photo Preview */}
            {capturedPhotoUrl && (
              <div className="relative">
                <img
                  src={capturedPhotoUrl}
                  alt="Captured"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <button
                  onClick={retakePhoto}
                  className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
                >
                  <RotateCcw className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            )}

            {/* Capture Buttons */}
            {!capturedPhotoUrl && !showCamera && (
              <div className="space-y-3">
                <button
                  onClick={handleOpenCamera}
                  className="w-full bg-tipai-green-600 text-white py-4 rounded-lg font-semibold hover:bg-tipai-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-6 h-6" />
                  Open Camera
                </button>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileCapture}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    Choose from Gallery
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Audio Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Audio</h3>
            {isRecording ? (
              <div className="space-y-3">
                <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-700 font-semibold">Recording</span>
                  </div>
                  <p className="text-2xl font-mono text-red-700">{formatTime(recordingTime)}</p>
                </div>
                <button
                  onClick={stopRecording}
                  className="w-full bg-red-600 text-white py-4 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-6 h-6" />
                  Stop Recording
                </button>
              </div>
            ) : hasAudio ? (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-700 font-semibold">Audio recorded</p>
              </div>
            ) : (
              <button
                onClick={startRecording}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Mic className="w-6 h-6" />
                Record Audio
              </button>
            )}
          </div>

          {/* Continue Button */}
          <button
            onClick={onSkip}
            disabled={!capturedPhotoUrl && !hasAudio}
            className="w-full bg-tipai-green-700 text-white py-4 rounded-lg font-semibold hover:bg-tipai-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>

          <button
            onClick={onSkip}
            className="w-full text-gray-600 hover:text-gray-800 text-sm"
          >
            Skip media capture
          </button>
        </div>
      </div>
    </div>
  )
}
