const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to the database
const dbPath = path.join(__dirname, '../database.db');
console.log('Using database:', dbPath);
const db = new sqlite3.Database(dbPath);

// Check if the test player exists
db.get('SELECT * FROM players WHERE nickname = ?', ['TestPlayer'], (err, player) => {
    if (err) {
        console.error('Error retrieving player:', err);
    } else if (player) {
        console.log('Found existing test player:', player);
    } else {
        console.log('No test player found, adding one now');
        
        // Test adding a player directly to the database
        const testPlayer = {
            nickname: 'TestPlayer',
            realName: 'Test Player',
            steam64: '76561198000000000',
            teamId: null,
            avatar: 'test-avatar.png',
            cameraLink: null
        };

        db.run(
            'INSERT INTO players (nickname, realName, steam64, teamId, avatar, cameraLink) VALUES (?, ?, ?, ?, ?, ?)',
            [testPlayer.nickname, testPlayer.realName, testPlayer.steam64, testPlayer.teamId, testPlayer.avatar, testPlayer.cameraLink],
            function(err) {
                if (err) {
                    console.error('Error adding test player:', err);
                } else {
                    console.log(`Successfully added test player with ID: ${this.lastID}`);
                    
                    // Now try to retrieve the player
                    db.get('SELECT * FROM players WHERE id = ?', [this.lastID], (err, player) => {
                        if (err) {
                            console.error('Error retrieving test player:', err);
                        } else {
                            console.log('Retrieved test player:', player);
                        }
                        
                        // Close the database connection
                        db.close();
                    });
                }
            }
        );
    }
}); 