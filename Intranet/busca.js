/**
 * busca.js — Busca global da Intranet AESA
 * Inclua no <head> do index.html após auth.js
 * Requer que showIframe() e showHome() estejam no escopo global
 */

const BUSCA_INDICE = [
  { titulo: 'Página Inicial',       descricao: 'Voltar para a home da intranet',                    pagina: '__home',          icone: 'ti-home-2',           tags: ['home', 'início', 'principal'] },
  { titulo: 'Chamados TI',          descricao: 'Abrir ou acompanhar chamados de suporte',            pagina: 'chamados.html',   icone: 'ti-ticket',           tags: ['suporte', 'problema', 'solicitação', 'ticket'] },
  { titulo: 'Calendário',           descricao: 'Eventos corporativos e datas importantes',           pagina: 'calendario.html', icone: 'ti-calendar',         tags: ['evento', 'data', 'reunião', 'feriado', 'agenda'] },
  { titulo: 'Lista de Ramais',      descricao: 'Ramais internos da AESA',                            pagina: 'ramais.html',     icone: 'ti-phone',            tags: ['telefone', 'contato', 'ramal', 'ligação'] },
  { titulo: 'Lista de E-mails',     descricao: 'E-mails corporativos da equipe',                     pagina: 'emails.html',     icone: 'ti-mail',             tags: ['email', 'contato', 'correio'] },
  { titulo: 'Fale com a AESA',      descricao: 'Canal anônimo — sugestões, elogios e reclamações',   pagina: 'fale.html',       icone: 'ti-message-circle',   tags: ['anônimo', 'sugestão', 'reclamação', 'elogio', 'feedback'] },
  { titulo: 'Canal RH',             descricao: 'Mensagens anônimas para Recursos Humanos',           pagina: 'rh.html',         icone: 'ti-users',            tags: ['rh', 'recursos humanos', 'denúncia', 'mensagem'], perfil: ['RH', 'TI'] },
  { titulo: 'Informes LGPD',        descricao: 'Políticas e informes de proteção de dados',          pagina: 'lgpd.html',       icone: 'ti-shield-lock',      tags: ['lgpd', 'privacidade', 'dados', 'proteção', 'política'] },
  { titulo: 'Código de Conduta',    descricao: 'Código de Ética e Conduta da AESA',                  pagina: 'conduta.html',    icone: 'ti-book',             tags: ['ética', 'conduta', 'normas', 'regras', 'comportamento'] },
  { titulo: 'Conheça a AESA',       descricao: 'História, missão, visão e valores da empresa',       pagina: 'conheca.html',    icone: 'ti-building',         tags: ['empresa', 'história', 'missão', 'valores', 'sobre'] },
  { titulo: 'Relatórios MTE',       descricao: 'Painel de relatórios do Ministério do Trabalho',     pagina: 'mte.html',        icone: 'ti-report-analytics', tags: ['mte', 'relatório', 'ministério', 'trabalho', 'caged'] },
  { titulo: 'Canal TI',             descricao: 'Painel TI — usuários, programas e acessos',          pagina: '__ti',            icone: 'ti-device-desktop',   tags: ['ti', 'tecnologia', 'usuário', 'acesso', 'programa', 'admin'], perfil: ['TI'] },
  { titulo: 'Configurações',        descricao: 'Tema, notificações e preferências da conta',         pagina: 'configuracoes.html', icone: 'ti-settings',      tags: ['configuração', 'tema', 'notificação', 'preferência', 'conta'] },
  { titulo: 'Slack',                descricao: 'Acessar o Slack da equipe',                          pagina: '__ext:https://slack.com/signin#/signin', icone: 'ti-brand-slack', tags: ['slack', 'mensagem', 'chat', 'comunicação'] },
  { titulo: 'WebMail',              descricao: 'Acesso ao webmail corporativo Skymail',              pagina: '__ext:https://webmail.skymail.net.br/', icone: 'ti-world',       tags: ['email', 'webmail', 'correio', 'skymail'] },
  { titulo: 'Portal AVA',           descricao: 'Cursos e treinamentos no Portal AVA',                pagina: '__ext:http://ava.aesaempilhadeiras.com.br/', icone: 'ti-school',  tags: ['ava', 'curso', 'treinamento', 'aprendizado'] },
  { titulo: 'Painéis AESA',         descricao: 'Dashboards e indicadores da AESA',                   pagina: '__ext:https://aesa.pyli.com.br/', icone: 'ti-chart-bar',       tags: ['painel', 'dashboard', 'indicador', 'pyli'] },
];

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _busca_injetar_estilos();

  const input   = document.getElementById('buscaInput');
  const dropdown = document.getElementById('buscaDropdown');
  if (!input || !dropdown) return;

  const usuario = _busca_getUsuario();

  input.addEventListener('input', () => {
    const termo = input.value.trim().toLowerCase();
    if (termo.length < 2) { _busca_fechar(dropdown); return; }
    _busca_renderizar(dropdown, _busca_filtrar(termo, usuario), input);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { _busca_fechar(dropdown); input.value = ''; input.blur(); return; }
    if (e.key === 'Enter')  { const p = dropdown.querySelector('.busca-item'); if (p) p.click(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); const p = dropdown.querySelector('.busca-item'); if (p) p.focus(); }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#buscaContainer')) _busca_fechar(dropdown);
  });
});

// ─── Filtro ───────────────────────────────────────────────────────────────────

function _busca_getUsuario() {
  try { return JSON.parse(localStorage.getItem('aesa_usuario')) || {}; } catch { return {}; }
}

