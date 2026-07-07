import fs from 'node:fs';
import path from 'node:path';
import { verifyAccessToken } from './access-token.js';

const PDF_PATH = path.join(process.cwd(), 'api', '_private', 'Lista bras sp.pdf');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  const verification = verifyAccessToken(token);
  if (!verification.valid) {
    return res.status(403).json({ error: 'Acesso invalido ou expirado.' });
  }

  if (!fs.existsSync(PDF_PATH)) {
    console.error('[DOWNLOAD] missing pdf', PDF_PATH);
    return res.status(500).json({ error: 'Arquivo indisponivel.' });
  }

  const stat = fs.statSync(PDF_PATH);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', 'attachment; filename="lista-fornecedores-bras.pdf"');
  res.setHeader('Cache-Control', 'private, no-store');
  fs.createReadStream(PDF_PATH).pipe(res);
}