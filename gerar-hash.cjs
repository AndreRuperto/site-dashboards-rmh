const bcrypt = require('bcrypt');

async function gerarHash() {
  const senha = 'adminRMH';
  const hash = await bcrypt.hash(senha, 10);
  console.log('Senha:', senha);
  console.log('Hash:', hash);
}

gerarHash();