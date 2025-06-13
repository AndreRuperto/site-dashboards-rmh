import { Resend } from 'resend';

const resend = new Resend('re_BVk2fgSA_npWD4cQkwoAz9MFkgH4CdptG');

resend.emails.send({
  from: 'andre.macedo@resendemh.com.br',
  to: 'andreruperto@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
});