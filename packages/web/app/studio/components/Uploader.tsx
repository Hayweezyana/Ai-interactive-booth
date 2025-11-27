// packages/web/app/studio/components/Uploader.tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = { onPick: (file: File) => void }

export function Uploader({ onPick }: Props) {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)
  const [streamErr, setStreamErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false) // for retake reinit state

  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const capturedUrlRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const stopStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    setReady(false)
    setStreamErr(null)
    setBusy(true)
    try {
      // stop any previous tracks
      stopStream()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      mediaStreamRef.current = stream

      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await new Promise<void>(resolve => {
          const onMeta = () => resolve()
          v.addEventListener('loadedmetadata', onMeta, { once: true })
        })
        setReady(true)
        await v.play().catch(() => {})
      }
    } catch (e: any) {
      setStreamErr(e?.message || 'Camera not available')
    } finally {
      setBusy(false)
    }
  }, [facing, stopStream])

  // start/stop camera on mode/facing changes
  useEffect(() => {
    let cancelled = false
    if (mode === 'camera') {
      (async () => {
        await startCamera()
        if (cancelled) stopStream()
      })()
    }
    return () => {
      cancelled = true
      setReady(false)
      stopStream()
    }
  }, [mode, facing, startCamera, stopStream])

  // cleanup object URL
  useEffect(() => {
    return () => {
      if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current)
      capturedUrlRef.current = null
    }
  }, [])

  function pickFromInput(f?: File | null) {
    if (!f) return
    onPick(f)
  }

  async function captureFrame() {
    const v = videoRef.current
    if (!v) return
    if (!ready) {
      try { await v.play() } catch {}
      if (!v.videoWidth || !v.videoHeight) return
    }

    const srcW = v.videoWidth || 1280
    const srcH = v.videoHeight || 720
    const longEdge = Math.min(1920, Math.max(srcW, srcH))
    const scale = longEdge / Math.max(srcW, srcH)
    let outW = Math.round(srcW * scale)
    let outH = Math.round(srcH * scale)

    const needRotate90 =
      (orientation === 'portrait' && outW >= outH) ||
      (orientation === 'landscape' && outH > outW)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    if (needRotate90) {
      canvas.width = outH
      canvas.height = outW
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(v, -outW / 2, -outH / 2, outW, outH)
    } else {
      canvas.width = outW
      canvas.height = outH
      ctx.drawImage(v, 0, 0, outW, outH)
    }

    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
    if (!blob) return

    // Stage for confirmation (don’t call onPick yet)
    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setCapturedFile(file)

    if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current)
    const url = URL.createObjectURL(blob)
    capturedUrlRef.current = url
    setCapturedUrl(url)

    flash()
  }

  function confirmUsePhoto() {
    if (capturedFile) onPick(capturedFile)
  }

  async function retake() {
    // 1) clear current preview/file
    if (capturedUrlRef.current) URL.revokeObjectURL(capturedUrlRef.current)
    capturedUrlRef.current = null
    setCapturedUrl(null)
    setCapturedFile(null)

    // 2) try to resume existing stream
    const v = videoRef.current
    if (v && mediaStreamRef.current) {
      try {
        await v.play()
        // if sizes still not known, force ready once metadata exists
        if (!v.videoWidth || !v.videoHeight) {
          await new Promise<void>(resolve => {
            const onMeta = () => resolve()
            v.addEventListener('loadedmetadata', onMeta, { once: true })
          })
        }
        setReady(true)
        return
      } catch {
        // fall through to restart
      }
    }

    // 3) fallback: fully restart the camera
    await startCamera()
  }

  function flash() {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed', inset: '0', background: 'white', opacity: '0.0',
      transition: 'opacity 120ms ease-out', pointerEvents: 'none', zIndex: '9999'
    } as CSSStyleDeclaration)
    document.body.appendChild(el)
    requestAnimationFrame(() => {
      el.style.opacity = '0.8'
      setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 150) }, 80)
    })
  }

  return (
    <div style={{ border: '1px solid #3f3f46', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header / Toggles */}
      <div style={{ display: 'flex', gap: 8, padding: 8, background: '#111113', borderBottom: '1px solid #27272a', flexWrap: 'wrap' }}>
        {/* <button
          type="button"
          onClick={() => { setMode('upload'); retake() }}
          style={{ padding: '6px 10px', borderRadius: 8, background: mode === 'upload' ? '#2563eb' : '#18181b', color: '#f8fafc', border: '1px solid #27272a' }}
        >
          Choose file
        </button> */}
        <button
          type="button"
          onClick={() => setMode('camera')}
          style={{ padding: '6px 10px', borderRadius: 8, background: mode === 'camera' ? '#2563eb' : '#18181b', color: '#f8fafc', border: '1px solid #27272a' }}
        >
          Use camera
        </button>

        {mode === 'camera' && (
          <>
            <div style={{ marginLeft: 'auto' }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Orientation:
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as 'landscape' | 'portrait')}
                style={{ background: '#18181b', color: '#f8fafc', border: '1px solid #27272a', borderRadius: 8, padding: '4px 8px' }}
              >
                <option value="landscape">Landscape</option>
                <option value="portrait">Portrait</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Camera:
              <select
                value={facing}
                onChange={(e) => setFacing(e.target.value as 'environment' | 'user')}
                style={{ background: '#18181b', color: '#f8fafc', border: '1px solid #27272a', borderRadius: 8, padding: '4px 8px' }}
              >
                <option value="environment">Rear</option>
                <option value="user">Front</option>
              </select>
            </label>
          </>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 12 }}>
        {mode === 'upload' ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => pickFromInput(e.target.files?.[0] || null)}
            />
            <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 6 }}>
              Tip: On phones, the picker can open the camera thanks to <code>capture=&quot;environment&quot;</code>.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {streamErr ? (
              <div style={{ color: '#fecaca' }}>Camera error: {streamErr}</div>
            ) : (
              <>
                {capturedUrl ? (
                  <img
                    src={capturedUrl}
                    alt="Captured preview"
                    style={{ width: '100%', maxHeight: 420, background: '#000', borderRadius: 8, objectFit: 'cover' }}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      maxHeight: 420,
                      background: '#000',
                      borderRadius: 8,
                      objectFit: 'cover',
                      transform: facing === 'user' ? 'scaleX(-1)' : undefined
                    }}
                  />
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {capturedUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={confirmUsePhoto}
                        style={{ padding: '8px 12px', borderRadius: 10, background: '#06abf7ff', color: '#052e16', fontWeight: 700, border: 'none' }}
                      >
                        Use this photo
                      </button>
                      <button
                        type="button"
                        onClick={retake}
                        style={{ padding: '8px 12px', borderRadius: 10, background: '#18181b', color: '#f8fafc', border: '1px solid #27272a' }}
                        disabled={busy}
                        title={busy ? 'Reinitializing camera…' : 'Retake'}
                      >
                        {busy ? 'Reinitializing…' : 'Take photo again'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={captureFrame}
                      disabled={!ready || busy}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: ready && !busy ? '#06abf7ff' : '#475569',
                        color: '#052e16',
                        fontWeight: 700,
                        border: 'none',
                        cursor: ready && !busy ? 'pointer' : 'not-allowed'
                      }}
                      title={ready ? 'Capture photo' : 'Camera not ready yet'}
                    >
                      {ready ? 'Take photo' : 'Initializing camera…'}
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#a1a1aa' }}>
                  Capture → preview → <b>Use this photo</b> to confirm, or <b>Take photo again</b> to retake.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
