const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Configura a senha do admin (troca aqui)
const ADMIN_USER = 'kayk';
const ADMIN_PASS = '123456';

// Conexão com Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Cria tabela se não existir
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0
    );
  `);
})();

// Middleware simples Basic Auth para /admin
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Área do Admin"');
    return res.status(401).send('Autenticação requerida.');
  }

  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    next();
  } else {
    res.set('WWW-Authenticate', 'Basic realm="Área do Admin"');
    return res.status(401).send('Usuário ou senha inválidos.');
  }
}

// Página pública - ver posts e curtir
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Publicações</h1>
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

// Página admin - formulário para criar posts
app.get('/admin', basicAuth, (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Área do Admin</title>
        <style>
          body {
            background-color: #121212;
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #1e1e1e;
            border-radius: 10px;
          }
          textarea {
            width: 100%;
            min-height: 100px;
            padding: 10px;
            border-radius: 5px;
            border: none;
            resize: none;
            font-size: 16px;
            font-family: Arial, sans-serif;
            margin-bottom: 10px;
          }
          button {
            background-color: #007bff;
            border: none;
            padding: 10px 15px;
            color: white;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          }
          button:hover {
            background-color: #0056b3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Adicionar Publicação</h1>
          <form method="POST" action="/admin/add">
            <textarea name="content" placeholder="Escreva sua publicação..." required></textarea>
            <button type="submit">Publicar</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// Rota admin para adicionar post
app.post('/admin/add', basicAuth, async (req, res) => {
  const { content } = req.body;
  await pool.query('INSERT INTO posts (content) VALUES ($1)', [content]);
  res.redirect('/admin');
});

// Curtir post (público)
app.post('/like/:id', async (req, res) => {
  await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [req.params.id]);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
