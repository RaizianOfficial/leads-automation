require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { runPipeline } = require('./pipeline/leadPipeline');

// Ensure essential environment variables are loaded
if (!process.env.SERP_API_KEY || !process.env.GEMINI_API_KEY) {
    console.warn('\n⚠️ WARNING: External API Keys are not set. The application might not function correctly if required settings are missing.');
}

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// Basic health-check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Antigravity AI Lead Generator is running.' });
});

// Manual trigger route for testing
app.post('/trigger-pipeline', async (req, res) => {
    try {
        console.log('Manual trigger of the pipeline started via API endpoint.');
        // Run asynchronously so we don't block the HTTP response completely
        // Wait, for manual triggers we might want to wait, or just acknowledge
        runPipeline().catch(console.error);
        res.status(202).json({ message: 'Pipeline triggered. Execution logs will be visible in the console.' });
    } catch (error) {
        console.error('Failed to run manual pipeline trigger:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log('\n===========================================');
    console.log('🚀 Antigravity Agent: Node Backend Started');
    console.log('===========================================');
    console.log(`Running on PORT: ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Target City: ${process.env.TARGET_CITY}`);
    console.log(`Target Niche: ${process.env.TARGET_NICHE}`);
    console.log(`Daily Limit: ${process.env.DAILY_LEAD_LIMIT}`);
    console.log(`CRON Schedule: '${process.env.CRON_SCHEDULE || '0 5 * * *'}'\n`);
    
    // START CRON SCHEDULE
    const cronExpression = process.env.CRON_SCHEDULE || '0 5 * * *';
    
    if (cron.validate(cronExpression)) {
        console.log(`Scheduling daily pipeline run at: ${cronExpression} (Server Time)`);
        cron.schedule(cronExpression, async () => {
            console.log(`\n⏰ CRON TRIGGERED: Starting Lead Generation Pipeline...`);
            try {
                await runPipeline();
            } catch (err) {
                console.error('Error during scheduled pipeline run:', err);
            }
        });
    } else {
        console.error(`❌ Invalid cron expression: ${cronExpression}`);
    }
});
