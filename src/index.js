require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { runPipeline } = require('./pipeline/leadPipeline');
const { initWhatsApp, isWhatsAppConnected } = require('./services/whatsappService');

// ─────────────────────────────────────────────────────────
// ENV GUARD — Only warn in full pipeline mode
// ─────────────────────────────────────────────────────────
const IS_SETUP_MODE = process.env.SETUP_MODE === 'true';
const IS_RUN_ONCE   = process.env.RUN_ONCE   === 'true';

if (!IS_SETUP_MODE && (!process.env.SERP_API_KEY || !process.env.GEMINI_API_KEY)) {
    console.warn('\n⚠️  WARNING: External API Keys (SERP / GEMINI) are not set. Pipeline may fail.\n');
}

// ─────────────────────────────────────────────────────────
// EXPRESS APP SETUP (health + manual trigger)
// ─────────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        whatsapp_connected: isWhatsAppConnected(),
        mode: IS_SETUP_MODE ? 'SETUP' : 'PIPELINE',
        message: 'Antigravity AI Lead Generator is running.'
    });
});

app.post('/trigger-pipeline', async (req, res) => {
    if (IS_SETUP_MODE) {
        return res.status(403).json({ error: 'Pipeline is disabled in SETUP_MODE. Set SETUP_MODE=false to enable.' });
    }
    if (!isWhatsAppConnected()) {
        return res.status(503).json({ error: 'WhatsApp is not connected. Scan the QR code first, then try again.' });
    }
    try {
        console.log('Manual trigger of the pipeline started via API endpoint.');
        runPipeline().catch(console.error);
        res.status(202).json({ message: 'Pipeline triggered. Check console for execution logs.' });
    } catch (error) {
        console.error('Failed to run manual pipeline trigger:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────
// BOOT SEQUENCE
// ─────────────────────────────────────────────────────────
async function boot() {

    // STEP A: Always initialize WhatsApp first
    console.log('\n🔌 Initializing WhatsApp connection...');
    await initWhatsApp().catch(err => console.error('❌ WhatsApp init failed:', err));

    // ── SETUP MODE BRANCH ──────────────────────────────
    if (IS_SETUP_MODE) {
        console.log('\n============================================');
        console.log('⚙️  SETUP MODE ACTIVE');
        console.log('============================================');
        console.log('✅ WhatsApp is initializing — scan the QR code above.');
        console.log('🚫 Lead pipeline, Gemini, SerpAPI — ALL DISABLED.');
        console.log('ℹ️  Once QR is scanned, set SETUP_MODE=false and restart.');
        console.log('============================================\n');
        // Keep the process alive so the QR can be scanned and session saved
        return; // Stop here — no cron, no pipeline
    }

    // ── PIPELINE MODE BRANCH ───────────────────────────
    console.log('\n===========================================');
    console.log('🚀 Antigravity Agent: Node Backend Started');
    console.log('===========================================');
    console.log(`PORT: ${port} | ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`City: ${process.env.TARGET_CITY} | Niche: ${process.env.TARGET_NICHE}`);
    console.log(`Daily Limit: ${process.env.DAILY_LEAD_LIMIT}`);
    console.log(`CRON Schedule: '${process.env.CRON_SCHEDULE || '0 5 * * *'}'\n`);

    // STEP B: Gate the pipeline behind a WhatsApp connection check
    if (!isWhatsAppConnected()) {
        console.warn('\n⚠️  WhatsApp is not connected yet. Cron will still start, but each run will abort if WA drops.\n');
    }

    // STEP C: Schedule the daily cron
    const cronExpression = process.env.CRON_SCHEDULE || '0 5 * * *';

    if (cron.validate(cronExpression)) {
        console.log(`📅 Scheduling daily pipeline run at: ${cronExpression} (Server Time)`);
        cron.schedule(cronExpression, async () => {
            console.log('\n⏰ CRON TRIGGERED: Starting Lead Generation Pipeline...');
            if (!isWhatsAppConnected()) {
                console.error('❌ CRON ABORTED: WhatsApp is not connected. Skipping this run.');
                return;
            }
            try {
                await runPipeline();
            } catch (err) {
                console.error('❌ Error during scheduled pipeline run:', err);
            }
        });
    } else {
        console.error(`❌ Invalid cron expression: ${cronExpression}`);
    }
}

// ─────────────────────────────────────────────────────────
// EXECUTION MODES
// ─────────────────────────────────────────────────────────

// MODE 1: GitHub Actions / CI (run once and exit)
if (IS_RUN_ONCE) {
    console.log('⚡ Running in RUN_ONCE mode for CI/CD Pipeline...');
    runPipeline()
        .then(() => {
            console.log('✅ Pipeline execution complete. Exiting gracefully.');
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Pipeline failed:', err);
            process.exit(1);
        });

// MODE 2: Server daemon (VPS / local dev) — with Setup or Pipeline mode
} else {
    app.listen(port, () => {
        console.log(`\n🌐 HTTP server listening on port ${port}`);
        boot(); // Async boot (WA init → mode decision → cron)
    });
}
