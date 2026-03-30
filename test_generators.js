const { generatePersonalizedMessage } = require('./src/utils/messageGenerator');

const dummyLead = {
    name: "John Doe",
    problem: "your website takes too long to load on mobile",
    pitch: "I can help you decrease load times by 40% using modern edge caching."
};

console.log('--- SAMPLE MESSAGE GENERATIONS ---');
for (let i = 1; i <= 3; i++) {
    const msg = generatePersonalizedMessage(dummyLead);
    console.log(`\nExample ${i} (ID: ${msg.variation_id}, Hash: ${msg.hash}):\n${msg.text}`);
}
