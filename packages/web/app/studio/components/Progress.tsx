'use client';
export function Progress({ stage }: { stage?: string }) {
const steps = ['QUEUED','GEMINI_PREP','VIDEO_GENERATE','COMPLETE'];
return (
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
{steps.map(s => (
<span key={s} style={{ padding: '4px 8px', borderRadius: 8, background: s===stage? '#2563eb' : '#27272a' }}>{s}</span>
))}
</div>
);
}