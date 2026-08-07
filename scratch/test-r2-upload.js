import fs from 'fs';

async function testUpload() {
  const fileBuffer = fs.readFileSync('./package.json');
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  const formData = new FormData();
  formData.append('file', blob, 'invoice.png');

  try {
    const res = await fetch('https://spinbot-upload.product-register.workers.dev/upload', {
      method: 'POST',
      headers: {
        'X-Api-Secret': 'spinbot_upload_secret_2026'
      },
      body: formData
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testUpload();
