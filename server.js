const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('database.db');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'segredo-fdp',
  resave: false,
  saveUninitialized: true
}));

// Criar tabelas se não existirem
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_ip TEXT,
    UNIQUE(post_id, user_ip)
  )`);
});

// Middleware pra checar login admin
function checkAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

// Página pública
app.get('/', (req, res) => {
  db.all(`SELECT p.id, p.title, p.content, p.date, 
         (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes 
         FROM posts p ORDER BY date DESC`, (err, rows) => {
    if (err) return res.send('Erro no banco');

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Publicações</title>
      <style>
        body {
          background-color: #121212;
          color: #eee;
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        h1 {
          margin-bottom: 30px;
        }
        article {
          background-color: #1e1e1e;
          border-radius: 8px;
          padding: 20px;
          width: 90%;
          max-width: 700px;
          margin-bottom: 20px;
          box-shadow: 0 0 10px rgba(0,0,0,0.7);
        }
        h2 {
          margin-top: 0;
          color: #ffcc00;
        }
        small {
          color: #999;
        }
        button {
          background-color: #ffcc00;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          font-weight: bold;
          cursor: pointer;
          color: #121212;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #ffaa00;
        }
        form {
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <h1>Publicações</h1>
    `;

    rows.forEach(post => {
      html += `<article>
        <h2>${post.title}</h2>
        <p>${post.content}</p>
        <small>Publicado em: ${post.date}</small><br>
        <form method="POST" action="/like">
          <input type="hidden" name="post_id" value="${post.id}">
          <button type="submit">Curtir (${post.likes})</button>
        </form>
      </article>`;
    });

    html += `</body></html>`;
    res.send(html);
  });
});

// Curtir post
app.post('/like', (req, res) => {
  const post_id = req.body.post_id;
  const user_ip = req.ip;

  const stmt = db.prepare("INSERT OR IGNORE INTO likes (post_id, user_ip) VALUES (?, ?)");
  stmt.run(post_id, user_ip, err => {
    res.redirect('/');
  });
});

// Login admin - formulário
app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Login Admin</title>
      <style>
        body {
          background-color: #121212;
          color: #eee;
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        form {
          background: #1e1e1e;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 0 15px rgba(0,0,0,0.7);
          width: 300px;
          display: flex;
          flex-direction: column;
        }
        input {
          margin-bottom: 15px;
          padding: 10px;
          border-radius: 5px;
          border: none;
          font-size: 16px;
        }
        button {
          background-color: #ffcc00;
          border: none;
          padding: 10px;
          border-radius: 5px;
          font-weight: bold;
          cursor: pointer;
          color: #121212;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #ffaa00;
        }
      </style>
    </head>
    <body>
      <form method="POST" action="/admin/login">
        <h2>Login Admin</h2>
        <input name="username" placeholder="Usuário" required autofocus>
        <input type="password" name="password" placeholder="Senha" required>
        <button type="submit">Entrar</button>
      </form>
    </body>
    </html>
  `);
});

// Login admin - processa
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === '123456') {
    req.session.admin = true;
    res.redirect('/admin');
  } else {
    res.send('<p style="color:#f55;">Login inválido! <a href="/admin/login">Tente de novo</a></p>');
  }
});

// Painel admin - criar post
app.get('/admin', checkAdmin, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Painel Admin</title>
      <style>
        body {
          background-color: #121212;
          color: #eee;
          font-family: Arial, sans-serif;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
        }
        form {
          background: #1e1e1e;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 15px rgba(0,0,0,0.7);
          width: 400px;
          display: flex;
          flex-direction: column;
        }
        input, textarea {
          margin-bottom: 15px;
          padding: 10px;
          border-radius: 5px;
          border: none;
          font-size: 16px;
          resize: vertical;
          background-color: #2a2a2a;
          color: #eee;
        }
        textarea {
          height: 150px;
        }
        button {
          background-color: #ffcc00;
          border: none;
          padding: 12px;
          border-radius: 5px;
          font-weight: bold;
          cursor: pointer;
          color: #121212;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #ffaa00;
        }
        a {
          color: #ffcc00;
          text-decoration: none;
          margin-top: 10px;
          text-align: center;
          display: block;
        }
        a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <form method="POST" action="/admin/post">
        <h2>Nova Publicação</h2>
        <input name="title" placeholder="Título" required autofocus>
        <textarea name="content" placeholder="Conteúdo" required></textarea>
        <button type="submit">Publicar</button>
        <a href="/admin/logout">Sair</a>
      </form>
    </body>
    </html>
  `);
});

// Salvar post
app.post('/admin/post', checkAdmin, (req, res) => {
  const { title, content } = req.body;
  const stmt = db.prepare("INSERT INTO posts (title, content) VALUES (?, ?)");
  stmt.run(title, content, err => {
    if (err) return res.send('Erro ao salvar');
    res.redirect('/admin');
  });
});

// Logout admin
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start server
app.listen(3000, () => {
  console.log('Rodando na porta 3000, seu merdinha.');
});
