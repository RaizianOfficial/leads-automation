const axios = require('axios');

/**
 * Scrapes leads using SerpAPI (Google Local).
 * @param {string} city - Target city.
 * @param {string} niche - Target niche.
 * @param {number} limit - Target scrape limit.
 * @returns {Promise<Array>} - Array of scraped leads.
 */
async function scrapeLeads(city, niche, limit = 50) {
    console.log(`Starting scrape for ${niche} in ${city}...`);
    const apiKey = process.env.SERP_API_KEY;
    
    if (!apiKey || apiKey === 'your_serpapi_key') {
        console.warn('⚠️ SERP_API_KEY is not configured or uses default value.');
        return [];
    }

    let leads = [];
    let start = 0;
    const query = `${niche} in ${city}`;

    try {
        // SerpAPI pagination might need adjusting, typically 20 per page for local
        while (leads.length < limit) {
            console.log(`Fetching from SerpAPI (start: ${start})...`);
            
            const response = await axios.get('https://serpapi.com/search.json', {
                params: {
                    engine: 'google_local',
                    q: query,
                    location: city,
                    api_key: apiKey,
                    start: start
                }
            });

            const localResults = response.data.local_results || [];
            
            if (localResults.length === 0) {
                console.log('No more results found.');
                break; // Exit loop if no more results
            }

            for (const result of localResults) {
                if (leads.length >= limit) break;

                // Rule: Phone number is mandatory. Filter immediately.
                if (!result.phone) continue;

                const hasWebsite = !!result.website;
                const rating = result.rating || 0;
                const reviews = result.reviews || 0;

                const lead = {
                    name: result.title || result.name || 'Unknown Business',
                    phone: result.phone,
                    rating: parseFloat(rating),
                    reviews: parseInt(reviews, 10),
                    website: hasWebsite,
                    scrapedAt: new Date().toISOString()
                };

                // Only add if we don't already have this phone number in this batch
                if (!leads.some(l => l.phone === lead.phone)) {
                    leads.push(lead);
                }
            }
            
            // Next page. Usually SerpAPI gives 20 results per page for local results.
            start += 20; 
            
            // Safety to prevent infinite loops if limit is very high
            if (start > 100) break;
        }

        console.log(`Scraped ${leads.length} leads successfully with phone numbers.`);
        return leads;
        
    } catch (error) {
        console.error('Error fetching leads from SerpAPI:', error.response?.data || error.message);
        return leads; // Return whatever we managed to grab
    }
}

module.exports = { scrapeLeads };
