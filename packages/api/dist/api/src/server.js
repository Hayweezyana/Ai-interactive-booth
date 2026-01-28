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
const prisma_1 = require("@shared/prisma");
const storage_1 = require("./utils/storage");
const API_BASE = process.env.APP_ORIGIN || 'http://localhost:4000';
const API = `${API_BASE}`;
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: API,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
app.use((0, morgan_1.default)('dev'));
console.log('ROUTER FILE LOADED');
// Add root redirect to /studio
app.use('/api', routes_1.router);
app.get('/health', (_req, res) => res.json({ message: 'API is running 🚀' }));
app.get('/', (_req, res) => {
    res.redirect('/studio');
});
app.get('/v/:slug', async (req, res) => {
    try {
        const share = await prisma_1.prisma.share.findUnique({
            where: { slug: req.params.slug },
            include: {
                job: { include: { resultVideo: true } },
            },
        });
        if (!share) {
            return res.status(404).send('Invalid link');
        }
        if (!share.job.resultVideo) {
            return res
                .status(200)
                .send('Your video is still processing. Please refresh shortly.');
        }
        const url = (0, storage_1.publicUrl)(share.job.resultVideo.bucketKey);
        return res.redirect(url);
    }
    catch (e) {
        console.error('[share]', e);
        return res.status(500).send('Internal error');
    }
});
// Error handler should be AFTER routes
app.use((err, _req, res, _next) => {
    console.error('[unhandled]', err);
    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err?.message || 'Unexpected error',
    });
});
const port = Number(process.env.PORT) || 4000;
// ⚠️ CRITICAL: Bind to 0.0.0.0 for Railway/cloud platforms
app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on port ${port}`);
    console.log(`Health check: http://0.0.0.0:${port}/health`);
});
