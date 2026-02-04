Run the site locally:

1. Open a terminal in the `R.O.B.B.E.-Scouting` folder.
2. Install Node if not present (Node 18+ recommended).
3. Start the server: `npm start` (this runs `node server.js`).
4. Open http://localhost:8080 in your browser.

Notes:
- The server serves files from the site root and defaults to port 8080. To use a different port: `PORT=3000 npm start`.
- Data is stored in the browser's localStorage; clearing it removes saved scouting data and password.
