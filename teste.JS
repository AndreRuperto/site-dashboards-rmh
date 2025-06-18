import { Resend } from 'resend';

const resend = new Resend('re_JpQQ8Txm_BeVnKFGeNiAtww1jZNZhbP7L');

const dominios = await resend.domains.list();

console.dir(dominios, { depth: null });