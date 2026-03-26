const nodemailer = require('nodemailer');

/**
 * Sends a daily email report of the generated leads.
 * @param {Array} leads - The qualified and selected leads.
 * @returns {Promise<boolean>} - True if sent successfully.
 */
async function sendEmailReport(leads) {
    if (!leads || leads.length === 0) {
        console.log('No leads to send today.');
        return false;
    }

    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const numLeads = leads.length;

        // Generate HTML content
        let htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #0056b3;">🔥 Daily High-Quality Leads Report</h2>
                <p>Here are the top ${numLeads} generated leads for today:</p>
                <hr style="border: 1px solid #ddd; margin-bottom: 20px;">
        `;

        leads.forEach((lead, index) => {
            htmlContent += `
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid #0056b3;">
                    <h3 style="margin-top: 0; color: #333;">${index + 1}. ${lead.name}</h3>
                    <p style="margin: 5px 0;"><strong>📞 Phone:</strong> ${lead.phone}</p>
                    <p style="margin: 5px 0;"><strong>⭐ Rating:</strong> ${lead.rating} (${lead.reviews} reviews)</p>
                    <p style="margin: 5px 0;"><strong>🎯 Score:</strong> <span style="color: ${lead.score >= 80 ? 'green' : 'orange'}; font-weight: bold;">${lead.score}/100</span></p>
                    <p style="margin: 5px 0;"><strong>⚠️ Problem detected:</strong> ${lead.problem}</p>
                    <p style="margin: 5px 0;"><strong>💡 Pitch Angle:</strong> ${lead.pitch_angle}</p>
                </div>
            `;
        });

        htmlContent += `
                <p style="font-size: 12px; color: #888; text-align: center; margin-top: 20px;">
                    Generated autonomously by Antigravity AI Agent.<br>
                    ${new Date().toLocaleString()}
                </p>
            </div>
        `;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Sunny Leads" <no-reply@example.com>',
            to: process.env.EMAIL_TO,
            subject: `🔥 Daily High-Quality Leads Report - ${new Date().toLocaleDateString()}`,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email report sent successfully. Message ID: ${info.messageId}`);
        return true;
        
    } catch (error) {
        console.error('Failed to send email report:', error.message);
        return false;
    }
}

module.exports = { sendEmailReport };
