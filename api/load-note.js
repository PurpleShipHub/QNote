export default async function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin } = req.query;

  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  // GitHub API 설정
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = 'r2cuerdame';
  const GITHUB_REPO = 'QNote';

  try {
    const path = pin.split('').join('/') + '/Qnote.txt';
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      res.status(200).json({ content, sha: data.sha });
    } else if (response.status === 404) {
      res.status(404).json({ content: '', message: 'Note not found' });
    } else {
      throw new Error('Failed to load note');
    }
  } catch (error) {
    console.error('Error loading note:', error);
    res.status(500).json({ error: error.message });
  }
}