require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { runPipeline } = require('./src/pipeline/leadPipeline');
const { initWhatsApp, isWhatsAppConnected, pollReplies } = require('./src/services/whatsappService');

// ─────────────────────────────────────────────────────────
// ENV FLAGS
// ─────────────────────────────────────────────────────────
const IS_RUN_ONCE = process.env.RUN_ONCE === 'true';

if (!process.env.SERP_API_KEY || !process.env.GEMINI_API_KEY) {
    console.warn('\n⚠️  WARNING: SERP_API_KEY or GEMINI_API_KEY not set. Pipeline may fail.\n');
}

// ─────────────────────────────────────────────────────────
// EXPRESS APP
// ─────────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());

app.get('/health', async (req, res) => {
    const waConnected = await isWhatsAppConnected();
    res.status(200).json({
        status: 'OK',
        whatsapp_connected: waConnected,
        message: 'Antigravity AI Lead Generator is running.'
    });
});

app.post('/trigger-pipeline', async (req, res) => {
    const waConnected = await isWhatsAppConnected();
    if (!waConnected) {
        return res.status(503).json({
            error: 'WhatsApp is not connected. Link your number on the Green API dashboard first.'
        });
    }
    try {
        console.log('🔁 Manual pipeline trigger via /trigger-pipeline...');
        runPipeline().catch(console.error);
        res.status(202).json({ message: 'Pipeline triggered. Check console for logs.' });
    } catch (error) {
        console.error('Failed to trigger pipeline:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
async function boot() {
    // Step 1: Check WhatsApp state (Green API — no QR needed here)
    await initWhatsApp();

    console.log('\n===========================================');
    console.log('🚀 Antigravity Agent: Node Backend Started');
    console.log('===========================================');
    console.log(`PORT: ${port} | ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`City: ${process.env.TARGET_CITY} | Niche: ${process.env.TARGET_NICHE}`);
    console.log(`Daily Limit: ${process.env.DAILY_LEAD_LIMIT}`);

    // Step 2: Schedule daily pipeline
    const cronExpression = process.env.CRON_SCHEDULE || '30 23 * * *'; // 5 AM IST
    if (cron.validate(cronExpression)) {
        console.log(`\n📅 Pipeline scheduled: ${cronExpression} (UTC)`);
        cron.schedule(cronExpression, async () => {
            console.log('\n⏰ CRON TRIGGERED: Starting Lead Pipeline...');
            const waOk = await isWhatsAppConnected();
            if (!waOk) {
                console.error('❌ ABORTED: WhatsApp not connected. Check Green API dashboard.');
                return;
            }
            try {
                await runPipeline();
            } catch (err) {
                console.error('❌ Pipeline error:', err);
            }
        });
    } else {
        console.error(`❌ Invalid cron expression: ${cronExpression}`);
    }

    // Step 3: Poll for incoming replies every 30 seconds
    setInterval(async () => {
        await pollReplies();
    }, 30 * 1000);

    console.log('💬 Reply polling: active (every 30s)\n');
}

// ─────────────────────────────────────────────────────────
// EXECUTION ENTRY
// ─────────────────────────────────────────────────────────

// CI/CD mode: run once and exit
if (IS_RUN_ONCE) {
    console.log('⚡ RUN_ONCE mode (CI/CD)...');
    runPipeline()
        .then(() => { console.log('✅ Done.'); process.exit(0); })
        .catch(err => { console.error('❌ Failed:', err); process.exit(1); });

// Server daemon mode (VPS / local)
} else {
    app.listen(port, () => {
        console.log(`\n🌐 HTTP server listening on port ${port}`);
        boot();
    });
}
