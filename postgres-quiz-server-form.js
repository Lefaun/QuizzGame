const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000'
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database and create table
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        option1 VARCHAR(255) NOT NULL,
        option2 VARCHAR(255) NOT NULL,
        correct_answer INT NOT NULL
      )
    `);
    console.log('Connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1); // Exit if the database initialization fails
  }
}

// Call the function to initialize the database
initializeDatabase();

// Endpoint to handle individual question submission
app.post('/api/submit-question', async (req, res) => {
  const { question, option1, option2, correctAnswer } = req.body;
  
  if (!question || !option1 || !option2 || correctAnswer === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    const queryText = 'INSERT INTO questions (question, option1, option2, correct_answer) VALUES ($1, $2, $3, $4)';
    await client.query(queryText, [question, option1, option2, correctAnswer]);
    res.status(201).json({ message: 'Question added successfully' });
  } catch (error) {
    console.error('Error inserting question:', error);
    res.status(500).json({ error: 'Failed to add question' });
  } finally {
    client.release();
  }
});

// Endpoint to get random questions
app.get('/api/random-questions', async (req, res) => {
  const count = parseInt(req.query.count) || 1;
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT $1', [count]);
    const formattedResults = result.rows.map(row => ({
      question: row.question,
      options: [row.option1, row.option2],
      correctAnswer: row.correct_answer
    }));
    res.json(formattedResults);
  } catch (error) {
    console.error('Error retrieving questions:', error);
    res.status(500).json({ error: 'Failed to retrieve questions' });
  } finally {
    client.release();
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
