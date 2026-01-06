const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./swapskill.db');

db.all(`SELECT u.id, u.username, p.teachSubjects, p.proficiencyTest 
        FROM users u 
        JOIN profiles p ON u.id = p.user_id`,
    (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log('\n=== ALL REGISTERED USERS ===\n');
        rows.forEach(r => {
            const subjects = JSON.parse(r.teachSubjects || '[]');
            const test = JSON.parse(r.proficiencyTest || 'null');
            const eligible = subjects.length > 0 && test && (test.passed || test.score >= 7);

            console.log(`User: ${r.username} (ID: ${r.id})`);
            console.log(`  - Teach Subjects: ${subjects.join(', ') || 'None'}`);
            console.log(`  - Test Passed: ${test ? test.passed : 'No test taken'}`);
            console.log(`  - ELIGIBLE TO APPEAR IN LEARN PAGE: ${eligible ? '✅ YES' : '❌ NO'}`);
            console.log('');
        });

        db.close();
    });