function _busca_filtrar(termo, usuario) {
  const perfis = (usuario.perfis || (usuario.perfil ? [usuario.perfil] : ['COLABORADOR']))
    .map(p => String(p).toUpperCase());

  return BUSCA_INDICE.filter(item => {
    if (item.perfil && !item.perfil.some(p => perfis.includes(p))) return false;
    const hay = [item.titulo, item.descricao, ...item.tags].join(' ').toLowerCase();
    return hay.includes(termo);
  }).slice(0, 7);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function _busca_renderizar(dropdown, resultados, input) {
  dropdown.innerHTML = '';

  if (!resultados.length) {
    dropdown.innerHTML = `<div class="busca-vazio"><i class="ti ti-search-off"></i> Nenhum resultado para "<strong>${_busca_esc(input.value)}</strong>"</div>`;
    dropdown.classList.add('aberto');
    return;
  }

  resultados.forEach((item, idx) => {
    const btn = document.createElement('button');
    btn.className = 'busca-item';
    btn.tabIndex = 0;
    btn.innerHTML = `
      <span class="busca-icon"><i class="ti ${item.icone}"></i></span>
      <span class="busca-info">
        <span class="busca-titulo">${_busca_highlight(item.titulo, input.value)}</span>
        <span class="busca-desc">${item.descricao}</span>
      </span>
      <span class="busca-seta"><i class="ti ti-arrow-right"></i></span>`;

    btn.addEventListener('click', () => {
      _busca_navegar(item);
      _busca_fechar(dropdown);
      input.value = '';
      input.blur();
    });

    btn.addEventListener('keydown', (e) => {
      const itens = [...dropdown.querySelectorAll('.busca-item')];
      if (e.key === 'ArrowDown') { e.preventDefault(); itens[idx + 1]?.focus(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); idx === 0 ? input.focus() : itens[idx - 1]?.focus(); }
    });

    dropdown.appendChild(btn);
  });

  dropdown.classList.add('aberto');
}

// ─── Navegação ────────────────────────────────────────────────────────────────

function _busca_navegar(item) {
  const pag = item.pagina;

  // Link externo
  if (pag.startsWith('__ext:')) {
    window.open(pag.replace('__ext:', ''), '_blank');
    return;
  }
  // Home
  if (pag === '__home') {
    if (typeof showHome === 'function') showHome(document.getElementById('nav-home'));
    return;
  }
  // Canal TI — abre direto
  if (pag === '__ti') {
    window.location.href = 'ti.html';
    return;
  }
  // Página interna via iframe
  if (typeof showIframe === 'function') {
    showIframe(pag, null);
    return;
  }
  window.location.href = pag;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _busca_fechar(dropdown) {
  dropdown.classList.remove('aberto');
  setTimeout(() => { dropdown.innerHTML = ''; }, 180);
}

function _busca_highlight(texto, termo) {
  if (!termo) return texto;
  return texto.replace(new RegExp(`(${_busca_esc_re(termo)})`, 'gi'), '<mark>$1</mark>');
}

function _busca_esc(s)    { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _busca_esc_re(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ─── Estilos injetados ────────────────────────────────────────────────────────

function _busca_injetar_estilos() {
  if (document.getElementById('busca-styles')) return;
  const s = document.createElement('style');
  s.id = 'busca-styles';
  s.textContent = `
    #buscaContainer {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0;
    }
    #buscaInputWrap {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0 10px;
      height: 36px;
      width: 0;
      overflow: hidden;
      transition: width .25s ease, opacity .2s ease;
      opacity: 0;
    }
    #buscaInputWrap.aberto {
      width: 240px;
      opacity: 1;
      margin-right: 6px;
    }
    #buscaInputWrap i {
      font-size: 15px;
      color: var(--text-muted);
      flex-shrink: 0;
    }
    #buscaInput {
      border: none;
      background: transparent;
      outline: none;
      font-family: var(--font);
      font-size: 13px;
      color: var(--text);
      width: 100%;
      min-width: 0;
    }
    #buscaInput::placeholder { color: var(--text-muted); }
    #buscaBtnFechar {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      flex-shrink: 0;
      transition: color .15s;
    }
    #buscaBtnFechar:hover { color: var(--navy); }
    #buscaDropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 320px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      z-index: 1000;
      overflow: hidden;
      display: none;
      animation: busca-fade .15s ease;
    }
    #buscaDropdown.aberto { display: block; }
    @keyframes busca-fade {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .busca-item {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      transition: background .12s;
      border-bottom: 1px solid var(--border);
      font-family: var(--font);
    }
    .busca-item:last-child { border-bottom: none; }
    .busca-item:hover, .busca-item:focus { background: var(--bg); outline: none; }
    .busca-icon {
      width: 34px; height: 34px;
      border-radius: 8px;
      background: #eff6ff;
      color: #1e40af;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .busca-icon i { font-size: 16px; }
    .busca-info { flex: 1; min-width: 0; }
    .busca-titulo {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--navy);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .busca-titulo mark {
      background: #fff0ec;
      color: var(--orange);
      border-radius: 2px;
      padding: 0 1px;
    }
    .busca-desc {
      display: block;
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .busca-seta { color: var(--text-muted); flex-shrink: 0; font-size: 14px; }
    .busca-vazio {
      padding: 18px 16px;
      font-size: 13px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .busca-vazio i { font-size: 18px; opacity: .5; }
  `;
  document.head.appendChild(s);
}