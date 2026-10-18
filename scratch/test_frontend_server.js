const http = require('http');

http.get('http://localhost:3000/', (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('Frontend Dev Server Status:', res.statusCode);
    if (body.includes('<div id="root">')) {
      console.log('✅ FRONTEND HTML SERVED SUCCESSFULLY FROM http://localhost:3000');
    } else {
      console.log('Body HTML length:', body.length);
    }
  });
}).on('error', (err) => {
  console.error('Frontend Request Failed:', err.message);
});
