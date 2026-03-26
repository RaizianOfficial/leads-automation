require('dotenv').config();
const { runPipeline } = require('./src/pipeline/leadPipeline');

/**
 * Main function to execute the lead intelligence pipeline.
 */
async function main() {
    try {
        console.log(`Pipeline execution started at: ${new Date().toISOString()}`);
        
        // Execute the complete lead intelligence pipeline
        await runPipeline();

        console.log(`Pipeline execution finished successfully at: ${new Date().toISOString()}`);
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL FATAL ERROR IN PIPELINE:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Start the automation
main();
