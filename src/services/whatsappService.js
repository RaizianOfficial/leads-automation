const axios = require('axios');
const { updateLeadMeta, logReply } = require('./db');
const { randomDelay } = require('../utils/delay');
const { generatePersonalizedMessage } = require('../utils/messageGenerator');

// ─── Config ───────────────────────────────────────────────
const INSTANCE_ID    = process.env.GREEN_API_INSTANCE_ID;
const INSTANCE_TOKEN = process.env.GREEN_API_TOKEN;
const BASE_URL       = `https://api.green-api.com/waInstance${INSTANCE_ID}`;
const DAILY_LIMIT    = Number(process.env.DAILY_LEAD_LIMIT) || 30;

// ─── Helpers ──────────────────────────────────────────────

/**
 * Converts a phone number to Green API chatId format.
 * e.g., "9876543210" → "919876543210@c.us"
 * @param {string} phone
 * @returns {string}
 */
function formatChatId(phone) {
    let digits = String(phone).replace(/\D/g, '');
    // Prepend India country code if 10 digits
    if (digits.length === 10) digits = `91${digits}`;
    return `${digits}@c.us`;
}

/**
 * Checks if Green API credentials are configured.
 * @returns {boolean}
 */
function isConfigured() {
    return !!(INSTANCE_ID && INSTANCE_TOKEN);
}

/**
 * Returns true if the Green API instance is authenticated and connected.
 * Used by index.js to gate pipelines.
 * @returns {Promise<boolean>}
 */
async function isWhatsAppConnected() {
    if (!isConfigured()) return false;
    try {
        const res = await axios.get(`${BASE_URL}/getStateInstance/${INSTANCE_TOKEN}`);
        const state = res.data?.stateInstance;
        return state === 'authorized';
    } catch {
        return false;
    }
}

/**
 * Checks and logs the current Green API instance state.
 * Called on boot — replaces Baileys' initWhatsApp().
 */
async function initWhatsApp() {
    if (!isConfigured()) {
        console.warn('\n⚠️  GREEN_API_INSTANCE_ID / GREEN_API_TOKEN not set in .env. WhatsApp disabled.');
        return;
    }

    console.log('🔍 Checking Green API instance state...');
    try {
        const res = await axios.get(`${BASE_URL}/getStateInstance/${INSTANCE_TOKEN}`);
        const state = res.data?.stateInstance;

        if (state === 'authorized') {
            console.log('✅ WhatsApp (Green API) is CONNECTED and authorized.');
        } else if (state === 'notAuthorized') {
            console.log('\n══════════════════════════════════════════════════════');
            console.log('📱  WHATSAPP NOT LINKED — Follow these steps to connect:');
            console.log('══════════════════════════════════════════════════════');
            console.log('1. Go to → https://console.green-api.com/');
            console.log('2. Open your instance → click "Scan QR Code"');
            console.log('3. Open WhatsApp on phone → Linked Devices → Link a Device');
            console.log('4. Scan the QR code shown on the Green API dashboard');
            console.log('5. Restart this app after linking');
            console.log('══════════════════════════════════════════════════════\n');
        } else {
            console.warn(`⚠️  Instance state: "${state}". Check your Green API dashboard.`);
        }
    } catch (err) {
        console.error('❌ Could not reach Green API:', err.message);
    }
}

/**
 * Sends a single WhatsApp message via Green API.
 * @param {string} phone - Recipient phone number.
 * @param {string} text  - Message body.
 * @returns {Promise<boolean>}
 */
async function sendMessage(phone, text) {
    if (!isConfigured()) {
        console.error('❌ Green API not configured. Cannot send message.');
        return false;
    }

    const chatId = formatChatId(phone);
    const url    = `${BASE_URL}/sendMessage/${INSTANCE_TOKEN}`;

    try {
        const res = await axios.post(url, { chatId, message: text });
        if (res.data?.idMessage) {
            console.log(`✅ Message sent to ${phone}  (msgId: ${res.data.idMessage})`);
            return true;
        }
        console.warn(`⚠️  Sent to ${phone} but no idMessage returned:`, res.data);
        return false;
    } catch (err) {
        const detail = err.response?.data || err.message;
        console.error(`❌ Failed to send to ${phone}:`, detail);
        return false;
    }
}

/**
 * Sends personalized WhatsApp messages to a batch of leads.
 * Applies anti-ban delays and updates Firestore per lead.
 * @param {Array} leads
 */
async function sendBulkMessages(leads) {
    if (!isConfigured()) {
        console.warn('⚠️  Green API not configured. Skipping WhatsApp outreach.');
        return;
    }

    if (!leads || leads.length === 0) {
        console.log('No leads provided for WhatsApp messaging.');
        return;
    }

    // Safety cap — respect daily limit
    const batch = leads.slice(0, DAILY_LIMIT);
    console.log(`\n--- STEP 9: WhatsApp Outreach via Green API (${batch.length} leads) ---`);

    // Anti-ban: pause before starting batch
    console.log('[Anti-Ban] Warming up — waiting 10s before first message...');
    await randomDelay(10, 15);

    let sentCount = 0;

    for (const lead of batch) {
        if (!lead.phone) {
            console.warn(`⚠️  Skipping lead "${lead.name}" — no phone number.`);
            continue;
        }

        const messageBody = generatePersonalizedMessage(lead);
        console.log(`\n📤 Sending to: ${lead.name} (${lead.phone})`);

        const success = await sendMessage(lead.phone, messageBody);

        if (success) {
            sentCount++;
            await updateLeadMeta(lead.phone, {
                message_sent: true,
                sent_at: new Date().toISOString(),
                status: 'cold' // Will upgrade to 'warm' if they reply
            });
        }

        // Anti-ban: random pause between every message (even on failure)
        if (sentCount < batch.length) {
            await randomDelay(30, 90);
        }
    }

    console.log(`\n🎉 WhatsApp Batch Done: ${sentCount}/${batch.length} sent.`);
}

/**
 * Polls Green API for incoming messages and logs replies to Firestore.
 * Call this on a timer (e.g., every 30s) to track responses.
 */
async function pollReplies() {
    if (!isConfigured()) return;

    try {
        const url = `${BASE_URL}/receiveNotification/${INSTANCE_TOKEN}`;
        const res = await axios.get(url);
        const notification = res.data;

        if (!notification || !notification.body) return; // Nothing in queue

        const { receiptId, body } = notification;
        const msgType = body?.typeWebhook;

        if (msgType === 'incomingMessageReceived') {
            const senderId = body.senderData?.chatId;
            const text = body.messageData?.textMessageData?.textMessage;

            if (senderId && text && !senderId.includes('@g.us')) {
                const phoneId = senderId.replace('@c.us', '');
                console.log(`\n💬 Reply from ${phoneId}: "${text}"`);
                await logReply(phoneId, text);
            }
        }

        // Acknowledge & delete notification from queue so we don't re-read it
        await axios.delete(`${BASE_URL}/deleteNotification/${INSTANCE_TOKEN}/${receiptId}`);

    } catch (err) {
        // Silent — polling errors are non-critical
        console.warn('[Green API Poll]', err.message);
    }
}

module.exports = {
    initWhatsApp,
    isWhatsAppConnected,
    sendMessage,
    sendBulkMessages,
    pollReplies
};
