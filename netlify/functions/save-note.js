exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight requests
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
    const { pin, content } = JSON.parse(event.body);
    
    if (!pin || content === undefined) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Pin and content are required' })
      };
    }

    // Validate pin format (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Pin must be a 6-digit number' })
      };
    }

    const token = process.env.QNOTE_SAVE_TOKEN;
    if (!token) {
      console.error('QNOTE_SAVE_TOKEN not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // GitHub repository info
    const owner = 'PurpleShipHub'; // GitHub username or organization
    const repo = 'QNote'; // Repository name
    const digits = pin.split('');
    const path = `${digits[0]}/${digits[1]}/${digits[2]}/${digits[3]}/${digits[4]}/${digits[5]}/Qnote.txt`; // File path in repository
    
    // Get current file (if exists) to get SHA
    let sha = null;
    let fileExists = false;
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
    try {
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'QNote-App'
        }
      });
      
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
        fileExists = true;
        console.log('File exists, updating with SHA:', sha);
      } else if (getResponse.status === 404) {
        console.log('File does not exist, will create new file');
        fileExists = false;
      } else {
        console.error('Unexpected response when checking file:', getResponse.status);
      }
    } catch (error) {
      console.log('Error checking file existence:', error.message);
      fileExists = false;
    }

    // Prepare commit data
    const commitData = {
      message: fileExists ? `Update note for pin ${pin}` : `Create note for pin ${pin}`,
      content: Buffer.from(content).toString('base64'),
      branch: 'main'
    };

    // Add SHA if file exists (for update)
    if (sha) {
      commitData.sha = sha;
    }
    
    console.log('Commit data prepared:', {
      path,
      messageType: fileExists ? 'update' : 'create',
      hasSha: !!sha,
      contentLength: content.length
    });

    // Create or update file
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    console.log('Making GitHub API request:', {
      url: putUrl,
      method: 'PUT',
      hasToken: !!token,
      tokenStart: token ? token.substring(0, 10) + '...' : 'none'
    });
    
    // Add retry logic for GitHub API calls
    let putResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount <= maxRetries) {
      putResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'QNote-App'
        },
        body: JSON.stringify(commitData)
      });
      
      console.log(`GitHub API attempt ${retryCount + 1}, status:`, putResponse.status);
      
      // If success or client error (400-499), don't retry
      if (putResponse.ok || (putResponse.status >= 400 && putResponse.status < 500)) {
        break;
      }
      
      // If server error or rate limit, wait and retry
      if (putResponse.status === 403) {
        console.log('Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // 2s, 4s, 6s
      } else if (putResponse.status >= 500) {
        console.log('Server error, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // 1s, 2s, 3s
      }
      
      retryCount++;
    }
    
    console.log('Final GitHub API response status:', putResponse.status);
    console.log('GitHub API response headers:', Object.fromEntries(putResponse.headers.entries()));

    if (!putResponse.ok) {
      const errorData = await putResponse.text();
      console.error('GitHub API error:', putResponse.status, errorData);
      console.error('Request path:', path);
      console.error('Request data:', JSON.stringify(commitData, null, 2));
      console.error('Full request details:', {
        url: putUrl,
        headers: {
          'Authorization': `token ${token?.substring(0, 10)}...`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'QNote-App'
        },
        bodySize: JSON.stringify(commitData).length
      });
      
      let errorMessage = 'GitHub API error';
      if (putResponse.status === 401) {
        errorMessage = 'Invalid token';
      } else if (putResponse.status === 422) {
        errorMessage = 'Validation failed - possibly invalid path or content';
      } else if (putResponse.status === 409) {
        errorMessage = 'Conflict - file may have been modified by another user';
      }
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to save to GitHub',
          details: errorMessage,
          githubStatus: putResponse.status,
          githubError: errorData
        })
      };
    }

    const result = await putResponse.json();
    
    console.log('GitHub API success response:', JSON.stringify(result, null, 2));
    
    // Verify the file was actually created/updated by checking it again
    let verificationResult = null;
    try {
      const verifyResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'QNote-App'
        }
      });
      
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        verificationResult = {
          exists: true,
          sha: verifyData.sha,
          size: verifyData.size
        };
        console.log('File verification successful:', verificationResult);
      } else {
        verificationResult = {
          exists: false,
          status: verifyResponse.status
        };
        console.log('File verification failed:', verificationResult);
      }
    } catch (verifyError) {
      console.log('File verification error:', verifyError.message);
      verificationResult = {
        exists: false,
        error: verifyError.message
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Note saved successfully to GitHub',
        lastSaved: new Date().toISOString(),
        commit: result.commit?.sha || 'unknown',
        verification: verificationResult,
        githubResponse: {
          commitSha: result.commit?.sha,
          commitUrl: result.commit?.html_url,
          content: result.content
        }
      })
    };
  } catch (error) {
    console.error('Error saving note:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to save note',
        details: error.message
      })
    };
  }
};