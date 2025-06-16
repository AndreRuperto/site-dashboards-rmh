const bcrypt = require('bcrypt');

const senhaDigitada = 'Pi314159265xd!';
const hashNoBanco = '$2a$10$qaKXS9FC70Qhf4X4Ze3pKe6VKo0umZnUC/2ZNEcDhX.zpMuoLfKMe';

bcrypt.compare(senhaDigitada, hashNoBanco)
  .then(valido => {
    if (valido) {
      console.log('Login OK!');
    } else {
      console.log('Senha inválida!');
    }
  })
  .catch(err => {
    console.error('Erro ao comparar:', err);
  });
