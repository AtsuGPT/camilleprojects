// server.js
const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "1234";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(bodyParser.urlencoded({ extended: true }));

// Criar tabela/colunas se não existirem
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      likes INT DEFAULT 0
    );
  `);

  const colCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='posts' AND column_name='title';
  `);

  if (colCheck.rows.length === 0) {
    await pool.query(`ALTER TABLE posts ADD COLUMN title TEXT NOT NULL DEFAULT '';`);
    console.log("✅ Coluna 'title' adicionada");
  }
})();

// Página principal
app.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM posts ORDER BY id DESC");
  const posts = result.rows;
  const latestTitle = posts.length > 0 ? posts[0].title : "Sem publicações ainda";

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${latestTitle}</title>
  <style>
    body {
      background-color: #121212;
      color: white;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .container {
      width: 90%;
      max-width: 800px;
      padding: 20px;
    }
    h1 {
      text-align: center;
      margin-bottom: 20px;
    }
    .post {
      background: #1e1e1e;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    }
    .post-title {
      font-size: 1.5em;
      margin-bottom: 10px;
    }
    button {
      background: #ff4444;
      border: none;
      padding: 8px 12px;
      color: white;
      border-radius: 5px;
      cursor: pointer;
    }
    button:disabled {
      background: #555;
      cursor: not-allowed;
    }
    @media (max-width: 600px) {
      .post-title { font-size: 1.2em; }
      button { padding: 6px 10px; font-size: 0.9em; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Publicações</h1>
    ${posts.map(p => `
      <div class="post">
        <div class="post-title">${p.title}</div>
        <div>${p.content}</div>
        <div>Likes: <span id="likes-${p.id}">${p.likes}</span></div>
        <button onclick="likePost(${p.id})" id="btn-${p.id}">Curtir</button>
      </div>
    `).join("")}
  </div>
  <script>
    function likePost(id) {
      if (localStorage.getItem('liked-' + id)) {
        alert("Você já curtiu este post!");
        return;
      }
      fetch('/like/' + id, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            document.getElementById('likes-' + id).innerText = data.likes;
            localStorage.setItem('liked-' + id, true);
            document.getElementById('btn-' + id).disabled = true;
          } else {
            alert(data.message || "Erro ao curtir.");
          }
        });
    }
  </script>
</body>
</html>
  `);
});

// Página de admin
app.get("/admin", (req, res) => {
  res.send(`
    <form method="POST" action="/admin">
      <input type="password" name="password" placeholder="Senha" required><br>
      <input type="text" name="title" placeholder="Título" required><br>
      <textarea name="content" placeholder="Conteúdo" required></textarea><br>
      <button type="submit">Publicar</button>
    </form>
  `);
});

app.post("/admin", async (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) {
    return res.send("Senha incorreta.");
  }
  await pool.query("INSERT INTO posts (title, content) VALUES ($1, $2)", [req.body.title, req.body.content]);
  res.redirect("/");
});

// Curtir post
app.post("/like/:id", async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const postId = req.params.id;

  // Checar se já curtiu por IP
  await pool.query(`
    CREATE TABLE IF NOT EXISTS likes_log (
      id SERIAL PRIMARY KEY,
      post_id INT,
      ip VARCHAR(255)
    );
  `);

  const check = await pool.query("SELECT * FROM likes_log WHERE post_id=$1 AND ip=$2", [postId, ip]);
  if (check.rows.length > 0) {
    return res.json({ success: false, message: "Você já curtiu este post!" });
  }

  await pool.query("UPDATE posts SET likes = likes + 1 WHERE id=$1", [postId]);
  await pool.query("INSERT INTO likes_log (post_id, ip) VALUES ($1, $2)", [postId, ip]);

  const updated = await pool.query("SELECT likes FROM posts WHERE id=$1", [postId]);
  res.json({ success: true, likes: updated.rows[0].likes });
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
