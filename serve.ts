/**
 * Simple Bun HTTP server for development
 */

const server = Bun.serve({
    port: 8085,
    async fetch(request) {
        const url = new URL(request.url);
        let path = url.pathname;

        // Default to index.html
        if (path === '/') {
            path = '/index.html';
        }

        // Try to serve from dist for app.js, otherwise from root
        let filePath = `.${path}`;

        // Map /app.js to /dist/app.js
        if (path === '/app.js' || path === '/dist/app.js') {
            filePath = './dist/app.js';
        }

        try {
            const file = Bun.file(filePath);
            const exists = await file.exists();

            if (!exists) {
                return new Response('Not Found', { status: 404 });
            }

            // Get correct content type
            let contentType = 'text/plain';
            if (path.endsWith('.html')) contentType = 'text/html';
            else if (path.endsWith('.css')) contentType = 'text/css';
            else if (path.endsWith('.js')) contentType = 'application/javascript';
            else if (path.endsWith('.json')) contentType = 'application/json';
            else if (path.endsWith('.svg')) contentType = 'image/svg+xml';
            else if (path.endsWith('.png')) contentType = 'image/png';

            return new Response(file, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache'
                }
            });
        } catch (error) {
            return new Response('Server Error', { status: 500 });
        }
    }
});

console.log(`Server running at http://localhost:${server.port}`);
