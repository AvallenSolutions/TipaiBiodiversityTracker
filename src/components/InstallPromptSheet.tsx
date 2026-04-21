import { useState } from 'react'
import { DS } from '@/lib/ledger-design'
import { Mono } from '@/components/logger/shared'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

interface Props {
  onClose: () => void
}

export default function InstallPromptSheet({ onClose }: Props) {
  const { canPrompt, prompt, ios } = useInstallPrompt()
  const [loading, setLoading] = useState(false)

  async function handleInstall() {
    setLoading(true)
    const outcome = await prompt()
    setLoading(false)
    if (outcome !== 'unavailable') onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.45)',
        animation: 'fade-in 200ms ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: DS.paper,
          borderTop: `3px double ${DS.ink}`,
          padding: '22px 24px max(28px, env(safe-area-inset-bottom))',
          maxHeight: '85vh',
          overflow: 'auto',
          animation: 'slide-up-fade 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <Mono size={9} color={DS.ochre} letter={0.22} style={{ marginBottom: 10 }}>
          ◆ A suggestion
        </Mono>

        <h2 style={{
          fontFamily: DS.serif, fontSize: 28, fontWeight: 300,
          letterSpacing: '-0.02em', color: DS.ink,
          lineHeight: 1.15, margin: '0 0 12px',
        }}>
          Carry the journal<br />
          <em style={{ fontWeight: 300, color: DS.inkSoft }}>in your pocket.</em>
        </h2>

        <p style={{
          fontFamily: DS.serif, fontSize: 15, fontWeight: 300, fontStyle: 'italic',
          color: DS.inkSoft, lineHeight: 1.55, margin: '0 0 22px',
        }}>
          Add The Field Journal to your home screen for full-screen access, faster logging, and a proper icon for the field.
        </p>

        {ios ? (
          <div style={{
            padding: '18px 18px',
            background: DS.ivory, border: `0.5px solid ${DS.ink}`,
            marginBottom: 18,
          }}>
            <Mono size={9} color={DS.ochre} letter={0.22} style={{ marginBottom: 10 }}>
              ◆ How — on iPhone
            </Mono>
            <p style={{
              fontFamily: DS.serif, fontSize: 14, fontWeight: 300,
              color: DS.ink, lineHeight: 1.65, margin: '0 0 8px',
            }}>
              <strong style={{ fontWeight: 500 }}>1.</strong>  Tap the share icon{' '}
              <span style={{
                display: 'inline-block', width: 20, height: 20, verticalAlign: 'middle',
                border: `1px solid ${DS.ochre}`, color: DS.ochre,
                fontFamily: DS.mono, fontSize: 13, lineHeight: '18px', textAlign: 'center',
              }}>⬆</span>{' '}
              at the bottom of Safari.
            </p>
            <p style={{
              fontFamily: DS.serif, fontSize: 14, fontWeight: 300,
              color: DS.ink, lineHeight: 1.65, margin: 0,
            }}>
              <strong style={{ fontWeight: 500 }}>2.</strong>  Scroll and tap <em>"Add to Home Screen"</em>.
            </p>
          </div>
        ) : canPrompt ? (
          <button
            onClick={handleInstall}
            disabled={loading}
            style={{
              width: '100%', padding: '14px 0',
              fontFamily: DS.serif, fontSize: 16, fontStyle: 'italic', fontWeight: 300,
              color: DS.ivory,
              background: loading ? DS.inkSoft : DS.ink,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 12,
              letterSpacing: '0.01em',
            }}
          >
            {loading ? '⋯ Installing' : 'Install the journal →'}
          </button>
        ) : (
          <div style={{
            padding: '18px 18px',
            background: DS.ivory, border: `0.5px solid ${DS.ink}`,
            marginBottom: 18,
          }}>
            <Mono size={9} color={DS.ochre} letter={0.22} style={{ marginBottom: 10 }}>
              ◆ How — on Android
            </Mono>
            <p style={{
              fontFamily: DS.serif, fontSize: 14, fontWeight: 300,
              color: DS.ink, lineHeight: 1.65, margin: 0,
            }}>
              Open the browser menu (<span style={{ fontFamily: DS.mono, color: DS.ochre }}>⋮</span>) and choose{' '}
              <em>"Install app"</em> or <em>"Add to home screen"</em>.
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: DS.mono, fontSize: 10, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: DS.inkSoft,
            padding: '10px 0',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
