// @shared/utils/qr.ts

import QRCode from 'qrcode'

export async function generateQR(data: string): Promise<Buffer> {
  try {
    console.log('[generateQR] Generating QR for:', data)
    
    const buffer = await QRCode.toBuffer(data, {
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'H', // High error correction
      type: 'png',
      color: {
        dark: '#000000',  // QR code color
        light: '#FFFFFF', // Background color
      },
    })
    
    console.log('[generateQR] Generated buffer size:', buffer.length, 'bytes')
    
    return buffer
  } catch (error: any) {
    console.error('[generateQR] Error:', error)
    throw new Error(`QR generation failed: ${error.message}`)
  }
}

// Alternative: Generate as data URL for testing
export async function generateQRDataURL(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'H',
    })
  } catch (error: any) {
    console.error('[generateQRDataURL] Error:', error)
    throw new Error(`QR data URL generation failed: ${error.message}`)
  }
}