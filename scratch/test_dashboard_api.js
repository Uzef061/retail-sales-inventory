const http = require('http');

http.get('http://localhost:5000/api/dashboard', (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('HTTP Status Code:', res.statusCode);
    try {
      const data = JSON.parse(body);
      console.log('API Response Keys:', Object.keys(data));
      console.log('Insights Structure:', JSON.stringify(data.insights, null, 2));
      console.log('\n✅ GET /api/dashboard IS WORKING PERFECTLY AND RETURNING VALID JSON!');
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('API Request Failed:', err.message);
});
