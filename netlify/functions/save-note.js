exports.handler = async (event, context) => {
  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { pin, content } = JSON.parse(event.body);
    
    // GitHub API로 Issue 생성 (서버의 토큰 사용)
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const response = await fetch('https://api.github.com/repos/r2cuerdame/QNote/issues', {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Create note: ${pin}`,
        body: `PIN: ${pin}\nContent:\n\`\`\`\n${content}\n\`\`\``,
        labels: ['qnote', 'auto-create']
      })
    });

    if (response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: '노트가 저장되었습니다!' })
      };
    } else {
      throw new Error('Failed to create issue');
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};