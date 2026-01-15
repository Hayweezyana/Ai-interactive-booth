'use client'

import { useEffect, useState, FormEvent } from 'react'
import { Uploader } from './components/Uploader'
import { Progress } from './components/Progress'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000'
const API = `${API_BASE}/api`


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
    text: `
make the image of the person in the first photo hug the second person from the second photo professionally and naturally, wide angle and portrait.

Use the provided reference images as visual inspiration for the general look
and style of the people, while creating a new, original image.

Guidelines:
- Both faces clearly visible
- Natural expressions and relaxed body language
- Realistic lighting and everyday photography style
- Casual clothing
- No dramatic filters or cinematic effects

This is a newly created image inspired by the references.`,
    requiresSecond: true,
  },
  {
    label: 'Hug Poco',
    text: `
make the image of the person in the first photo hug the second person from the second photo professionally and naturally, wide angle and portrait.

Use the provided reference images as visual inspiration for the general look
and style of the people, while creating a new, original image.

Guidelines:
- Both faces clearly visible
- Natural expressions and relaxed body language
- Realistic lighting and everyday photography style
- Casual clothing
- No dramatic filters or cinematic effects

This is a newly created image inspired by the references.
`,
    requiresSecond: true,
  },
  {
    label: 'Superhero intro',
    text: `
Create a natural-looking, wide-angle photo of two people hugging and smiling
at the camera in a friendly, casual moment.

Use the provided reference images as visual guidance for overall appearance
and recognizable likeness. The generated people should resemble the individuals
shown, while remaining a newly created image.

Guidelines:
- Both faces clearly visible
- Consistent facial traits and hairstyles inspired by the references
- Natural expressions and relaxed body language
- Realistic lighting and everyday photography style
- No heavy filters or dramatic stylization

This is a recreation inspired by the reference images, not an exact copy.
`,
    requiresSecond: false,
  },
  {
    label: 'Friends selfie (2 photos)',
    text: `
Create a casual selfie-style image of two people celebrating together.

Use the provided reference images as visual guidance so the generated people
closely resemble the individuals shown, while remaining a new image.

Guidelines:
- Smartphone selfie perspective
- Natural expressions and lighting
- Both faces clearly visible
- No beautification filters
`,
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

  async function uploadToS3(fileOrBlob: File | Blob, mimeType: string) {
    // A. Get Signed URL
    const signRes = await fetch(`${API}/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mime: mimeType }),
    })

    if (!signRes.ok) throw new Error('Failed to get upload URL')
    const signed = await signRes.json()

    const fd = new FormData()
    Object.entries(signed.fields).forEach(([k, v]) =>
      fd.append(k, String(v)),
    )
    fd.append('Content-Type', mimeType)
    fd.append('file', fileOrBlob)

    const uploadRes = await fetch(signed.url, {
      method: 'POST',
      body: fd,
    })

    if (!uploadRes.ok) throw new Error('Failed to upload to S3')

    return signed.bucketKey as string
  }

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
      let secondaryKey: string | undefined

      // 👉 This is where Photo 2 is wired to the actual public folder image
      if (secondChoice && selectedPrompt?.requiresSecond) {
        console.log('[Studio] Uploading preset image:', secondChoice.publicPath)

        try {
        const res = await fetch(secondChoice.publicPath)
        if (!res.ok) {
            throw new Error(`Failed to fetch preset image: ${res.status} ${res.statusText}`)
          }

          const contentType = res.headers.get('content-type') || ''
          console.log('[Studio] Preset image Content-Type:', contentType)

          if (!contentType.startsWith('image/')) {
            const text = await res.text()
            console.error('[Studio] ERROR: Not an image!', text.slice(0, 200))
            throw new Error(`Preset image URL returned ${contentType}, not an image`)
          }

        const blob = await res.blob()
        console.log('[Studio] Preset image blob size:', blob.size, 'type:', blob.type)
        
        // Upload it to S3
        secondaryKey = await uploadToS3(blob, blob.type || 'image/jpeg')
        console.log('[Studio] Preset image uploaded to S3:', secondaryKey)
        } catch (err: any) {
          console.error('[Studio] Failed to upload preset image:', err)
          alert(`Failed to upload preset image (${secondChoice.label}): ${err?.message || 'Unknown error'}`)
          throw err
        }
      }

      const payload: any = {
        bucketKey: primarySigned.bucketKey,          // The main user image
        secondaryBucketKey: secondaryKey, // The uploaded preset image (Ruger/Poco)
        prompt: prompt.trim(),
        promptPreset: String(formData.get('preset') || ''),
        aspect: String(formData.get('aspect') || '16:9'),
        durationSec: Number(formData.get('duration') || 8),
      }

      const created = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())

      setJobId(created.jobId)
    } catch (err: any) {
      console.error('[Studio] submit error', err)
      alert(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }
  //       // e.g. "/source/Ruger.jpeg" or "/source/Poco.jpeg"
  //       payload.secondaryPublicPath = secondChoice.publicPath
  //     }

  //     const created = await fetch(`${API}/jobs`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(payload),
  //     }).then((r) => r.json())

  //     setJobId(created.jobId)
  //   } catch (err: any) {
  //     console.error('[Studio] submit error', err)
  //     alert(err?.message || 'Something went wrong while starting the job')
  //   } finally {
  //     setLoading(false)
  //   }
  // }

useEffect(() => {
  if (!jobId) return;

  const t = setInterval(async () => {
    try {
      const res = await fetch(`${API}/jobs/${jobId}`);
      if (!res.ok) return;
      
      const j: Job = await res.json();
      setJob(j);

      // Match the status your worker actually sends (usually COMPLETED)
      if (j.status === 'COMPLETED' || j.status === 'FAILED') {
        clearInterval(t);
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  }, 3000);

  return () => clearInterval(t);
}, [jobId]);

  const currentSecondOptions: SecondPhotoOption[] =
    selectedPrompt ? SECOND_PHOTO_OPTIONS[selectedPrompt.label] ?? [] : []

  
    return (
  <div style={{
    minHeight: '100vh',
    padding: '40px 20px',
    backgroundColor: '#0f172a',
    backgroundImage: `
      radial-gradient(circle at 0% 0%, rgba(6, 182, 212, 0.15) 0, transparent 50%),
      radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.15) 0, transparent 50%)
    `,
    display: 'flex',
    justifyContent: 'center',
    fontFamily: 'Inter, system-ui, sans-serif'
  }}>
    <div style={{
      width: '100%',
      maxWidth: '640px',
      backgroundColor: 'rgba(30, 41, 59, 0.7)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      padding: '32px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      color: '#f8fafc'
    }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', background: 'linear-gradient(to right, #22d3ee, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Immersia AI Studio
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Transform your photos into cinematic moments</p>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Upload Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#38bdf8', marginBottom: '8px', fontWeight: 600 }}>PRIMARY PHOTO</label>
            <Uploader onPick={setPrimaryFile} />
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#fb7185', marginBottom: '8px', fontWeight: 600 }}>GUEST STAR</label>
            {currentSecondOptions.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                {currentSecondOptions.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSecondChoice(opt)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '12px',
                      border: secondChoice?.id === opt.id ? '2px solid #38bdf8' : '1px solid transparent',
                      background: '#1e293b',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <img src={opt.publicPath} style={{ width: '100%', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <span style={{ fontSize: '10px', color: '#fff' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', paddingTop: '10px' }}>Select a "2 photo" vibe below</div>
            )}
          </div>
        </div>

        {/* Prompt Chips */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>CHOOSE A VIBE</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {DEFAULT_PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setPrompt(p.text);
                  setSelectedPrompt(p);
                  setSecondChoice(SECOND_PHOTO_OPTIONS[p.label]?.[0] ?? null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '99px',
                  fontSize: '13px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: selectedPrompt?.label === p.label ? '#38bdf8' : 'rgba(255,255,255,0.05)',
                  color: selectedPrompt?.label === p.label ? '#0f172a' : '#f8fafc',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Refine your prompt here..."
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '16px',
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            minHeight: '80px',
            outline: 'none',
            fontSize: '14px'
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '16px',
            borderRadius: '16px',
            background: 'linear-gradient(to right, #06b6d4, #10b981)',
            color: '#0f172a',
            fontWeight: 800,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            boxShadow: '0 10px 15px -3px rgba(6, 182, 212, 0.3)'
          }}
        >
          {loading ? 'UPLOADING...' : 'GENERATE ANIMATION'}
        </button>
      </form>

      {/* Progress & Result */}
      {job && (
        <div style={{
          marginTop: '32px',
          padding: '24px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '20px',
          border: '1px solid rgba(56, 189, 248, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>JOB ID: {job.id.slice(-6)}</span>
            <span style={{ fontSize: '12px', padding: '4px 12px', background: '#334155', borderRadius: '99px' }}>{job.status}</span>
          </div>
          
          <Progress stage={job.stage} />

          {job.resultUrl && (
            <div style={{ marginTop: '20px' }}>
              <video src={job.resultUrl} controls autoPlay style={{ width: '100%', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }} />
              <a href={job.resultUrl} download style={{ display: 'block', textAlign: 'center', marginTop: '16px', color: '#38bdf8', fontSize: '14px', textDecoration: 'none' }}>
                Download Video ↓
              </a>
              {job && job.status === 'COMPLETED' && (
  <div style={{ marginTop: 24 }}>
    <h3>Share your video</h3>

    <img
      src={`${API}/jobs/${job.id}/qr`}
      alt="QR Code"
      style={{ width: 200 }}
    />

    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget as HTMLFormElement
        const email = (form.elements.namedItem('email') as HTMLInputElement).value

        await fetch(`${API}/jobs/${job.id}/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: email }),
        })

        alert('Email sent!')
      }}
    >
      <input
        name="email"
        type="email"
        placeholder="Enter email"
        required
        style={{ padding: 8, marginTop: 8 }}
      />
      <button type="submit">Send Email</button>
    </form>
  </div>
)}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
  )
}
