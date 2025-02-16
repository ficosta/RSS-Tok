// src/jobTranslate.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const db = require('./db');

const app = express();
app.use(express.json());

const TARGET_LANGUAGES = ["en", "pt", "es", "tr"];
const BATCH_FILE = 'job_batch_input.jsonl';
const COMPLETION_WINDOW = "24h";

// Configure sua chave de API via variável de ambiente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/job_translate', async (req, res) => {
  try {
    const { item_id, title, content, link, pubDate, media_content, media_thumbnail, media_credit, categories } = req.body;

    let requests = [];
    TARGET_LANGUAGES.forEach(lang => {
      // Requisição para traduzir o título
      requests.push({
        custom_id: `${item_id}|${lang}|title`,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `You are a translator of texts from German to ${lang === 'en' ? "English" : lang === 'pt' ? "Portuguese (Brazil)" : lang === 'es' ? "Spanish" : "Turkish"}.` },
            { role: "user", content: `Translate the following text: "${title}"` }
          ],
          store: true
        }
      });
      // Requisição para traduzir o conteúdo
      requests.push({
        custom_id: `${item_id}|${lang}|content`,
        method: "POST",
        url: "/v1/chat/completions",
        body: {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `You are a translator of texts from German to ${lang === 'en' ? "English" : lang === 'pt' ? "Portuguese (Brazil)" : lang === 'es' ? "Spanish" : "Turkish"}.` },
            { role: "user", content: `Translate the following text: "${content}"` }
          ],
          store: true
        }
      });
    });

    // Cria arquivo JSONL com as requisições
    const lines = requests.map(r => JSON.stringify(r)).join("\n");
    const batchFilePath = path.resolve(BATCH_FILE);
    fs.writeFileSync(batchFilePath, lines);

    // Upload do arquivo via Files API da OpenAI
    const fileResponse = await openai.files.create({
      file: fs.createReadStream(batchFilePath),
      purpose: "batch",
    });
    const inputFileId = fileResponse.id;

    // Cria o batch job
    const batch = await openai.batches.create({
      input_file_id: inputFileId,
      endpoint: "/v1/chat/completions",
      completion_window: COMPLETION_WINDOW
    });
    const batchId = batch.id;

    // Atualiza o campo translation_job do item com os dados do job
    const jobData = {
      batch_id: batchId,
      status: "processing",
      submitted_at: Date.now(),
      target_languages: TARGET_LANGUAGES,
      requests: requests.length
    };
    await db.query(
      `UPDATE items SET translation_job = $1 WHERE item_id = $2`,
      [JSON.stringify(jobData), item_id]
    );

    // Remove o arquivo temporário
    fs.unlinkSync(batchFilePath);

    res.json({ message: "Translation job enqueued", job: jobData });
  } catch (error) {
    console.error("Error in /job_translate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT_TRANSLATOR || 3002;
app.listen(PORT, () => console.log(`Job Translate service running on port ${PORT}`));
