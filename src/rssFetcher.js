// src/rssFetcher.js
const Parser = require('rss-parser');
const fetch = require('node-fetch');
const db = require('./db');
const feedUrls = require('./feedUrls'); // Objeto: { channelName: feedURL, ... }

const parser = new Parser();

async function updateRSS() {
  const currentTimestamp = Date.now();

  for (const channel in feedUrls) {
    const feedUrl = feedUrls[channel];
    console.log(`Processando canal: ${channel} - URL: ${feedUrl}`);
    try {
      const feed = await parser.parseURL(feedUrl);
      const currentIds = []; // Lista de IDs encontrados no feed para esse canal

      for (const item of feed.items) {
        const item_id = item.guid || item.link || item.title;
        currentIds.push(item_id);
        const pubTimestamp = new Date(item.pubDate.replace("CET", "GMT+0100")).getTime();
        // Insere ou atualiza o item na tabela items
        await db.query(
          `INSERT INTO items (item_id, title, content, link, pubDate, pubTimestamp, media_content, media_thumbnail, media_credit, categories, timestamp, translation_job, translations)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, '{}', '{}')
           ON CONFLICT (item_id) DO UPDATE SET 
             title = EXCLUDED.title,
             content = EXCLUDED.content,
             link = EXCLUDED.link,
             pubDate = EXCLUDED.pubDate,
             pubTimestamp = EXCLUDED.pubTimestamp,
             media_content = EXCLUDED.media_content,
             media_thumbnail = EXCLUDED.media_thumbnail,
             media_credit = EXCLUDED.media_credit,
             categories = EXCLUDED.categories,
             timestamp = EXCLUDED.timestamp`,
          [
            item_id,
            item.title || "",
            item.content || "",
            item.link || "",
            item.pubDate || "",
            pubTimestamp,
            JSON.stringify(item['media:content'] || {}),
            JSON.stringify(item['media:thumbnail'] || {}),
            item['media:credit'] || "",
            JSON.stringify(item.categories || []),
            currentTimestamp,
          ]
        );
        // Atualiza a tabela item_channels para marcar este item como visível para o canal
        await db.query(
          `INSERT INTO item_channels (item_id, channel, is_visible)
           VALUES ($1, $2, 1)
           ON CONFLICT (item_id, channel) DO UPDATE SET is_visible = 1`,
          [item_id, channel]
        );
        // Chama o endpoint de tradução se ainda não houver um job registrado
        const res = await db.query(`SELECT translation_job FROM items WHERE item_id = $1`, [item_id]);
        const translation_job = res.rows[0].translation_job;
        if (!translation_job || Object.keys(translation_job).length === 0) {
          try {
            const response = await fetch('http://localhost:3002/job_translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                item_id,
                title: item.title || "",
                content: item.content || "",
                link: item.link || "",
                pubDate: item.pubDate || "",
                media_content: item['media:content'] || {},
                media_thumbnail: item['media:thumbnail'] || {},
                media_credit: item['media:credit'] || "",
                categories: item.categories || []
              })
            });
            const data = await response.json();
            console.log(`Translation job enqueued for item ${item_id}: `, data);
          } catch (err) {
            console.error(`Error calling /job_translate for item ${item_id}: `, err);
          }
        }
      }
      
      // Agora, para o canal atual, atualize os registros que NÃO foram encontrados (marcando is_visible = 0)
      if (currentIds.length > 0) {
        await db.query(
          `UPDATE item_channels 
           SET is_visible = 0 
           WHERE channel = $1 AND item_id NOT IN (${currentIds.map((_, i) => '$' + (i+2)).join(',')})`,
          [channel, ...currentIds]
        );
      } else {
        // Se nenhum item foi encontrado, marque todos os itens desse canal como não visíveis
        await db.query(
          `UPDATE item_channels 
           SET is_visible = 0 
           WHERE channel = $1`,
          [channel]
        );
      }
    } catch (err) {
      console.error(`Error processing feed for channel ${channel}: `, err);
    }
  }
}

updateRSS()
  .then(() => console.log("RSS update completed."))
  .catch(err => console.error("Error in updateRSS: ", err));
