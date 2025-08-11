const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Conexão com Postgres (use a variável de ambiente DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Criar tabela se não existir
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0
    );
  `);
})();

// Página principal
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
  const postsHtml = result.rows.map(p => `
    <div class="post">
      <p>${p.content}</p>
      <button onclick="likePost(${p.id})">Curtir (${p.likes})</button>
    </div>
  `).join('');

  res.send(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Publicações</title>
        <style>
          body {
            background-color: #121212;
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
          }
          h1 {
            text-align: center;
          }
          .post {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
          }
          button {
            background-color: #007bff;
            border: none;
            padding: 8px 12px;
            color: white;
            border-radius: 5px;
            cursor: pointer;
          }
          button:hover {
            background-color: #0056b3;
          }
          .add-form {
            display: flex;
            flex-direction: column;
            margin-bottom: 20px;
          }
          .add-form textarea {
            resize: none;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
            border: none;
            font-size: 16px;
            font-family: Arial, sans-serif;
            min-height: 80px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Minhas Publicações</h1>
          <form action="/add" method="POST" class="add-form">
            <textarea name="content" placeholder="Escreva algo..." required></textarea>
            <button type="submit">Publicar</button>
          </form>
          ${postsHtml}
        </div>
        <script>
          async function likePost(id) {
            await fetch('/like/' + id, { method: 'POST' });
            location.reload();
          }
        </script>
      </body>
    </html>
  `);
});

// Adicionar post
app.post('/add', async (req, res) => {
  const { content } = req.body;
  await pool.query('INSERT INTO posts (content) VALUES ($1)', [content]);
  res.redirect('/');
});

// Curtir post
app.post('/like/:id', async (req, res) => {
  await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [req.params.id]);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
