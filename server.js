const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const ADMIN_USER = 'kayk';
const ADMIN_PASS = '123456';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Cria tabela com título e conteúdo
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      likes INTEGER DEFAULT 0
    );
  `);
})();

// Middleware basic auth admin
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Área do Admin"');
    return res.status(401).send('Autenticação requerida.');
  }

  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) next();
  else {
    res.set('WWW-Authenticate', 'Basic realm="Área do Admin"');
    return res.status(401).send('Usuário ou senha inválidos.');
  }
}

// Página pública
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
  const postsHtml = result.rows.map(p => `
    <div class="post">
      <h2>${p.title}</h2>
      <p>${p.content}</p>
      <button onclick="likePost(${p.id})" id="btn-like-${p.id}">Curtir (${p.likes})</button>
    </div>
  `).join('');

  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Publicações</title>
        <style>
          body {
            background-color: #121212;
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0 10px;
          }
          .container {
            max-width: 900px;
            margin: 40px auto;
            padding: 0 20px;
          }
          h1 {
            text-align: center;
          }
          .post {
            background: #1e1e1e;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 15px;
            box-shadow: 0 0 10px rgba(0,0,0,0.6);
          }
          h2 {
            margin-top: 0;
          }
          button {
            background-color: #007bff;
            border: none;
            padding: 8px 12px;
            color: white;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
          }
          button:disabled {
            background-color: #555;
            cursor: not-allowed;
          }
          @media (max-width: 600px) {
            .container {
              padding: 0 10px;
              margin: 20px auto;
            }
            button {
              width: 100%;
              font-size: 1.2rem;
              padding: 12px 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Publicações</h1>
          ${postsHtml}
        </div>
        <script>
          function hasLiked(postId) {
            return localStorage.getItem('liked_post_' + postId) === 'true';
          }

          async function likePost(postId) {
            if (hasLiked(postId)) {
              alert('Você já curtiu essa publicação!');
              return;
            }
            const res = await fetch('/like/' + postId, { method: 'POST' });
            if (res.ok) {
              localStorage.setItem('liked_post_' + postId, 'true');
              const btn = document.getElementById('btn-like-' + postId);
              const count = parseInt(btn.textContent.match(/\\d+/)[0]) + 1;
              btn.textContent = 'Curtir (' + count + ')';
              btn.disabled = true;
            } else {
              alert('Erro ao curtir a publicação.');
            }
          }

          // Disable liked buttons on load
          window.onload = () => {
            document.querySelectorAll('button[id^="btn-like-"]').forEach(btn => {
              const postId = btn.id.replace('btn-like-', '');
              if (hasLiked(postId)) {
                btn.disabled = true;
              }
            });
          }
        </script>
      </body>
    </html>
  `);
});

// Página admin para adicionar posts com título e conteúdo
app.get('/admin', basicAuth, (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Admin - Nova Publicação</title>
        <style>
          body {
            background-color: #121212;
            color: #fff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px 10px;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background: #1e1e1e;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 15px rgba(0,0,0,0.7);
          }
          h1 {
            text-align: center;
          }
          input[type="text"], textarea {
            width: 100%;
            padding: 10px;
            margin-bottom: 15px;
            border-radius: 5px;
            border: none;
            font-size: 1rem;
            font-family: Arial, sans-serif;
            resize: none;
          }
          button {
            width: 100%;
            background-color: #007bff;
            border: none;
            padding: 12px;
            color: white;
            font-size: 1.2rem;
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
          <h1>Nova Publicação</h1>
          <form method="POST" action="/admin/add">
            <input type="text" name="title" placeholder="Título" required />
            <textarea name="content" placeholder="Conteúdo" rows="6" required></textarea>
            <button type="submit">Publicar</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// Rota admin para adicionar post com título e conteúdo
app.post('/admin/add', basicAuth, async (req, res) => {
  const { title, content } = req.body;
  await pool.query('INSERT INTO posts (title, content) VALUES ($1, $2)', [title, content]);
  res.redirect('/admin');
});

// Curtir post
app.post('/like/:id', async (req, res) => {
  await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = $1', [req.params.id]);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
