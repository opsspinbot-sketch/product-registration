/**
 * SpinBot Invoice Upload — Cloudflare Worker
 *
 * POST /upload  → Uploads file to R2 and returns direct public HTTP URL
 * GET  /file/*  → Serves object directly from R2 bucket with CORS headers
 */

export default {
  async fetch(request, env) {
    // ── CORS preflight ────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    const url = new URL(request.url);

    // ── Health check ──────────────────────────────────────────────
    if (url.pathname === '/health' && request.method === 'GET') {
      return corsResponse({ ok: true, service: 'SpinBot Upload Worker' });
    }

    // ── Direct File Serving Endpoint ──────────────────────────────
    if (url.pathname.startsWith('/file/') && request.method === 'GET') {
      const key = url.pathname.replace('/file/', '');
      try {
        const object = await env.INVOICES.get(key);
        if (!object) {
          return new Response('File not found', { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(object.body, { headers });
      } catch (err) {
        return new Response('Error retrieving file', { status: 500 });
      }
    }

    // ── Upload endpoint ───────────────────────────────────────────
    if (url.pathname === '/upload' && request.method === 'POST') {
      // 1. Verify API secret
      const secret = request.headers.get('X-Api-Secret');
      if (!secret || secret !== env.UPLOAD_API_SECRET) {
        return corsResponse({ ok: false, error: 'Unauthorized' }, 401);
      }

      // 2. Parse multipart form
      let formData;
      try {
        formData = await request.formData();
      } catch {
        return corsResponse({ ok: false, error: 'Invalid form data' }, 400);
      }

      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return corsResponse({ ok: false, error: 'No file provided' }, 400);
      }

      // 3. Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        return corsResponse({
          ok: false,
          error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WEBP, PDF`
        }, 415);
      }

      // 4. Validate file size (max 10 MB)
      const MAX_BYTES = 10 * 1024 * 1024;
      const arrayBuffer = await file.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_BYTES) {
        return corsResponse({ ok: false, error: 'File too large. Max 10 MB.' }, 413);
      }

      // 5. Generate unique object key
      const ext = extensionFor(file.type);
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      const key = `invoices/${timestamp}-${random}${ext}`;

      // 6. Upload to R2
      try {
        await env.INVOICES.put(key, arrayBuffer, {
          httpMetadata: { contentType: file.type },
          customMetadata: {
            originalName: file.name || 'invoice',
            uploadedAt: new Date().toISOString()
          }
        });
      } catch (err) {
        console.error('R2 put error:', err);
        return corsResponse({ ok: false, error: 'Storage upload failed' }, 500);
      }

      // 7. Build direct worker public URL
      const fileUrl = `${url.origin}/file/${key}`;

      return corsResponse({ ok: true, url: fileUrl, key });
    }

    // ── Email dispatch endpoint ──────────────────────────────────
    if (url.pathname === '/send-email' && request.method === 'POST') {
      try {
        const payload = await request.json();
        const { to, subject, html, text } = payload;

        if (!to) {
          return corsResponse({ ok: false, error: 'Recipient email required' }, 400);
        }

        // Direct SMTP dispatch via Brevo / Mailchannels API endpoint
        const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': env.BREVO_API_KEY || 'xkeysib-98124912941-mock'
          },
          body: JSON.stringify({
            sender: { name: 'SpinBot Warranty Desk', email: 'ops.spinbot@gmail.com' },
            to: [{ email: to }],
            subject: subject || 'Product Registration Confirmation | SpinBot',
            htmlContent: html,
            textContent: text
          })
        });

        const resData = await emailRes.json();
        return corsResponse({ ok: emailRes.ok, result: resData });
      } catch (err) {
        return corsResponse({ ok: false, error: err.message }, 500);
      }
    }

    // ── 404 ───────────────────────────────────────────────────────
    return corsResponse({ ok: false, error: 'Not found' }, 404);
  }
};

// ── Helpers ──────────────────────────────────────────────────────

function corsResponse(body, status = 200) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Secret'
  };
  return new Response(body ? JSON.stringify(body) : null, { status, headers });
}

function extensionFor(mimeType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
  };
  return map[mimeType] || '.bin';
}
