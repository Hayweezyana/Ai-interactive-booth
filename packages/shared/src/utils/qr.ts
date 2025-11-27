import QR from 'qrcode';
export async function generateQR(data: string): Promise<Buffer> {
return QR.toBuffer(data, { margin: 1, width: 512 });
}