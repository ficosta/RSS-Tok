// src/apiServer.js
const express = require('express');
const db = require('./db');
const app = express();
require('dotenv').config();

app.use(express.json());

app.get('/api/rss/:channel', async (req, res) => {
  try {
    const channel = req.params.channel;
    // Exemplo: consulta simples. Se você tiver a tabela item_channels, poderá fazer um JOIN.
    const result = await db.query(
      `SELECT * FROM items
       WHERE (categories->>0 IS NOT NULL) -- exemplo simples; ajuste para filtrar por canal se necessário
       ORDER BY pubTimestamp DESC`
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`API Server running on port ${PORT}`));
