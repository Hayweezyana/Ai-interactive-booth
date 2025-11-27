'use client'

import { useEffect, useState, FormEvent } from 'react'
import { Uploader } from './components/Uploader'
import { Progress } from './components/Progress'

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000/api'

type Job = {
  id: string
  status: string
  stage?: string
  resultUrl?: string
}

type DefaultPrompt = {
  label: string
  text: string
  requiresSecond: boolean
}

type SecondPhotoOption = {
  id: string
  label: string
  publicPath: string
}

const DEFAULT_PROMPTS: DefaultPrompt[] = [
  {
    label: 'Hug Ruger',
    text: 'Create a moment where the person in the first photo and the person in the second photo hug and smile with both faces showing in wide angle.',
    requiresSecond: true,
  },
  {
    label: 'Hug Poco',
    text: 'Create a moment where the person in the first photo and the person in the second photo hug and smile with both faces showing in wide angle.',
    requiresSecond: true,
  },
  {
    label: 'Superhero intro',
    text: 'Turn the person in the first photo into a glowing superhero, posing confidently as the camera moves in.',
    requiresSecond: false,
  },
  {
    label: 'Friends selfie (2 photos)',
    text: 'Make it look like the person in the first photo and the person in the second photo are taking a fun selfie together and celebrating.',
    requiresSecond: true,
  },
]

// ✅ These MUST match your actual files in `public/source`
const SECOND_PHOTO_OPTIONS: Record<string, SecondPhotoOption[]> = {
  'Hug Ruger': [
    {
      id: 'ruger-1',
      label: 'Ruger',
      publicPath: '/source/Ruger.jpeg', // public/source/Ruger.jpeg
    },
  ],
  'Hug Poco': [
    {
      id: 'poco-1',
      label: 'Poco',
      publicPath: '/source/Poco.jpeg', // public/source/Poco.jpeg
    },
  ],
}

