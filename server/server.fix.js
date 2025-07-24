// This is a temporary file to fix the player routes
// The issue is that there are duplicate player routes in server.js
// We need to remove lines 2260-2358 from server.js which contain duplicate player routes

// Instructions to fix:
// 1. Make a backup of server.js (already done: server.js.bak)
// 2. Open server.js in a text editor
// 3. Find the duplicate player routes (around line 2260)
// 4. Delete the following sections:
//    - app.post("/api/players", upload.single("avatar"), (req, res) => { ... });
//    - app.delete("/api/players/:id", async (req, res) => { ... });
//    - app.get("/api/players/:id", (req, res) => { ... });
//    - app.put("/api/players/:id", upload.single("avatar"), (req, res) => { ... });
// 5. Save the file
// 6. Restart the server

// These routes are already handled by the players router in server/routes/players.js
// which is properly mounted at app.use("/api/players", playersRoutes); 