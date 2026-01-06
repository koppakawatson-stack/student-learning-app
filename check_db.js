const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./swapskill.db');
db.all("SELECT id, username FROM users", (err, users) => {
    console.log("USERS:", users);
    db.all("SELECT * FROM connections", (err, conns) => {
        console.log("CONNECTIONS:", conns);
        process.exit(0);
    });
});
