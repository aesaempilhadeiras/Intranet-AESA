/**
 * auth.js — Proteção de sessão AESA Intranet
 * Inclua este script no <head> de TODAS as páginas protegidas:
 *   <script src="auth.js"><\/script>
 *
 * Ele verifica se há sessão válida. Se não houver, redireciona
 * para login.html imediatamente, antes de renderizar a página.
 */

(function () {
    const SESSAO_TTL = 8 * 60 * 60 * 1000; // 8 horas

    const usuario = localStorage.getItem('aesa_usuario');
    const inicio = localStorage.getItem('aesa_sessao_inicio');

    const sessaoValida = usuario && inicio && (Date.now() - parseInt(inicio)) < SESSAO_TTL;

    if (!sessaoValida) {
        // Limpa qualquer dado antigo
        localStorage.removeItem('aesa_usuario');
        localStorage.removeItem('aesa_sessao_inicio');
        // Redireciona para login
        window.location.replace('login.html');
    }
})();

/**
 * getUsuario()
 * Retorna o objeto do usuário logado:
 * { nome, email, setor }
 */
function getUsuario() {
    try {
        return JSON.parse(localStorage.getItem('aesa_usuario')) || {};
    } catch {
        return {};
    }
}

/**
 * logout()
 * Encerra a sessão e redireciona para o login.
 */
function logout() {
    localStorage.removeItem('aesa_usuario');
    localStorage.removeItem('aesa_sessao_inicio');
    window.location.replace('login.html');
}

/**
 * preencherUsuarioUI(nomeId, setorId)
 * Preenche elementos da UI com os dados do usuário.
 * Parâmetros opcionais: IDs dos elementos a preencher.
 */
function preencherUsuarioUI(nomeId, setorId, iniciaisId) {
    const u = getUsuario();
    if (nomeId && document.getElementById(nomeId))
        document.getElementById(nomeId).textContent = u.nome || 'Colaborador(a)';
    if (setorId && document.getElementById(setorId))
        document.getElementById(setorId).textContent = u.setor || 'AESA';
    if (iniciaisId && document.getElementById(iniciaisId)) {
        const partes = (u.nome || 'CO').split(' ');
        const iniciais = partes.length >= 2
            ? partes[0][0] + partes[partes.length - 1][0]
            : partes[0].substring(0, 2);
        document.getElementById(iniciaisId).textContent = iniciais.toUpperCase();
    }
}