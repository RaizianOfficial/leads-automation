const crypto = require('crypto');

/**
 * Generates an MD5 hash of the given message text to prevent duplicates.
 * @param {string} text - The message text.
 * @returns {string} - MD5 hash.
 */
function generateMessageHash(text) {
    if (!text) return '';
    return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
}

/**
 * Selects a random item from an array.
 * @param {Array} arr 
 * @returns {any}
 */
function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Micro-variations dictionary for generating highly unique, human-like messages.
 */
const dictionary = {
    greetings: [
        "Hi [NAME]",
        "Hello [NAME]",
        "Hey [NAME]",
        "Hi there [NAME]",
        "[NAME]! Hope you're having a good day",
        "Hey [NAME], hope you're doing well"
    ],
    closings: [
        "Let me know if you’d be open to a quick chat.",
        "Would you be open to exploring this briefly?",
        "Are you currently looking into this at all?",
        "If you're open to it, I'd love to share some ideas.",
        "Let me know if this sounds relevant to you.",
        "Does this sound like something you'd want to improve?"
    ],
    fallbackPitches: [
        "I noticed a few areas where your online presence could be optimized to bring in more local traffic.",
        "I was checking out local businesses and saw some quick wins you could apply to get more customers.",
        "I specialize in helping businesses like yours improve their digital footprint. Thought we might be a good fit to help."
    ]
};

/**
 * Base templates for the message body. 
 * They combine the variation elements dynamically.
 */
const templates = [
    (greet, prob, pitch, close) => `${greet},\n\nI was checking out local businesses and noticed ${prob}.\n\n${pitch} ${close}`,
    (greet, prob, pitch, close) => `${greet} 🙌\n\nI specialize in helping businesses like yours. I saw that ${prob}, which can sometimes hold things back.\n\n${pitch} ${close}`,
    (greet, prob, pitch, close) => `${greet}.\n\nI came across your profile and noticed ${prob}.\n\n${pitch} ${close}`,
    (greet, prob, pitch, close) => `${greet}!\n\nJust a quick note—I saw ${prob} while looking at your business online.\n\n${pitch}\n\n${close}`,
    (greet, prob, pitch, close) => `${greet},\n\nHope you don't mind the outreach. I noticed ${prob} and wanted to reach out.\n\n${pitch}\n\n${close}`,
    (greet, prob, pitch, close) => `${greet}. I was doing some research in your area and spotted that ${prob}.\n\n${pitch} ${close}`
];

/**
 * Generates a personalized WhatsApp message with micro-variations.
 * @param {Object} lead - The lead object containing name, problem, and pitch.
 * @returns {Object} - Contains the { text, hash, variation_id }
 */
function generatePersonalizedMessage(lead) {
    // 1. Extract first name nicely (fallback to "there" if single word or unknown)
    let firstName = 'there';
    if (lead.name && lead.name.toLowerCase() !== 'unknown') {
        const parts = lead.name.split(' ');
        if (parts[0].length > 1) {
            // Capitalize first letter of name
            firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
        }
    }

    // 2. Select micro-variations
    const greetTemplate = randomFrom(dictionary.greetings);
    const greeting = greetTemplate.replace('[NAME]', firstName);
    
    const closing = randomFrom(dictionary.closings);
    
    // 3. Clean up AI outputs (ensure they read naturally mid-sentence)
    let problem = lead.problem ? lead.problem.toLowerCase().trim() : 'there was room to improve your online presence';
    if (problem.endsWith('.')) problem = problem.slice(0, -1);
    
    let pitch = lead.pitch && lead.pitch !== 'N/A' && lead.pitch !== 'Error' 
        ? lead.pitch.trim() 
        : randomFrom(dictionary.fallbackPitches);

    // 4. Select a randomized structural template
    const templateIndex = Math.floor(Math.random() * templates.length);
    const selectedTemplate = templates[templateIndex];

    // 5. Assemble final message
    let messageText = selectedTemplate(greeting, problem, pitch, closing);

    // Fallback if the AI pitch generated an extremely long block of text (keep it conversational)
    if (messageText.length > 500) {
        messageText = `${greeting},\n\nI was looking at your online presence and thought there might be a few areas where we could help improve your digital footprint.\n\n${closing}`;
    }

    // 6. Generate duplicate-prevention hash
    const messageHash = generateMessageHash(messageText);

    return {
        text: messageText,
        hash: messageHash,
        variation_id: `tpl_${templateIndex}`
    };
}

module.exports = { 
    generatePersonalizedMessage,
    generateMessageHash 
};
