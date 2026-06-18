// reembolso-bridge.js — AESA Reembolsos v4
// Adaptado para schema reembolso (PostgreSQL local)
// Tabelas: reembolso.perfis_usuario, reembolso.solicitacoes, reembolso.historico
// Autenticação: sessão da Intranet (localStorage aesa_usuario)

const API_URL = 'https://intranet.aesaempilhadeiras.com.br'; // usa HTTPS para evitar mixed content
const SESSION_TTL = 8 * 60 * 60 * 1000;

const PATH_LOGIN = '../login.html';
const PATH_INTRANET = '../index.html';

// ── Proxy banco ───────────────────────────────────────────────
async function db(metodo, tabela, params, body) {
  const res = await fetch(`${API_URL}/db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metodo, tabela, params: params || '', body: body || null }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function enviarEmail(para, assunto, html, cc) {
  try {
    await fetch(`${API_URL}/email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ para, cc, assunto, html }),
    });
  } catch (e) { console.warn('Erro ao enviar e-mail:', e); }
}

// ── Lê sessão da Intranet ─────────────────────────────────────
function lerSessaoIntranet() {
  try {
    const raw = localStorage.getItem('aesa_usuario');
    const inicio = localStorage.getItem('sessao_inicio');
    if (!raw) return null;
    if (inicio && (Date.now() - parseInt(inicio)) > SESSION_TTL) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

// ── Inicialização assíncrona ──────────────────────────────────
async function iniciarSessaoReembolso() {
  const sessao = lerSessaoIntranet();
  if (!sessao) {
    window.location.href = PATH_LOGIN + '?retorno=' + encodeURIComponent(window.location.href);
    return null;
  }

  const sam = sessao.sAMAccountName || sessao.usuario || '';
  const nome = sessao.nome || sessao.displayName || sam || 'Usuário';
  const email = sessao.email || `${sam}@AESAEMP.REDE`;

  const perfisIntranet = Array.isArray(sessao.perfis)
    ? sessao.perfis
    : (sessao.perfil ? [sessao.perfil] : (sessao.ehTI ? ['TI'] : []));

  try {
    const resposta = await fetch(`${API_URL}/reembolso/sessao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_login: sam,
        nome: nome,
        email: email,
        perfis_intranet: perfisIntranet,
      }),
    });

    if (!resposta.ok) throw new Error(await resposta.text());
    const dados = await resposta.json();

    await carregarSetores();

    return {
      usuario_login: sam,
      nome: nome,
      email: email,
      email_corporativo: sessao.email_corporativo || null,
      perfis: dados.perfis || ['GESTOR'],
      perfil: (dados.perfis || ['GESTOR'])[0],
    };

  } catch (e) {
    console.warn('Bridge: falha ao iniciar sessão no servidor, usando fallback:', e);

    const perfisFallback = _mapearPerfis(perfisIntranet);
    await carregarSetores();

    return {
      usuario_login: sam,
      nome: nome,
      email: email,
      email_corporativo: sessao.email_corporativo || null,
      perfis: perfisFallback,
      perfil: perfisFallback[0],
    };
  }
}

function _mapearPerfis(perfisIntranet) {
  if (!perfisIntranet || !perfisIntranet.length) return ['GESTOR'];
  const set = new Set(['GESTOR']);
  for (const p of perfisIntranet) {
    const u = (p || '').toUpperCase();
    if (u === 'TI') { set.add('TI'); set.add('CHEFE'); set.add('FINANCEIRO'); }
    if (u === 'RH') { set.add('CHEFE'); set.add('FINANCEIRO'); }
    if (u === 'CHEFE') set.add('CHEFE');
    if (u === 'FINANCEIRO') set.add('FINANCEIRO');
  }
  return [...set];
}

// ── Perfil ativo (seleção múltipla) ──────────────────────────
function getPerfilAtivo(usuario) {
  const ativo = localStorage.getItem('reembolso_perfilAtivo');
  const perfis = usuario.perfis && usuario.perfis.length ? usuario.perfis : [usuario.perfil];
  return (ativo && perfis.includes(ativo)) ? ativo : perfis[0];
}

// ── Navegação ─────────────────────────────────────────────────
function logout() { localStorage.removeItem('reembolso_perfilAtivo'); window.location.href = PATH_INTRANET; }
function trocarTela() { window.location.href = 'selecao.html'; }
function limparSessao() { logout(); }
function renderNav() { return ''; }
function verificarLogin() { return null; }

// ── Histórico ─────────────────────────────────────────────────
async function registrarHistorico(solicitacao_id, usuario_login, acao, descricao) {
  try {
    await db('POST', 'historico', '', {
      id: crypto.randomUUID(),
      solicitacao_id,
      usuario_login: typeof usuario_login === 'object'
        ? (usuario_login.usuario_login || usuario_login.nome || '')
        : usuario_login,
      acao,
      descricao,
      data_acao: new Date().toISOString(),
    });
  } catch (e) { console.warn('Erro ao registrar histórico:', e); }
}

// ── Busca e-mail corporativo do solicitante por login ─────────
async function buscarEmailSolicitante(usuario_login) {
  try {
    const res = await db('GET', 'usuarios_intranet',
      `?usuario_ad=eq.${usuario_login}&select=email_corporativo,email&limit=1`
    );
    if (res && res[0]) return res[0].email_corporativo || null;
  } catch (e) { }
  return null;
}

// ── Busca aprovadores pelo perfis_usuario ─────────────────────
async function buscarAprovadores() {
  try {
    const [chefes, financeiros] = await Promise.all([
      db('GET', 'perfis_usuario', '?perfil=eq.CHEFE&ativo=eq.true&select=usuario_login'),
      db('GET', 'perfis_usuario', '?perfil=eq.FINANCEIRO&ativo=eq.true&select=usuario_login'),
    ]);

    const logins = [...new Set([
      ...chefes.map(r => r.usuario_login),
      ...financeiros.map(r => r.usuario_login),
    ])];

    if (!logins.length) return [];

    const usuarios = await db('GET', 'usuarios_intranet',
      `?usuario_ad=in.(${logins.join(',')})&select=usuario_ad,email_corporativo,email`
    );

    return usuarios
      .map(u => u.email_corporativo || null)
      .filter(e => e && e.includes('@') && !e.toUpperCase().includes('AESAEMP.REDE'));

  } catch (e) {
    console.warn('Erro ao buscar aprovadores:', e);
    return [];
  }
}

// ── Utilitários ───────────────────────────────────────────────
// Lista completa de setores — sempre exibida independente do banco
const SETORES_PADRAO = ['Comercial', 'Compras', 'Diretoria', 'Estoque', 'Financeiro',
  'Fiscal/Faturamento', 'Oficina', 'PSA', 'Remanufatura', 'Rental', 'RH',
  'Segurança do Trabalho', 'T.I', 'Taskr', 'Vendas', 'Venda de Peças', 'VWA'];

let SETORES = [...SETORES_PADRAO];

async function carregarSetores() {
  try {
    const res = await db('GET', 'perfis_usuario', '?select=setor_acesso&ativo=eq.true');
    const doBanco = res.map(r => r.setor_acesso).filter(s => s && s.trim());
    // Mescla fallback + banco, sem duplicatas, ordenado alfabeticamente
    SETORES = [...new Set([...SETORES_PADRAO, ...doBanco])].sort();
  } catch (e) {
    console.warn('Bridge: usando setores fallback');
    SETORES = [...SETORES_PADRAO];
  }
}

const PERFIL_LABELS = { GESTOR: 'Gestor', CHEFE: 'Aprovador', FINANCEIRO: 'Financeiro', TI: 'Administrador' };
const PERFIL_CORES = { GESTOR: '#3b82f6', CHEFE: '#E73B1B', FINANCEIRO: '#10b981', TI: '#061851' };
const PERFIL_ROTAS = { GESTOR: 'gestor.html', CHEFE: 'aprovador.html', FINANCEIRO: 'financeiro.html', TI: 'ti.html' };

function formatarData(data) {
  if (!data) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) { const [a, m, d] = data.split('-'); return `${d}/${m}/${a}`; }
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
function formatarValor(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function statusBadge(status) {
  const cfg = {
    PENDENTE: { bg: '#fff8e1', color: '#b45309', label: 'Pendente' },
    APROVADO: { bg: '#ecfdf5', color: '#065f46', label: 'Aprovado' },
    REJEITADO: { bg: '#fef2f2', color: '#991b1b', label: 'Rejeitado' },
    CONCLUIDO: { bg: '#eff6ff', color: '#1e40af', label: 'Concluído' },
  };
  const c = cfg[status] || cfg.PENDENTE;
  return `<span style="background:${c.bg};color:${c.color};padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;">${c.label}</span>`;
}
function formatarDataHora(dt) {
  if (!dt) return '—';
  const dtUTC = dt.endsWith('Z') || dt.includes('+') ? dt : dt + 'Z';
  const d = new Date(new Date(dtUTC).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatarDataHoraEmail(dt) { return formatarDataHora(dt || new Date().toISOString()); }
function nomeMesEmail(mesStr) {
  if (!mesStr) return '—';
  const [ano, mes] = mesStr.split('-');
  const n = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${n[parseInt(mes) - 1]} ${ano}`;
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ── Templates de email ────────────────────────────────────────
function emailTemplate(titulo, conteudo, rodape) {
  return `<div style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;padding:32px 0;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
      <div style="background:#061851;padding:24px 32px;">
        <span style="color:white;font-size:18px;font-weight:700;">AESA Reembolsos</span>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#061851;font-size:18px;font-weight:700;margin:0 0 20px;">${titulo}</h2>
        ${conteudo}
      </div>
      <div style="background:#f8f9fb;border-top:1px solid #e2e6ea;padding:16px 32px;text-align:center;">
        <p style="color:#6b7280;font-size:12px;margin:0;">
          AESA Empilhadeiras &mdash; Sistema de Reembolsos<br>
          ${rodape || 'E-mail automático, não responda.'}
        </p>
      </div>
    </div>
  </div>`;
}
function linhaInfo(label, valor, destaque) {
  return `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f4f8;">
    <span style="color:#6b7280;font-size:13px;">${label}</span>
    <span style="color:${destaque ? '#061851' : '#0f1923'};font-size:13px;font-weight:${destaque ? '700' : '500'};">${valor}</span>
  </div>`;
}
function btnEmail(texto, url) {
  return `<div style="text-align:center;margin:24px 0 8px;">
    <a href="${url}" style="background:#E73B1B;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">${texto}</a>
  </div>`;
}

// ── Emails de notificação ─────────────────────────────────────

// Nova solicitação: aprovadores no Para, solicitante no Cc
async function emailNovaSolicitacao(reembolso) {
  try {
    const ap = await buscarAprovadores();
    if (!ap.length) return;
    const html = emailTemplate(
      '🔔 Nova solicitação de reembolso',
      `<p style="color:#374151;font-size:14px;margin:0 0 20px;">
         Uma nova solicitação de <strong>${reembolso.nome_solicitante || reembolso.nome}</strong> aguarda sua análise.
       </p>
       <div style="background:#f8f9fb;border-radius:8px;padding:4px 16px;margin-bottom:20px;">
         ${linhaInfo('Solicitante', reembolso.nome_solicitante || reembolso.nome)}
         ${linhaInfo('Setor', reembolso.departamento)}
         ${linhaInfo('Descrição', reembolso.descricao)}
         ${linhaInfo('Valor', formatarValor(reembolso.valor), true)}
         ${linhaInfo('Mês de referência', nomeMesEmail(reembolso.mes_referencia))}
         ${linhaInfo('Solicitado em', formatarDataHoraEmail())}
       </div>
       ${btnEmail('Ver no sistema', 'https://intranet.aesaempilhadeiras.com.br/reembolso/reembolsos.html')}`,
      'Acesse o sistema para aprovar ou rejeitar.'
    );
    const cc = (reembolso.email_solicitante && reembolso.email_solicitante.includes('@'))
      ? reembolso.email_solicitante
      : null;
    await enviarEmail(
      ap,
      `🔔 Nova solicitação — ${reembolso.nome_solicitante || reembolso.nome} (${formatarValor(reembolso.valor)})`,
      html,
      cc
    );
  } catch (e) { console.warn('Erro e-mail nova solicitação:', e); }
}

// Atualização de status: aprovadores no Para, solicitante no Cc
async function emailAtualizacaoStatus(reembolso, status, motivo) {
  const cfg = {
    APROVADO: { emoji: '✅', titulo: 'Reembolso aprovado!', cor: '#065f46', bg: '#ecfdf5', texto: `A solicitação de <strong>${reembolso.nome_solicitante || reembolso.nome}</strong> foi <strong>aprovada</strong> e encaminhada ao financeiro.` },
    REJEITADO: { emoji: '❌', titulo: 'Reembolso rejeitado', cor: '#991b1b', bg: '#fef2f2', texto: `A solicitação de <strong>${reembolso.nome_solicitante || reembolso.nome}</strong> foi <strong>rejeitada</strong>.` },
    CONCLUIDO: { emoji: '💰', titulo: 'Reembolso concluído!', cor: '#1e40af', bg: '#eff6ff', texto: `O reembolso de <strong>${reembolso.nome_solicitante || reembolso.nome}</strong> foi <strong>marcado como pago</strong> pelo financeiro.` },
  }[status];
  if (!cfg) return;

  const motivoHTML = motivo
    ? `<div style="background:#fef2f2;border-left:3px solid #fca5a5;border-radius:6px;padding:12px 16px;margin:16px 0;">
         <p style="color:#991b1b;font-size:13px;margin:0;"><strong>Motivo:</strong> ${motivo}</p>
       </div>`
    : '';

  const html = emailTemplate(
    `${cfg.emoji} ${cfg.titulo}`,
    `<div style="background:${cfg.bg};border-radius:8px;padding:12px 16px;margin-bottom:20px;">
       <p style="color:${cfg.cor};font-size:14px;margin:0;">${cfg.texto}</p>
     </div>
     <div style="background:#f8f9fb;border-radius:8px;padding:4px 16px;margin-bottom:16px;">
       ${linhaInfo('Descrição', reembolso.descricao)}
       ${linhaInfo('Valor', formatarValor(reembolso.valor), true)}
       ${linhaInfo('Setor', reembolso.departamento)}
       ${linhaInfo('Atualizado em', formatarDataHoraEmail())}
     </div>
     ${motivoHTML}
     ${status !== 'REJEITADO' ? btnEmail('Ver no sistema', 'https://intranet.aesaempilhadeiras.com.br/reembolso/reembolsos.html') : ''}`
  );

  try {
    const ap = await buscarAprovadores();

    if (!ap.length) {
      console.warn('emailAtualizacaoStatus: nenhum aprovador encontrado para status', status);
      return;
    }

    // ✅ Aprovadores no Para, solicitante no Cc
    const cc = (reembolso.email_solicitante && reembolso.email_solicitante.includes('@'))
      ? reembolso.email_solicitante
      : null;

    await enviarEmail(ap, `${cfg.emoji} ${cfg.titulo} — ${reembolso.descricao}`, html, cc);
  } catch (e) { console.warn('Erro e-mail status:', e); }
}