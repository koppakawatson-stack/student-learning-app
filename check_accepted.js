const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./swapskill.db');
db.all("SELECT * FROM connections WHERE status = 'accepted'", (err, rows) => {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
});
