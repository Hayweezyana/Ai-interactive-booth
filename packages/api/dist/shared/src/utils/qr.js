"use strict";
// @shared/utils/qr.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQR = generateQR;
exports.generateQRDataURL = generateQRDataURL;
const qrcode_1 = __importDefault(require("qrcode"));
async function generateQR(data) {
    try {
        console.log('[generateQR] Generating QR for:', data);
        const buffer = await qrcode_1.default.toBuffer(data, {
            margin: 1,
            width: 512,
            errorCorrectionLevel: 'H', // High error correction
            type: 'png',
            color: {
                dark: '#000000', // QR code color
                light: '#FFFFFF', // Background color
            },
        });
        console.log('[generateQR] Generated buffer size:', buffer.length, 'bytes');
        return buffer;
    }
    catch (error) {
        console.error('[generateQR] Error:', error);
        throw new Error(`QR generation failed: ${error.message}`);
    }
}
// Alternative: Generate as data URL for testing
async function generateQRDataURL(data) {
    try {
        return await qrcode_1.default.toDataURL(data, {
            margin: 1,
            width: 512,
            errorCorrectionLevel: 'H',
        });
    }
    catch (error) {
        console.error('[generateQRDataURL] Error:', error);
        throw new Error(`QR data URL generation failed: ${error.message}`);
    }
}