export default function Studio() {
  const [primaryFile, setPrimaryFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string>()
  const [job, setJob] = useState<Job>()
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState<DefaultPrompt | null>(
    null,
  )
  const [secondChoice, setSecondChoice] = useState<SecondPhotoOption | null>(
    null,
  )

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!primaryFile) {
      alert('Please pick or capture the main image')
      return
    }

    if (!prompt.trim()) {
      alert('Please enter a prompt or choose one of the defaults')
      return
    }

    if (selectedPrompt?.requiresSecond && !secondChoice) {
      alert(
        'This style uses two photos. Please choose the Ruger or Poco second photo.',
      )
      return
    }

    // Grab form data BEFORE any await
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)

    const preset = String(formData.get('preset') || '')
    const aspect = String(formData.get('aspect') || '16:9')
    const durationSec = Number(formData.get('duration') || 8)

    setLoading(true)
    try {
      // 1) Upload primary image
      const primaryRes = await fetch(`${API}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mime: primaryFile.type }),
      })

      let primarySigned: any
      try {
        primarySigned = await primaryRes.json()
      } catch {
        const txt = await primaryRes.text()
        throw new Error(
          `upload-url (primary) returned non-JSON (${primaryRes.status}): ${txt}`,
        )
      }

      if (!primaryRes.ok) {
        throw new Error(
          `upload-url (primary) failed ${primaryRes.status}: ${
            primarySigned?.message || primarySigned?.error || 'unknown'
          }`,
        )
      }

      if (
        !primarySigned?.fields ||
        !primarySigned?.url ||
        !primarySigned?.bucketKey
      ) {
        throw new Error('upload-url (primary) malformed response')
      }

      const primaryFd = new FormData()
      Object.entries(primarySigned.fields).forEach(([k, v]) =>
        primaryFd.append(k, String(v)),
      )
      primaryFd.append('Content-Type', primaryFile.type)
      primaryFd.append('file', primaryFile)

      const primaryUp = await fetch(primarySigned.url, {
        method: 'POST',
        body: primaryFd,
      })
      const primaryUpText = await primaryUp.text()
      if (!primaryUp.ok) {
        throw new Error(`S3 primary ${primaryUp.status}: ${primaryUpText}`)
      }

      // 2) Build job payload
      const payload: any = {
        bucketKey: primarySigned.bucketKey,
        prompt: prompt.trim(),
        promptPreset: preset || undefined,
        aspect: aspect || '16:9',
        durationSec,
      }

      // 👉 This is where Photo 2 is wired to the actual public folder image
      if (secondChoice && selectedPrompt?.requiresSecond) {
        // e.g. "/source/Ruger.jpeg" or "/source/Poco.jpeg"
        payload.secondaryPublicPath = secondChoice.publicPath
      }

      const created = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())

      setJobId(created.jobId)
    } catch (err: any) {
      console.error('[Studio] submit error', err)
      alert(err?.message || 'Something went wrong while starting the job')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!jobId) return
    const t = setInterval(async () => {
      const j: Job = await fetch(`${API}/jobs/${jobId}`).then((r) => r.json())
      setJob(j)
      if (j.status === 'COMPLETE' || j.status === 'FAILED') clearInterval(t)
    }, 2500)
    return () => clearInterval(t)
  }, [jobId])

  const currentSecondOptions: SecondPhotoOption[] =
    selectedPrompt ? SECOND_PHOTO_OPTIONS[selectedPrompt.label] ?? [] : []

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        // Funky colourful background + Immersia logo ghosted in
        backgroundImage:
          'radial-gradient(circle at top left, #06b6d4 0, transparent 55%), ' +
          'radial-gradient(circle at bottom right, #f97316 0, transparent 55%), ' +
          'url("/immersia-logo.png")',
        backgroundSize: 'cover, cover, 420px',
        backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
        backgroundPosition: 'top left, bottom right, center',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 720,
          borderRadius: 24,
          padding: 20,
          background:
            'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(30,64,175,0.88))',
          border: '1px solid rgba(148,163,184,0.4)',
          boxShadow:
            '0 20px 45px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.8)',
          color: '#f9fafb',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* Header / branding */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 0.04,
              }}
            >
              Immersia AI Booth
            </h1>
            <p style={{ fontSize: 12, color: '#e5e7eb' }}>
              Drop your photo, pick a vibe, and let Immersia do the magic ✨
            </p>
          </div>
          <img
            src="/immersia-logo.png"
            alt="Immersia logo"
            style={{
              width: 56,
              height: 56,
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.7))',
            }}
          />
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
          {/* Two image slots */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 10,
                borderRadius: 16,
                border: '1px dashed rgba(148,163,184,0.6)',
                background:
                  'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(17,24,39,0.9))',
              }}
            >
              <p style={{ marginBottom: 4, fontSize: 11, color: '#a5b4fc' }}>
                Photo 1 (main) – required
              </p>
              <Uploader onPick={setPrimaryFile} />
            </div>

            <div
              style={{
                padding: 10,
                borderRadius: 16,
                border: '1px dashed rgba(148,163,184,0.5)',
                background:
                  'linear-gradient(145deg, rgba(17,24,39,0.9), rgba(30,64,175,0.75))',
              }}
            >
              <p style={{ marginBottom: 4, fontSize: 11, color: '#f9a8d4' }}>
                Photo 2 – auto (Ruger or Poco)
              </p>

              {currentSecondOptions.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  {currentSecondOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSecondChoice(opt)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        border:
                          secondChoice?.id === opt.id
                            ? '1px solid #f97316'
                            : '1px solid rgba(148,163,184,0.7)',
                        background:
                          secondChoice?.id === opt.id
                            ? 'linear-gradient(135deg, #f97316, #a855f7)'
                            : 'rgba(15,23,42,0.9)',
                        color: '#f9fafb',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow:
                          secondChoice?.id === opt.id
                            ? '0 0 14px rgba(249,115,22,0.7)'
                            : 'none',
                        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '999px',
                          overflow: 'hidden',
                          border: '1px solid rgba(15,23,42,0.8)',
                          background: '#020617',
                        }}
                      >
                        {/* tiny preview circle */}
                        <img
                          src={opt.publicPath}
                          alt={opt.label}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 11, color: '#e5e7eb' }}>
                  Pick <strong>Hug Ruger</strong> or <strong>Hug Poco</strong>{' '}
                  below to plug in their photo automatically.
                </p>
              )}
            </div>
          </div>

          {/* Default prompt chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DEFAULT_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setPrompt(p.text)
                  setSelectedPrompt(p)
                  const opts = SECOND_PHOTO_OPTIONS[p.label]
                  setSecondChoice(opts?.[0] ?? null)
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border:
                    selectedPrompt?.label === p.label
                      ? '1px solid #22c55e'
                      : '1px solid rgba(148,163,184,0.7)',
                  background:
                    selectedPrompt?.label === p.label
                      ? 'linear-gradient(135deg, #22c55e, #22d3ee)'
                      : 'rgba(15,23,42,0.9)',
                  color: '#f9fafb',
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow:
                    selectedPrompt?.label === p.label
                      ? '0 0 12px rgba(45,212,191,0.7)'
                      : 'none',
                  transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                }}
              >
                {p.label}
                {p.requiresSecond && ' • 2 photos'}
              </button>
            ))}
          </div>

          <input
            name="prompt"
            placeholder="Describe your animation..."
            required
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              setSelectedPrompt(null)
              setSecondChoice(null)
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.8)',
              background: 'rgba(15,23,42,0.9)',
              color: '#f9fafb',
              fontSize: 13,
              outline: 'none',
            }}
          />

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
          >
            <select
              name="preset"
              style={{
                padding: 8,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.8)',
                background: 'rgba(15,23,42,0.9)',
                color: '#e5e7eb',
                fontSize: 12,
              }}
            >
              <option value="">Style preset (optional)</option>
              <option>Energetic party trailer</option>
              <option>Friendly selfie animation</option>
              <option>Epic cinematic intro</option>
            </select>
            <input
              name="aspect"
              placeholder="16:9"
              defaultValue="16:9"
              style={{
                padding: 8,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.8)',
                background: 'rgba(15,23,42,0.9)',
                color: '#e5e7eb',
                fontSize: 12,
              }}
            />
          </div>

          <div>
            <label
              style={{ fontSize: 11, color: '#c4b5fd', marginBottom: 4 }}
            >
              Duration (seconds)
            </label>
            <input
              name="duration"
              type="number"
              min={3}
              max={20}
              defaultValue={5}
              style={{
                width: '100%',
                marginTop: 4,
                padding: 8,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.8)',
                background: 'rgba(15,23,42,0.9)',
                color: '#f9fafb',
                fontSize: 12,
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '10px 14px',
              borderRadius: 999,
              background: loading
                ? 'linear-gradient(135deg, #0f172a, #1e293b)'
                : 'linear-gradient(135deg, #22c55e, #06b6d4)',
              color: '#020617',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 0.04,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
              boxShadow: loading
                ? 'none'
                : '0 12px 25px rgba(34,197,94,0.45)',
              transform: loading ? 'none' : 'translateY(0)',
              transition: 'box-shadow 0.12s ease, transform 0.12s ease',
            }}
          >
            {loading ? 'Cooking your vibe… 🔄' : 'Generate with Immersia 🚀'}
          </button>
        </form>

        {job && (
          <div
            style={{
              border: '1px solid rgba(148,163,184,0.7)',
              borderRadius: 16,
              padding: 16,
              marginTop: 18,
              background: 'rgba(15,23,42,0.85)',
            }}
          >
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Job: {job.id}</h3>
            <p style={{ fontSize: 12, color: '#e5e7eb' }}>
              Status: <strong>{job.status}</strong>
            </p>
            <Progress stage={job.stage} />
            {job.status === 'FAILED' && (
              <p style={{ marginTop: 8, color: '#fca5a5', fontSize: 12 }}>
                This request could not be completed (content rules or provider
                error). Try a simpler, more generic prompt without real names.
              </p>
            )}
            {job.resultUrl && (
              <div style={{ marginTop: 12 }}>
                <video
                  src={job.resultUrl}
                  controls
                  style={{ width: '100%', borderRadius: 12 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <a
                    href={job.resultUrl}
                    download
                    style={{
                      fontSize: 12,
                      color: '#a5b4fc',
                      textDecoration: 'underline',
                    }}
                  >
                    Download
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
