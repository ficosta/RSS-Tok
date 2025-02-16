// src/translationPoller.js
const fs = require('fs');
const OpenAI = require('openai');
const db = require('./db');

const COMPLETION_WINDOW = "24h";

// Configure sua chave de API via variável de ambiente
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Polling: aguarda a conclusão do batch com o batchId
async function waitForBatchCompletion(batchId) {
  while (true) {
    const batch = await openai.batches.retrieve(batchId);
    if (batch.status === "completed") {
      return batch.output_file_id;
    }
    if (batch.status === "failed" || batch.status === "expired") {
      throw new Error(`Batch ${batchId} failed or expired. Status: ${batch.status}`);
    }
    console.log(`Batch ${batchId} status: ${batch.status}. Waiting...`);
    await new Promise(resolve => setTimeout(resolve, 30000)); // Espera 30 segundos
  }
}

// Processa os resultados do batch e atualiza a coluna translations do item
async function processBatchResults(outputFileId) {
  const fileResponse = await openai.files.content(outputFileId);
  const fileContents = await fileResponse.text();
  const lines = fileContents.split("\n").filter(line => line.trim() !== "");
  for (const line of lines) {
    const result = JSON.parse(line);
    // custom_id no formato: "item_id|language|field"
    const [item_id, lang, field] = result.custom_id.split("|");
    const request_id = result.id;
    if (result.error) {
      console.error(`Error for ${result.custom_id}: ${result.error.message}`);
      // Aqui você pode atualizar o job status se desejar
    } else if (result.response && result.response.body && result.response.body.choices && result.response.body.choices.length > 0) {
      let translation = result.response.body.choices[0].message.content.trim();
      translation = translation.replace(/^"+|"+$/g, ''); // Remove aspas extra
      // Atualiza a coluna translations do item: armazenada como JSON com estrutura { "en": { "title": "...", "content": "..." }, ... }
      const res = await db.query(`SELECT translations FROM items WHERE item_id = $1`, [item_id]);
      let translationsJSON = {};
      if (res.rows.length > 0 && res.rows[0].translations) {
        translationsJSON = typeof res.rows[0].translations === 'string'
          ? JSON.parse(res.rows[0].translations)
          : res.rows[0].translations;
      }
      if (!translationsJSON[lang]) translationsJSON[lang] = {};
      translationsJSON[lang][field] = translation;
      await db.query(
        `UPDATE items SET translations = $1 WHERE item_id = $2`,
        [JSON.stringify(translationsJSON), item_id]
      );
      console.log(`Updated translation for ${item_id} - ${lang} - ${field}`);
    }
  }
}

async function pollTranslationJobs() {
  // Seleciona os itens que possuem um translation_job com status "processing"
  const res = await db.query(`SELECT item_id, translation_job FROM items WHERE translation_job::text <> '{}'`);
  for (const row of res.rows) {
    let jobData = row.translation_job;
    if (typeof jobData === 'string') {
      jobData = JSON.parse(jobData);
    }
    if (jobData.status === 'processing') {
      try {
        const outputFileId = await waitForBatchCompletion(jobData.batch_id);
        console.log(`Batch ${jobData.batch_id} completed. Output File ID: ${outputFileId}`);
        await processBatchResults(outputFileId);
        jobData.status = 'completed';
        await db.query(
          `UPDATE items SET translation_job = $1 WHERE item_id = $2`,
          [JSON.stringify(jobData), row.item_id]
        );
      } catch (error) {
        console.error(`Error processing batch for item ${row.item_id}: `, error);
        jobData.status = 'failed';
        await db.query(
          `UPDATE items SET translation_job = $1 WHERE item_id = $2`,
          [JSON.stringify(jobData), row.item_id]
        );
      }
    }
  }
}

async function translationPollerTask() {
  console.log("Starting translation poller task...");
  try {
    await pollTranslationJobs();
    console.log("Translation poller task completed.");
  } catch (error) {
    console.error("Error in translation poller task:", error);
  }
}

translationPollerTask().then(() => {
  console.log("Polling finished for this run.");
}).catch(err => {
  console.error("Error in translationPollerTask:", err);
});
