"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAsBase64 = fetchAsBase64;
const axios_1 = __importDefault(require("axios"));
async function fetchAsBase64(url) {
    const response = await axios_1.default.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
}
