export const metadata = { title: 'Immersia AI Video Studio' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="en">
<body style={{ fontFamily: 'system-ui, sans-serif', background: '#0b0b0c', color: '#f4f4f5' }}>
<div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
<h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Immersia AI Video Studio</h1>
{children}
</div>
</body>
</html>
);
}