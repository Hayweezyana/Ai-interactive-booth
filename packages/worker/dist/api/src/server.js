"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const routes_1 = require("./routes");
console.log('[AWS env]', {
    id: process.env.S3_ACCESS_KEY_ID,
    region: process.env.S3_REGION || process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET
});
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '2mb' }));
app.use((0, morgan_1.default)('dev'));
app.use('/api', routes_1.router);
app.get('/health', (_req, res) => res.json({ message: 'API is running 🚀' }));
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
app.use((err, _req, res, _next) => {
    console.error('[unhandled]', err);
    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err?.message || 'Unexpected error',
    });
});
