const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com Postgres
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
        <link rel="stylesheet" href="/style.css">
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

// Porta
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));