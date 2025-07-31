exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { room } = JSON.parse(event.body);
        
        if (!room || !/^\d{6}$/.test(room)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid room number' })
            };
        }

        // Convert room number to path
        const digits = room.split('');
        const path = `${digits[0]}/${digits[1]}/${digits[2]}/${digits[3]}/${digits[4]}/${digits[5]}/Qnote.txt`;
        
        // GitHub API URL
        const apiUrl = `https://api.github.com/repos/PurpleShipHub/QNote/contents/${path}`;
        
        // GitHub Personal Access Token from environment
        const token = process.env.QNOTE_SAVE_TOKEN;
        
        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': token ? `token ${token}` : undefined,
                'User-Agent': 'QNote-App'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    content: content,
                    exists: true
                })
            };
        } else if (response.status === 404) {
            // File doesn't exist yet - this is normal for new rooms
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    content: '',
                    exists: false
                })
            };
        } else {
            throw new Error(`GitHub API returned status ${response.status}`);
        }
    } catch (error) {
        console.error('Error reading from GitHub:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to read note',
                details: error.message 
            })
        };
    }
}; 