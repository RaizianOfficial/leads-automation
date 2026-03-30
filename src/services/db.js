const { db } = require('../config/firebase');

/**
 * Saves or updates a lead in the "leads" collection.
 * @param {Object} lead - The lead object.
 */
async function saveLead(lead) {
    if (!lead.phone) return;
    
    // Clean phone number to use as an ID (remove spaces, symbols)
    const phoneId = String(lead.phone).replace(/[^\d+]/g, '') || String(lead.phone);
    
    const leadRef = db.collection('leads').doc(phoneId);
    
    await leadRef.set({
        ...lead,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Checks if a lead has already been sent by checking "sent_leads" collection.
 * @param {string} phone - The phone number of the lead.
 * @returns {Promise<boolean>} - True if it exists, false otherwise.
 */
async function isLeadSent(phone) {
    if (!phone) return false;
    
    const phoneId = String(phone).replace(/[^\d+]/g, '') || String(phone);
    const sentLeadDoc = await db.collection('sent_leads').doc(phoneId).get();
    
    return sentLeadDoc.exists;
}

/**
 * Marks a lead as sent by adding it to "sent_leads" collection.
 * @param {Object} lead - The lead that was sent.
 */
async function markLeadAsSent(lead) {
    if (!lead.phone) return;
    
    const phoneId = String(lead.phone).replace(/[^\d+]/g, '') || String(lead.phone);
    
    const sentLeadRef = db.collection('sent_leads').doc(phoneId);
    
    await sentLeadRef.set({
        phone: lead.phone,
        name: lead.name,
        sentDate: new Date().toISOString()
    });
}

/**
 * Updates metadata for a lead in Firestore.
 * @param {string} phone - Target phone number.
 * @param {Object} data - Metadata object to merge.
 */
async function updateLeadMeta(phone, data) {
    if (!phone) return;
    
    const phoneId = String(phone).replace(/[^\d+]/g, '') || String(phone);
    const leadRef = db.collection('leads').doc(phoneId);
    
    await leadRef.set(data, { merge: true });
}

/**
 * Logs an incoming WhatsApp reply and sets lead status to 'warm'.
 * @param {string} phoneId - Caller's phone ID.
 * @param {string} messageText - The text of the reply.
 */
async function logReply(phoneId, messageText) {
    if (!phoneId) return;

    const leadRef = db.collection('leads').doc(phoneId);
    
    await leadRef.set({
        reply_received: true,
        last_reply: messageText,
        reply_at: new Date().toISOString(),
        status: 'warm' // Lead replied, upgrading to warm
    }, { merge: true });
}

/**
 * Fetch unresolved leads for follow-up sequence.
 * @returns {Promise<Array>} - List of leads to follow up.
 */
async function getLeadsForFollowup() {
    const snapshot = await db.collection('leads')
        .where('message_sent', '==', true)
        .where('status', 'in', ['cold', 'warm'])
        .get();
        
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Checks if a message hash already exists in past sent messages across all leads.
 * Prevents duplicate identical messages.
 * @param {string} hash - The MD5 or SHA256 hash of the message text.
 * @returns {Promise<boolean>} - True if it exists, false otherwise.
 */
async function isMessageHashDuplicate(hash) {
    if (!hash) return false;
    
    // Check global sent messages collection or specific message log collection
    // Using a dedicated 'message_hashes' collection is fastest
    const hashDoc = await db.collection('message_hashes').doc(hash).get();
    return hashDoc.exists;
}

/**
 * Saves a message hash globally to mark it as sent.
 * @param {string} hash - The hash to save.
 */
async function saveMessageHash(hash) {
    if (!hash) return;
    await db.collection('message_hashes').doc(hash).set({
        createdAt: new Date().toISOString()
    });
}

module.exports = { 
    saveLead, 
    isLeadSent, 
    markLeadAsSent, 
    updateLeadMeta, 
    logReply, 
    getLeadsForFollowup,
    isMessageHashDuplicate,
    saveMessageHash
};
