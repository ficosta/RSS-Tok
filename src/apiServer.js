// src/apiServer.js
const express = require('express');
const compression = require('compression');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(compression());

app.use(cors());

app.get('/api/rss/:channel', async (req, res) => {
  try {
    const channel = req.params.channel;

    // Consulta com JOIN: retorna somente itens que estão visíveis para o canal solicitado.
    const result = await db.query(
      `SELECT i.*
       FROM items i
       INNER JOIN item_channels ic ON i.item_id = ic.item_id
       WHERE ic.channel = $1 AND ic.is_visible = 1
       ORDER BY i.pubTimestamp DESC`,
      [channel]
    );
    
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT_API || 3001;
app.listen(PORT, () => console.log(`API Server running on port ${PORT}`));
