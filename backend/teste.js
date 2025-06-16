import fs from 'fs/promises';
import path from 'path';

const base64Path = path.resolve('./base64.txt');
const outputPath = path.resolve('./teste_base64.html');

async function gerarTemplate() {
  try {
    const base64 = (await fs.readFile(base64Path, 'utf8')).trim();

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Teste Base64</title>
      </head>
      <body>
        <h1>Imagem carregada do base64.txt:</h1>
        <img src="data:image/png;base64,${base64}" alt="Logo RMH" />
      </body>
      </html>
    `;

    await fs.writeFile(outputPath, html, 'utf8');
    console.log('✅ Arquivo teste_base64.html gerado com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao gerar template:', err);
  }
}

gerarTemplate();
