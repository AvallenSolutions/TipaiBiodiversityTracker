import { useState, useRef } from 'react'
import { Camera, Mic, X, Check, RotateCcw } from 'lucide-react'

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
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(
    initialPhoto ? URL.createObjectURL(initialPhoto) : null
  )
  const [isRecording, setIsRecording] = useState(false)
  const [hasAudio, setHasAudio] = useState(!!initialAudio)
  const [recordingTime, setRecordingTime] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setCapturedPhoto(URL.createObjectURL(file))
      onPhotoCapture(file)
    }
  }

  function retakePhoto() {
    setCapturedPhoto(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        onAudioCapture(audioBlob)
        setHasAudio(true)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      alert('Could not access microphone. Please check permissions.')
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
            {capturedPhoto ? (
              <div className="relative">
                <img
                  src={capturedPhoto}
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
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-tipai-green-600 text-white py-4 rounded-lg font-semibold hover:bg-tipai-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-6 h-6" />
                  Take Photo/Video
                </button>
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
            disabled={!capturedPhoto && !hasAudio}
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
