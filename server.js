const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Default route - start from welcome page
app.get('/', (req, res) => {
    console.log('Root "/" route hit - Serving welcome2.html');
    res.sendFile(path.join(__dirname, 'welcome2.html'), (err) => {
        if (err) {
            console.error('Error sending welcome2.html:', err);
            res.status(500).send('Welcome page not found on server');
        }
    });
});

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.'))); // Serve static files from current directory

// Database Setup
const db = new sqlite3.Database('./swapskill.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY,
        educationLevel TEXT,
        learnSubjects TEXT,
        teachSubjects TEXT,
        languages TEXT,
        proficiencyTest TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        read INTEGER DEFAULT 0,
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (receiver_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        learner_id INTEGER NOT NULL,
        teacher_id INTEGER NOT NULL,
        subject TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (learner_id) REFERENCES users (id),
        FOREIGN KEY (teacher_id) REFERENCES users (id)
    )`);
}

// API Routes

// Register
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Please provide all fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
            [username, email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Email already exists' });
                    }
                    return res.status(500).json({ error: err.message });
                }

                // Return success
                res.status(201).json({
                    message: 'User created successfully',
                    user: { id: this.lastID, username, email }
                });
            }
        );
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { login, password } = req.body; // login can be username or email

    if (!login || !password) {
        return res.status(400).json({ error: 'Please provide login details' });
    }

    // Check if login is email or username
    const sql = `SELECT * FROM users WHERE email = ? OR username = ?`;

    db.get(sql, [login, login], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error check' });
        if (!user) return res.status(400).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        res.json({
            message: 'Login successful',
            user: { id: user.id, username: user.username, email: user.email }
        });
    });
});

// Get Profile
app.get('/api/profile/:userId', (req, res) => {
    const userId = req.params.userId;

    db.get(`SELECT * FROM profiles WHERE user_id = ?`, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Parse JSON strings back to objects
            try {
                row.learnSubjects = JSON.parse(row.learnSubjects || '[]');
                row.teachSubjects = JSON.parse(row.teachSubjects || '[]');
                row.languages = JSON.parse(row.languages || '[]');
                row.proficiencyTest = JSON.parse(row.proficiencyTest || null);
            } catch (e) {
                console.error("Error parsing JSON", e);
            }
            res.json(row);
        } else {
            res.json({}); // Return empty object if no profile yet
        }
    });
});

// Update Profile
app.post('/api/profile', (req, res) => {
    const { userId, educationLevel, learnSubjects, teachSubjects, languages, proficiencyTest } = req.body;

    // Convert arrays/objects to JSON strings for storage
    const learnJson = JSON.stringify(learnSubjects || []);
    const teachJson = JSON.stringify(teachSubjects || []);
    const langJson = JSON.stringify(languages || []);
    const testJson = JSON.stringify(proficiencyTest || null);

    // Check if profile exists
    db.get(`SELECT user_id FROM profiles WHERE user_id = ?`, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Update
            const sql = `UPDATE profiles SET 
                educationLevel = ?, 
                learnSubjects = ?, 
                teachSubjects = ?, 
                languages = ?,
                proficiencyTest = ?
                WHERE user_id = ?`;

            db.run(sql, [educationLevel, learnJson, teachJson, langJson, testJson, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Profile updated' });
            });
        } else {
            // Insert
            const sql = `INSERT INTO profiles (user_id, educationLevel, learnSubjects, teachSubjects, languages, proficiencyTest) 
                VALUES (?, ?, ?, ?, ?, ?)`;

            db.run(sql, [userId, educationLevel, learnJson, teachJson, langJson, testJson], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Profile created' });
            });
        }
    });
});

// Get Teachers (Real users who are teaching)
app.get('/api/teachers', (req, res) => {
    const currentUserId = req.query.currentUserId; // To exclude self

    const sql = `
        SELECT u.id, u.username, u.email, p.educationLevel, p.teachSubjects, p.languages, p.proficiencyTest 
        FROM users u 
        JOIN profiles p ON u.id = p.user_id 
        WHERE p.teachSubjects IS NOT NULL AND p.teachSubjects != '[]' 
        ${currentUserId ? `AND u.id != ?` : ''}
    `;

    const params = currentUserId ? [currentUserId] : [];

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        const teachers = rows.map(row => {
            // Parse JSON fields
            let teachSubjects = [];
            let languages = [];
            let testResult = null;
            try {
                teachSubjects = JSON.parse(row.teachSubjects || '[]');
                languages = JSON.parse(row.languages || '[]');
                testResult = JSON.parse(row.proficiencyTest || 'null');
            } catch (e) {
                console.error("JSON parse error", e);
            }

            return {
                id: row.id,
                name: row.username,
                title: row.educationLevel ? `${row.educationLevel} Student` : 'Community Teacher',
                subjects: teachSubjects,
                rating: 0,
                ratingCount: 0,
                experience: "New",
                availability: "Flexible",
                language: languages.join(', ') || "English",
                students: 0,
                avatarLetter: row.username.charAt(0).toUpperCase(),
                isReal: true,
                isEligible: testResult && (testResult.passed || testResult.score >= 7) // Logic for eligibility
            };
        }).filter(t => t.isEligible); // Only return eligible teachers

        res.json(teachers);
    });
});

// Send Message
app.post('/api/messages', (req, res) => {
    const { senderId, receiverId, content } = req.body;

    if (!senderId || !receiverId || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = `INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`;

    db.run(sql, [senderId, receiverId, content], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
            message: 'Message sent',
            messageId: this.lastID,
            timestamp: new Date().toISOString()
        });
    });
});

// Get Messages between two users
app.get('/api/messages/:userId/:otherUserId', (req, res) => {
    const { userId, otherUserId } = req.params;

    const sql = `
        SELECT m.*, 
               sender.username as sender_name,
               receiver.username as receiver_name
        FROM messages m
        JOIN users sender ON m.sender_id = sender.id
        JOIN users receiver ON m.receiver_id = receiver.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) 
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.timestamp ASC
    `;

    db.all(sql, [userId, otherUserId, otherUserId, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Mark messages as read
        db.run(`UPDATE messages SET read = 1 
                WHERE receiver_id = ? AND sender_id = ?`,
            [userId, otherUserId]);

        res.json(rows);
    });
});

// Get all conversations for a user
app.get('/api/conversations/:userId', (req, res) => {
    const { userId } = req.params;

    // This query finds the latest message for each unique conversation pair
    const sql = `
        SELECT 
            u.id as other_user_id,
            u.username as other_user_name,
            m.content as last_message,
            m.timestamp as last_message_time
        FROM (
            SELECT 
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id,
                MAX(id) as max_id
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY other_id
        ) as latest
        JOIN messages m ON m.id = latest.max_id
        JOIN users u ON u.id = latest.other_id
        ORDER BY m.timestamp DESC
    `;

    db.all(sql, [userId, userId, userId], (err, rows) => {
        if (err) {
            console.error('SQL Error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Create a connection request
app.post('/api/connect', (req, res) => {
    const { learnerId, teacherId, subject } = req.body;
    if (!learnerId || !teacherId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    db.run(`INSERT INTO connections (learner_id, teacher_id, subject) VALUES (?, ?, ?)`,
        [learnerId, teacherId, subject],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Request sent', requestId: this.lastID });
        }
    );
});

// Get connection requests for a teacher
app.get('/api/requests/:userId', (req, res) => {
    const { userId } = req.params;
    const sql = `
        SELECT c.*, u.username as learner_name
        FROM connections c
        JOIN users u ON c.learner_id = u.id
        WHERE c.teacher_id = ? AND c.status = 'pending'
    `;

    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Update connection status
app.post('/api/requests/:requestId/status', (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'

    db.run(`UPDATE connections SET status = ? WHERE id = ?`, [status, requestId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: `Request ${status}` });
    });
});

// Get all accepted sessions for a user (as teacher OR learner)
app.get('/api/sessions/:userId', (req, res) => {
    const { userId } = req.params;
    console.log(`[API] Fetching accepted sessions for User ID: ${userId}`);

    const sql = `
        SELECT c.*, 
               u1.username as learner_name, 
               u2.username as teacher_name
        FROM connections c
        JOIN users u1 ON c.learner_id = u1.id
        JOIN users u2 ON c.teacher_id = u2.id
        WHERE (c.learner_id = ? OR c.teacher_id = ?) 
        AND c.status = 'accepted'
    `;

    db.all(sql, [userId, userId], (err, rows) => {
        if (err) {
            console.error(`[API] Error fetching sessions for ${userId}:`, err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[API] Found ${rows.length} sessions for User ID: ${userId}`);
        res.json(rows);
    });
});


// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server is running!`);
    console.log(`🏠 Local access:   http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://192.168.137.151:${PORT}`); // Use this for other laptops
    console.log(`\n(We switched to port 3001 to avoid network conflicts)\n`);
});
