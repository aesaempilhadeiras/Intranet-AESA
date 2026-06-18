/**
 * notificacoes-chamados.js — Notificações push de novos chamados
 * AESA Intranet
 *
 * Inclua este script em qualquer página onde o técnico (Lincoln/Giovani/
 * Guilherme) precise ser avisado em tempo real quando um chamado novo for
 * criado para ele. Deve ser incluído DEPOIS de auth.js (depende de getUsuario()).
 *
 *   <script src="auth.js"><\/script>
 *   <script src="notificacoes-chamados.js"><\/script>
 *
 * Como funciona:
 * - Abre uma conexão SSE (Server-Sent Events) com o servidor, identificando
 *   o técnico pelo login AD do usuário logado (sAMAccountName), mapeado para
 *   o nome usado em responsavel_ti (ex: "Lincoln", "Giovani").
 * - O servidor só envia o evento para a conexão do técnico designado naquele
 *   chamado — outros usuários não recebem nada.
 * - Ao receber um evento de novo chamado: toca um som curto + mostra um
 *   toast no canto da tela + (se permitido) uma notificação nativa do
 *   navegador, que funciona mesmo com a aba em segundo plano.
 *
 * Não faz nada se o usuário logado não estiver no mapa LOGIN_PARA_TECNICO
 * abaixo — colaboradores comuns não abrem essa conexão.
 */

(function () {
  // Mapeamento login AD (sAMAccountName, lowercase) → nome usado em
  // responsavel_ti no banco. Importante: o campo "nome" da sessão (vindo do
  // AD displayName) NÃO é confiável — quando o AD não tem displayName
  // cadastrado, o backend usa o próprio login como nome. Por isso o
  // mapeamento aqui é pelo login, que é estável.
  const LOGIN_PARA_TECNICO = {
    'lrodrigues':      'Lincoln',
    'giovani.almeida': 'Giovani',
    // Guilherme não recebe chamados automaticamente hoje (revezamento é só
    // Lincoln ↔ Giovani), mas se passar a receber, adicionar aqui:
    // 'login_do_guilherme': 'Guilherme',
  };

  const usuario = (typeof getUsuario === 'function') ? getUsuario() : {};
  const login = (usuario.sAMAccountName || '').trim().toLowerCase();
  const nomeTecnico = LOGIN_PARA_TECNICO[login];

  if (!nomeTecnico) {
    // Usuário não é um técnico mapeado — não abre conexão de notificação.
    return;
  }

  // ── Áudio ────────────────────────────────────────────────────
  const somNotificacao = new Audio('notificacao-chamado.mp3');
  somNotificacao.volume = 0.6;

  function tocarSom() {
    // Navegadores bloqueiam autoplay sem interação prévia do usuário;
    // como a página já exige login/clique, isso normalmente funciona,

    // mas o catch evita erro no console se o navegador ainda bloquear.
    somNotificacao.currentTime = 0;
    somNotificacao.play().catch(() => {});
  }

  // ── Permissão para notificação nativa do navegador ─────────────
  function pedirPermissaoNotificacao() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
  pedirPermissaoNotificacao();

  function mostrarNotificacaoNativa(dados) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification('Novo chamado: ' + (dados.numero || ''), {
      body: (dados.assunto || '') + (dados.nome ? ('\n' + dados.nome + ' · ' + (dados.setor || '')) : ''),
      icon: '/favicon.ico',
      tag: 'chamado-' + dados.id,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = 'chamados.html';
      n.close();
    };
  }

  // ── Toast in-page ───────────────────────────────────────────────
  function garantirEstilosToastNotificacao() {
    if (document.getElementById('estilo-toast-notificacao')) return;
    const style = document.createElement('style');
    style.id = 'estilo-toast-notificacao';
    style.textContent = `
      #toast-notificacao-chamado {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 99999;
        background: #061851;
        color: #fff;
        border-left: 4px solid #E73B1B;
        border-radius: 10px;
        padding: 14px 18px;
        min-width: 280px;
        max-width: 360px;
        box-shadow: 0 8px 28px rgba(6,24,81,.28);
        font-family: 'DM Sans', Arial, sans-serif;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        opacity: 0;
        transform: translateX(20px);
        transition: opacity .25s ease, transform .25s ease;
        cursor: pointer;
      }
      #toast-notificacao-chamado.visivel {
        opacity: 1;
        transform: translateX(0);
      }
      #toast-notificacao-chamado .tnc-icone {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: #E73B1B;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      }
      #toast-notificacao-chamado .tnc-titulo {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 2px;
      }
      #toast-notificacao-chamado .tnc-corpo {
        font-size: 12px;
        color: rgba(255,255,255,.8);
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  let timeoutToastAtual = null;

  function mostrarToast(dados) {
    garantirEstilosToastNotificacao();

    let el = document.getElementById('toast-notificacao-chamado');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-notificacao-chamado';
      document.body.appendChild(el);
    }

    el.innerHTML = `
      <div class="tnc-icone">🔔</div>
      <div>
        <div class="tnc-titulo">Novo chamado: ${escaparHTML(dados.numero || '')}</div>
        <div class="tnc-corpo">${escaparHTML(dados.assunto || '')}${dados.nome ? ('<br>' + escaparHTML(dados.nome) + (dados.setor ? ' · ' + escaparHTML(dados.setor) : '')) : ''}</div>
      </div>
    `;
    el.onclick = () => { window.location.href = 'chamados.html'; };

    requestAnimationFrame(() => el.classList.add('visivel'));

    if (timeoutToastAtual) clearTimeout(timeoutToastAtual);
    timeoutToastAtual = setTimeout(() => {
      el.classList.remove('visivel');
    }, 8000);
  }

  function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  // ── Conexão SSE ──────────────────────────────────────────────
  let eventSource = null;
  let tentativasReconexao = 0;

  function conectar() {
    if (eventSource) eventSource.close();

    eventSource = new EventSource('/chamados/eventos?tecnico=' + encodeURIComponent(nomeTecnico));

    eventSource.onopen = () => {
      tentativasReconexao = 0;
    };

    eventSource.onmessage = (evento) => {
      try {
        const dados = JSON.parse(evento.data);
        if (dados.tipo === 'novo_chamado') {
          tocarSom();
          mostrarToast(dados);
          mostrarNotificacaoNativa(dados);
        }
      } catch (err) {
        // Mensagens de comentário (heartbeat) não chegam aqui via onmessage
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      // Reconecta com backoff (até 30s entre tentativas)
      tentativasReconexao++;
      const espera = Math.min(30000, 2000 * tentativasReconexao);
      setTimeout(conectar, espera);
    };
  }

  conectar();

  // Reconecta se a aba ficar muito tempo em segundo plano e a conexão cair
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && eventSource && eventSource.readyState === EventSource.CLOSED) {
      conectar();
    }
  });
})();
