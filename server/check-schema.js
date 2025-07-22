const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, '../database.db');
console.log('Using database:', dbPath);
const db = new sqlite3.Database(dbPath);

// Check the schema of the players table
db.all(`PRAGMA table_info(players)`, (err, rows) => {
    if (err) {
        console.error('Error checking players table schema:', err);
        return;
    }
    
    console.log('Players table schema:');
    console.log(rows);
    
    // Check if there's any data in the players table
    db.all(`SELECT * FROM players LIMIT 5`, (err, players) => {
        if (err) {
            console.error('Error querying players:', err);
        } else {
            console.log('Sample players data:');
            console.log(players);
            console.log(`Total players found: ${players.length}`);
        }
        
        // Close the database connection
        db.close();
    });
}); 