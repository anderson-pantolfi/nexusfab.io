"use strict";
// ============================================================
// 1. INFRAESTRUTURA (único valor fixo: o endereço da API)
// ============================================================
const API_URL = 'http://localhost/nexusfab/src/php/api.php';
// ============================================================
// 3. DADOS VINDOS DO BANCO (preenchidos em /inicializacao)
// ============================================================
const App = { configuracoes: [], categorias: [], periodos: [], visoes: [] };
function configuracao(chave) {
    const cfg = App.configuracoes.find(c => c.chave === chave);
    if (!cfg)
        throw new Error(`Configuração "${chave}" não encontrada no banco de dados.`);
    return cfg;
}
const cfgNumero = (chave) => Number(configuracao(chave).valor);
const cfgTexto = (chave) => String(configuracao(chave).valor);
const metaPadrao = () => cfgNumero('meta_padrao');
function nomeMes(mes, curto = false) {
    const periodo = App.periodos.find(p => p.codigo === String(mes));
    return (curto ? periodo?.rotulo_curto : periodo?.rotulo) ?? `Mês ${mes}`;
}
function obterPeriodo(codigo) {
    const periodo = App.periodos.find(p => p.codigo === codigo);
    if (!periodo)
        throw new Error(`Período "${codigo}" não encontrado no banco de dados.`);
    return periodo;
}
function horasDe(h, chave) {
    return h[`horas_${chave}`] ?? 0;
}
// ============================================================
// 4. UTILITÁRIOS
// ============================================================
function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function elemento(id) {
    return document.getElementById(id);
}
function elementoObrigatorio(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Elemento #${id} não encontrado.`);
    return el;
}
function criarOption(valor, texto) {
    const opt = document.createElement('option');
    opt.value = valor;
    opt.textContent = texto;
    return opt;
}
function formatarNumero(valor, casas = 1) {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
const formatarPercentual = (valor) => `${formatarNumero(valor)}%`;
const percentual = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);
/** Minúsculas e sem acentos, para buscas que ignoram "João" vs "joao". */
const normalizarTexto = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function hojeISO() {
    const agora = new Date();
    return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function debounce(fn, ms) {
    let timer;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), ms);
    };
}
const lerNumero = (id) => parseFloat(elementoObrigatorio(id).value);
function mostrarErro(e) {
    Swal.fire('Erro', e instanceof Error ? e.message : 'Erro inesperado.', 'error');
}
function notificar(mensagem) {
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: mensagem, showConfirmButton: false, timer: 2500, timerProgressBar: true });
}
function zerarHoras() {
    return { horas_ronda: 0, horas_produtivas: 0, horas_improdutivas: 0, horas_reparo: 0, horas_flutuantes: 0 };
}
function totalizar(linhas) {
    const total = zerarHoras();
    linhas.forEach(l => {
        total.horas_ronda += l.horas_ronda;
        total.horas_produtivas += l.horas_produtivas;
        total.horas_improdutivas += l.horas_improdutivas;
        total.horas_reparo += l.horas_reparo;
        total.horas_flutuantes += l.horas_flutuantes;
    });
    return total;
}
const produtividade = (h) => percentual(h.horas_produtivas, h.horas_ronda);
// ============================================================
// 5. API
// ============================================================
class ApiError extends Error {
    status;
    dados;
    constructor(mensagem, status, dados = {}) {
        super(mensagem);
        this.name = 'ApiError';
        this.status = status;
        this.dados = dados;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}
class ApiService {
    async request(recurso, metodo = 'GET', params = {}, corpo) {
        const qs = new URLSearchParams({ recurso });
        Object.entries(params).forEach(([chave, valor]) => qs.set(chave, String(valor)));
        const init = { method: metodo, headers: { 'Content-Type': 'application/json' } };
        if (corpo !== undefined)
            init.body = JSON.stringify(corpo);
        let resposta;
        try {
            resposta = await fetch(`${API_URL}?${qs.toString()}`, init);
        }
        catch {
            throw new ApiError('Não foi possível conectar ao servidor.', 0);
        }
        let dados = {};
        try {
            dados = await resposta.json();
        }
        catch { /* resposta sem JSON */ }
        if (!resposta.ok) {
            const erro = dados['erro'];
            const detalhe = dados['detalhe'];
            const base = typeof erro === 'string' ? erro : `Falha na requisição (${resposta.status}).`;
            throw new ApiError(typeof detalhe === 'string' ? `${base} (${detalhe})` : base, resposta.status, dados);
        }
        return dados;
    }
    getInicializacao() { return this.request('inicializacao'); }
    getSetores() { return this.request('setores'); }
    criarSetor(nome, meta_percentual) {
        return this.request('setores', 'POST', {}, { nome, meta_percentual });
    }
    excluirSetor(id) {
        return this.request('setores', 'DELETE', { id });
    }
    getCargos() { return this.request('cargos'); }
    async getAnos() {
        const anos = await this.request('anos');
        return anos.map(Number);
    }
    getFuncionarios() { return this.request('funcionarios'); }
    criarFuncionario(codigo_matricula, setor, nome, cargo) {
        return this.request('funcionarios', 'POST', {}, { codigo_matricula, setor, nome, cargo });
    }
    excluirFuncionario(id, forcar) {
        return this.request('funcionarios', 'DELETE', forcar ? { id, forcar: 1 } : { id });
    }
    getEsteiras() { return this.request('esteiras'); }
    criarEsteira(codigo_patrimonio, nome_descricao) {
        return this.request('esteiras', 'POST', {}, { codigo_patrimonio, nome_descricao });
    }
    excluirEsteira(id, forcar) {
        return this.request('esteiras', 'DELETE', forcar ? { id, forcar: 1 } : { id });
    }
    criarApontamento(dados) {
        return this.request('apontamentos', 'POST', {}, dados);
    }
    getDashboard(ano, mesInicio, mesFim, esteira) {
        return this.request('dashboard', 'GET', { ano, mes_ini: mesInicio, mes_fim: mesFim, id_esteira: esteira });
    }
    salvarConfiguracao(chave, valor) {
        return this.request('configuracoes', 'POST', {}, { chave, valor });
    }
    salvarPerfil(nome, email) {
        return this.request('perfil', 'POST', {}, { nome, email });
    }
    salvarTema(tema) {
        return this.request('tema', 'POST', {}, { tema });
    }
}
// ============================================================
// 6. TEMA, MENUS, PERFIL, NOTIFICAÇÕES E CONFIGURAÇÕES
// ============================================================
class ThemeManager {
    api;
    constructor(api, temaInicial) {
        this.api = api;
        this.aplicar(temaInicial === 'dark');
        elemento('btn-theme')?.addEventListener('click', () => {
            const escuro = document.body.getAttribute('data-theme') !== 'dark';
            this.aplicar(escuro);
            window.dispatchEvent(new CustomEvent('nexus:tema'));
            this.api.salvarTema(escuro ? 'dark' : 'light').catch(mostrarErro);
        });
    }
    aplicar(escuro) {
        if (escuro)
            document.body.setAttribute('data-theme', 'dark');
        else
            document.body.removeAttribute('data-theme');
        const icone = elemento('theme-icon');
        if (icone)
            icone.className = escuro ? 'fas fa-sun' : 'fas fa-moon';
    }
}
class UIManager {
    abas;
    constructor(abas) {
        this.abas = abas;
        this.montarMenu('menu-lateral', 'menu');
        this.montarMenu('menu-perfil-links', 'perfil');
        const alternar = (menuId, e) => {
            e.stopPropagation();
            const menu = elemento(menuId);
            document.querySelectorAll('.dropdown-content').forEach(el => { if (el !== menu)
                el.classList.remove('show'); });
            menu?.classList.toggle('show');
        };
        elemento('btn-profile')?.addEventListener('click', e => alternar('profile-menu', e));
        elemento('btn-notif')?.addEventListener('click', e => alternar('notif-menu', e));
        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
        });
        const primeira = abas.find(a => a.posicao === 'menu');
        if (primeira)
            this.abrirAba(primeira.codigo);
    }
    montarMenu(containerId, posicao) {
        const container = elementoObrigatorio(containerId);
        container.innerHTML = '';
        this.abas.filter(a => a.posicao === posicao).forEach(aba => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'nav-link';
            link.setAttribute('data-target', aba.codigo);
            const icone = document.createElement('i');
            icone.className = aba.icone;
            link.appendChild(icone);
            link.appendChild(document.createTextNode(` ${aba.rotulo_menu}`));
            link.addEventListener('click', (e) => { e.preventDefault(); this.abrirAba(aba.codigo); });
            container.appendChild(link);
        });
    }
    abrirAba(codigo) {
        document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));
        elemento(codigo)?.classList.add('active');
        document.querySelectorAll(`.nav-link[data-target="${codigo}"]`).forEach(el => el.classList.add('active'));
        const barra = elemento('barra-filtros');
        if (barra)
            barra.style.display = codigo === 'dashboard' ? 'flex' : 'none';
        const aba = this.abas.find(a => a.codigo === codigo);
        if (aba) {
            const titulo = elemento('topbar-titulo');
            const subtitulo = elemento('topbar-subtitulo');
            if (titulo)
                titulo.textContent = aba.titulo;
            if (subtitulo)
                subtitulo.textContent = aba.subtitulo;
        }
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }
}
class PerfilManager {
    api;
    usuario;
    constructor(api, usuario) {
        this.api = api;
        this.usuario = usuario;
        this.renderizar();
        elemento('form-perfil')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                this.usuario = await this.api.salvarPerfil(elementoObrigatorio('perfil-nome').value.trim(), elementoObrigatorio('perfil-email').value.trim());
                this.renderizar();
                notificar('Perfil atualizado.');
            }
            catch (err) {
                mostrarErro(err);
            }
        });
    }
    renderizar() {
        const u = this.usuario;
        if (!u)
            return;
        const definirImagem = (id) => { const img = elemento(id); if (img)
            img.src = u.avatar_url; };
        definirImagem('avatar-topbar');
        definirImagem('perfil-avatar');
        const apelido = elemento('nome-topbar');
        if (apelido)
            apelido.textContent = u.apelido;
        const nome = elemento('perfil-nome');
        if (nome)
            nome.value = u.nome;
        const email = elemento('perfil-email');
        if (email)
            email.value = u.email;
    }
}
function renderizarNotificacoes(lista) {
    const container = elementoObrigatorio('notif-lista');
    container.innerHTML = '';
    lista.forEach(n => {
        const link = document.createElement('a');
        link.href = '#';
        link.addEventListener('click', (e) => e.preventDefault());
        const icone = document.createElement('i');
        icone.className = n.icone;
        link.appendChild(icone);
        link.appendChild(document.createTextNode(` ${n.mensagem}`));
        container.appendChild(link);
    });
    const naoLidas = lista.filter(n => !n.lida).length;
    const badge = elementoObrigatorio('notif-badge');
    badge.textContent = String(naoLidas);
    badge.hidden = naoLidas === 0;
}
class ConfiguracoesManager {
    api;
    constructor(api) {
        this.api = api;
        this.renderizar();
    }
    renderizar() {
        const lista = elementoObrigatorio('lista-configuracoes');
        lista.innerHTML = '';
        App.configuracoes.filter(c => c.editavel).forEach(cfg => {
            const item = document.createElement('div');
            item.className = 'setting-item';
            const info = document.createElement('div');
            info.innerHTML = `<strong>${escapeHtml(cfg.titulo)}</strong><p class="text-muted" style="font-size: 0.85rem;">${escapeHtml(cfg.descricao)}</p>`;
            item.appendChild(info);
            item.appendChild(this.criarControle(cfg));
            lista.appendChild(item);
        });
    }
    criarControle(cfg) {
        if (cfg.tipo === 'booleano') {
            const rotulo = document.createElement('label');
            rotulo.className = 'toggle-switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = cfg.valor === true;
            input.addEventListener('change', () => { void this.salvar(cfg, input.checked); });
            const slider = document.createElement('span');
            slider.className = 'slider';
            rotulo.appendChild(input);
            rotulo.appendChild(slider);
            return rotulo;
        }
        const input = document.createElement('input');
        input.className = 'form-input setting-input';
        input.type = cfg.tipo === 'numero' ? 'number' : 'text';
        input.value = String(cfg.valor);
        if (cfg.minimo !== null)
            input.min = String(cfg.minimo);
        if (cfg.maximo !== null)
            input.max = String(cfg.maximo);
        input.addEventListener('change', () => {
            void this.salvar(cfg, cfg.tipo === 'numero' ? Number(input.value) : input.value.trim());
        });
        return input;
    }
    async salvar(cfg, valor) {
        try {
            const resposta = await this.api.salvarConfiguracao(cfg.chave, valor);
            cfg.valor = resposta.valor;
            notificar('Configuração salva.');
            window.dispatchEvent(new CustomEvent('nexus:config'));
        }
        catch (e) {
            mostrarErro(e);
            this.renderizar();
        }
    }
}
// ============================================================
// 7. DASHBOARD
// ============================================================
class DashboardManager {
    api;
    graficos = [];
    metasSetor = {};
    ultimosDados = [];
    requisicaoAtual = 0;
    constructor(api) {
        this.api = api;
        ['filtro-ano', 'filtro-mes', 'filtro-esteira'].forEach(id => elemento(id)?.addEventListener('change', () => { void this.atualizarDashboard(); }));
        elemento('filtro-visao')?.addEventListener('change', () => this.renderizar());
        elemento('btn-limpar-filtros')?.addEventListener('click', () => this.limparFiltros());
        window.addEventListener('nexus:tema', () => this.renderizar());
        window.addEventListener('nexus:config', () => this.renderizar());
    }
    // ---------- dados de apoio ----------
    definirSetores(setores) {
        this.metasSetor = {};
        setores.forEach(s => { this.metasSetor[s.nome] = Number(s.meta_percentual); });
    }
    definirEsteiras(esteiras) {
        const select = elemento('filtro-esteira');
        if (!select)
            return;
        const atual = select.value;
        select.innerHTML = '';
        select.appendChild(criarOption('todas', 'Visão Global (Todas)'));
        esteiras.forEach(e => select.appendChild(criarOption(String(e.id_esteira), `${e.nome_descricao} (${e.codigo_patrimonio})`)));
        if (esteiras.some(e => String(e.id_esteira) === atual))
            select.value = atual;
    }
    async prepararFiltros() {
        const periodo = elementoObrigatorio('filtro-mes');
        periodo.innerHTML = '';
        App.periodos.forEach(p => periodo.appendChild(criarOption(p.codigo, p.rotulo)));
        const visao = elementoObrigatorio('filtro-visao');
        visao.innerHTML = '';
        App.visoes.forEach(v => visao.appendChild(criarOption(v.codigo, v.rotulo)));
        const anos = await this.api.getAnos();
        const atual = new Date().getFullYear();
        const lista = anos.length > 0 ? anos : [atual];
        const select = elementoObrigatorio('filtro-ano');
        select.innerHTML = '';
        lista.forEach(a => select.appendChild(criarOption(String(a), String(a))));
        select.value = String(lista.includes(atual) ? atual : Math.max(...lista));
    }
    limparFiltros() {
        ['filtro-mes', 'filtro-visao', 'filtro-esteira'].forEach(id => { elementoObrigatorio(id).selectedIndex = 0; });
        void this.atualizarDashboard();
    }
    obterFiltros() {
        return {
            ano: Number(elementoObrigatorio('filtro-ano').value),
            periodo: obterPeriodo(elementoObrigatorio('filtro-mes').value),
            visao: elementoObrigatorio('filtro-visao').value,
            esteira: elementoObrigatorio('filtro-esteira').value
        };
    }
    // ---------- carga e renderização ----------
    async atualizarDashboard() {
        const filtros = this.obterFiltros();
        const id = ++this.requisicaoAtual;
        elemento('dashboard')?.classList.add('carregando');
        try {
            const dados = await this.api.getDashboard(filtros.ano, filtros.periodo.mes_inicio, filtros.periodo.mes_fim, filtros.esteira);
            if (id !== this.requisicaoAtual)
                return; // chegou uma requisição mais nova
            this.ultimosDados = dados;
            this.renderizar();
        }
        catch (e) {
            if (id === this.requisicaoAtual)
                mostrarErro(e);
        }
        finally {
            if (id === this.requisicaoAtual)
                elemento('dashboard')?.classList.remove('carregando');
        }
    }
    renderizar() {
        const grid = elementoObrigatorio('dashboard-grid');
        const kpis = elementoObrigatorio('kpi-grid');
        this.graficos.forEach(g => g.destroy());
        this.graficos = [];
        grid.innerHTML = '';
        kpis.innerHTML = '';
        this.aplicarTemaGraficos();
        const filtros = this.obterFiltros();
        const individual = filtros.esteira !== 'todas';
        elementoObrigatorio('filtro-visao').disabled = individual;
        const dados = this.ultimosDados;
        this.gerarRelatorio(dados, individual);
        if (dados.length === 0) {
            grid.innerHTML = '<div class="card estado-vazio span-total"><i class="fas fa-inbox"></i><p>Nenhum apontamento encontrado para os filtros selecionados.</p></div>';
            return;
        }
        this.renderizarKpis(dados, kpis);
        if (individual)
            this.renderizarVisaoEsteira(dados, grid);
        else
            this.renderizarVisaoGeral(dados, filtros, grid);
    }
    aplicarTemaGraficos() {
        const css = getComputedStyle(document.body);
        Chart.defaults.color = css.getPropertyValue('--text-muted').trim();
        Chart.defaults.borderColor = css.getPropertyValue('--border-color').trim();
        Chart.defaults.font.family = "'Inter', sans-serif";
    }
    corTexto() {
        return getComputedStyle(document.body).getPropertyValue('--text-main').trim();
    }
    metaDoSetor(setor) {
        return this.metasSetor[setor] ?? metaPadrao();
    }
    // ---------- cálculos ----------
    metaDe(linhas) {
        const total = linhas.reduce((s, l) => s + l.horas_ronda, 0);
        if (total === 0)
            return metaPadrao();
        return linhas.reduce((s, l) => s + this.metaDoSetor(l.setor) * l.horas_ronda, 0) / total;
    }
    agrupar(linhas, modo) {
        const mapa = new Map();
        linhas.forEach(l => {
            const chave = modo === 'mes' ? `m${l.mes}` : modo === 'esteira' ? `e${l.id_esteira}` : l.setor;
            let ag = mapa.get(chave);
            if (!ag) {
                const rotulo = modo === 'mes' ? nomeMes(l.mes, true) : modo === 'esteira' ? l.nome_esteira : l.setor;
                ag = { ...l, ...zerarHoras(), rotulo, prodPura: 0 };
                mapa.set(chave, ag);
            }
            ag.horas_ronda += l.horas_ronda;
            ag.horas_produtivas += l.horas_produtivas;
            ag.horas_improdutivas += l.horas_improdutivas;
            ag.horas_reparo += l.horas_reparo;
            ag.horas_flutuantes += l.horas_flutuantes;
        });
        return Array.from(mapa.values()).map(a => ({ ...a, prodPura: produtividade(a) }));
    }
    // ---------- KPIs ----------
    renderizarKpis(dados, container) {
        const t = totalizar(dados);
        const prod = produtividade(t);
        const meta = this.metaDe(dados);
        const delta = prod - meta;
        const esteirasAtivas = new Set(dados.map(d => d.id_esteira)).size;
        const kpi = (classe, icone, titulo, valor, detalhe, cor = '') => `
            <div class="kpi-card ${classe}" ${cor ? `style="border-left-color: ${escapeHtml(cor)};"` : ''}>
                <div class="kpi-icone" ${cor ? `style="color: ${escapeHtml(cor)}; background-color: ${escapeHtml(cor)}1f;"` : ''}><i class="${escapeHtml(icone)}"></i></div>
                <div><div class="kpi-title">${escapeHtml(titulo)}</div><div class="kpi-valor">${valor}</div><div class="kpi-detalhe">${detalhe}</div></div>
            </div>`;
        const perdas = App.categorias.filter(c => c.perda).map(c => {
            const horas = horasDe(t, c.chave);
            return kpi('', c.icone, c.rotulo, formatarPercentual(percentual(horas, t.horas_ronda)), `${formatarNumero(horas, 0)} h`, c.cor);
        }).join('');
        container.innerHTML =
            kpi(delta >= 0 ? 'kpi-ok' : 'kpi-falha', 'fas fa-bullseye', 'Produtividade Geral', formatarPercentual(prod), `Meta ${formatarPercentual(meta)} · ${delta >= 0 ? '+' : ''}${formatarNumero(delta)} p.p.`) +
                kpi('kpi-neutro', 'fas fa-clock', 'Horas Operadas', `${formatarNumero(t.horas_ronda, 0)} h`, `${esteirasAtivas} esteiras ativas`) +
                perdas;
    }
    // ---------- visões ----------
    renderizarVisaoGeral(dados, filtros, grid) {
        if (filtros.periodo.mes_inicio !== filtros.periodo.mes_fim) {
            const porMes = this.agrupar(dados, 'mes').sort((a, b) => a.mes - b.mes);
            const metas = porMes.map(m => this.metaDe(dados.filter(d => d.mes === m.mes)));
            this.graficoCombinado(grid, `Evolução Mensal — ${filtros.periodo.rotulo} · ${filtros.ano}`, 'Visão consolidada de todos os setores', porMes, metas, true);
        }
        this.graficoSetores(grid, this.agrupar(dados, 'setor'));
        const titulo = document.createElement('h3');
        titulo.className = 'section-title span-total';
        titulo.textContent = 'Desempenho por Setor';
        grid.appendChild(titulo);
        const visao = App.visoes.find(v => v.codigo === filtros.visao);
        const piores = visao?.ordenacao === 'produtividade_asc';
        const limite = cfgNumero('top_esteiras');
        Object.keys(this.metasSetor).forEach(nomeSetor => {
            const dSetor = dados.filter(d => d.setor === nomeSetor);
            if (dSetor.length === 0)
                return;
            const porEsteira = this.agrupar(dSetor, 'esteira');
            porEsteira.sort((a, b) => piores ? a.prodPura - b.prodPura : b.horas_ronda - a.horas_ronda);
            const meta = this.metaDoSetor(nomeSetor);
            const media = produtividade(totalizar(dSetor));
            const destaque = `<div class="kpi-inline"><span class="kpi-title">Média do setor</span><span class="kpi-valor ${media >= meta ? 'good' : 'danger'}">${formatarPercentual(media)}</span></div>`;
            const subtitulo = `Meta ${meta}% · ${limite} ${visao?.descricao_curta ?? ''} de ${porEsteira.length} esteiras`;
            const recorte = porEsteira.slice(0, limite);
            this.graficoCombinado(grid, nomeSetor, subtitulo, recorte, recorte.map(() => meta), false, destaque);
        });
    }
    renderizarVisaoEsteira(dados, grid) {
        const primeiro = dados[0];
        if (!primeiro)
            return;
        const meta = this.metaDe(dados);
        const setores = Array.from(new Set(dados.map(d => d.setor))).join(', ');
        const porMes = this.agrupar(dados, 'mes').sort((a, b) => a.mes - b.mes);
        this.graficoCombinado(grid, `Análise Temporal — ${primeiro.nome_esteira}`, `Setor: ${setores} · Meta ${formatarPercentual(meta)}`, porMes, porMes.map(() => meta), true);
    }
    // ---------- gráficos ----------
    criarCard(grid, titulo, subtitulo, largo, extra = '') {
        const card = document.createElement('div');
        card.className = `card chart-card${largo ? ' span-total' : ''}`;
        card.innerHTML = `
            <div class="chart-header"><div><h4>${escapeHtml(titulo)}</h4><p class="chart-subtitle">${escapeHtml(subtitulo)}</p></div>${extra}</div>
            <div class="canvas-container"><canvas></canvas></div>`;
        grid.appendChild(card);
        return card.querySelector('canvas')?.getContext('2d') ?? null;
    }
    graficoCombinado(grid, titulo, subtitulo, dados, metas, largo, extra = '') {
        const ctx = this.criarCard(grid, titulo, subtitulo, largo, extra);
        if (!ctx)
            return;
        const barras = App.categorias.map(c => ({
            type: 'bar', label: c.rotulo, data: dados.map(d => horasDe(d, c.chave)),
            backgroundColor: c.cor, yAxisID: 'y', order: 2
        }));
        this.graficos.push(new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.map(d => d.rotulo),
                datasets: [
                    { type: 'line', label: 'Produtividade (%)', data: dados.map(d => d.prodPura), borderColor: this.corTexto(), backgroundColor: this.corTexto(), yAxisID: 'y1', tension: 0.3, borderWidth: 3, order: 1 },
                    { type: 'line', label: 'Meta (%)', data: metas, borderColor: cfgTexto('cor_meta'), borderDash: [5, 5], pointRadius: 0, yAxisID: 'y1', borderWidth: 2, order: 0 },
                    ...barras
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, position: 'left', title: { display: true, text: 'Horas' } },
                    y1: { position: 'right', min: 0, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: '%' } }
                },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatarNumero(c.parsed.y)}${c.dataset.yAxisID === 'y1' ? '%' : ' h'}` } }
                }
            }
        }));
    }
    graficoSetores(grid, porSetor) {
        const ctx = this.criarCard(grid, 'Produtividade por Setor vs Meta', 'Verde: meta atingida · Vermelho: abaixo da meta', false);
        if (!ctx)
            return;
        const linhas = porSetor.map(s => ({ nome: s.setor, prod: s.prodPura, meta: this.metaDoSetor(s.setor) }));
        const corOk = cfgTexto('cor_ok');
        const corFalha = cfgTexto('cor_falha');
        this.graficos.push(new Chart(ctx, {
            type: 'bar',
            data: {
                labels: linhas.map(l => l.nome),
                datasets: [
                    { label: 'Produtividade (%)', data: linhas.map(l => l.prod), backgroundColor: linhas.map(l => l.prod >= l.meta ? corOk : corFalha), borderRadius: 6 },
                    { label: 'Meta (%)', data: linhas.map(l => l.meta), backgroundColor: `${cfgTexto('cor_meta')}59`, borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { grid: { display: false } }, y: { min: 0, max: 100 } },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatarNumero(c.parsed.y)}%` } }
                }
            }
        }));
    }
    // ---------- relatório ----------
    rankingCausas(t) {
        return App.categorias.filter(c => c.perda).map(c => {
            const horas = horasDe(t, c.chave);
            return { titulo: c.rotulo_longo, acao: c.acao ?? '', horas, pct: percentual(horas, t.horas_ronda) };
        }).sort((a, b) => b.horas - a.horas);
    }
    gerarRelatorio(dados, individual) {
        const corpo = elemento('report-body');
        if (!corpo)
            return;
        if (dados.length === 0) {
            corpo.innerHTML = '<p class="text-muted">Nenhum dado encontrado para os filtros selecionados.</p>';
            return;
        }
        const total = totalizar(dados);
        const prod = produtividade(total);
        const meta = this.metaDe(dados);
        const titulo = individual ? `Análise de Desempenho: ${escapeHtml(dados[0]?.nome_esteira)}` : 'Resumo Consolidado';
        let html = `
            <div class="insight-card ${prod >= meta ? 'positive' : 'negative'}">
                <div class="insight-title">${titulo}</div>
                Produtividade pura: <b>${formatarPercentual(prod)}</b> (meta ${formatarPercentual(meta)}) em ${formatarNumero(total.horas_ronda, 0)} h operadas.
                ${prod >= meta ? '<br><b>Excelente:</b> dentro ou acima da meta.' : `<br><b>Alerta:</b> ${formatarNumero(meta - prod)} p.p. abaixo da meta. Requer atenção.`}
            </div>`;
        if (!individual)
            html += this.tabelaSetores(dados) + this.tabelaCriticas(dados);
        const plano = this.rankingCausas(total)
            .map(c => `<li><b>${escapeHtml(c.titulo)} (${formatarPercentual(c.pct)} das horas operadas):</b> ${escapeHtml(c.acao)}</li>`).join('');
        html += `<div class="insight-card positive"><div class="insight-title">🛠️ Plano de Ação (priorizado pelo maior impacto)</div><ul class="action-list">${plano}</ul></div>`;
        corpo.innerHTML = html;
    }
    tabelaSetores(dados) {
        const linhas = Object.keys(this.metasSetor).map(nome => {
            const d = dados.filter(x => x.setor === nome);
            if (d.length === 0)
                return '';
            const t = totalizar(d);
            const real = produtividade(t);
            const meta = this.metaDoSetor(nome);
            const gap = real - meta;
            const causa = gap >= 0 ? '—' : escapeHtml(this.rankingCausas(t)[0]?.titulo);
            return `<tr>
                <td>${escapeHtml(nome)}</td><td>${meta}%</td><td>${formatarPercentual(real)}</td>
                <td class="${gap >= 0 ? 'text-success' : 'text-danger'}">${gap >= 0 ? '+' : ''}${formatarNumero(gap)} p.p.</td>
                <td><span class="status-badge ${gap >= 0 ? 'ok' : 'fail'}">${gap >= 0 ? 'Meta atingida' : 'Abaixo da meta'}</span></td>
                <td>${causa}</td></tr>`;
        }).join('');
        return `<div class="insight-card neutral"><div class="insight-title">📊 Metas por Setor</div>
            <div class="table-responsive"><table class="data-table"><thead><tr><th>Setor</th><th>Meta</th><th>Real</th><th>Diferença</th><th>Status</th><th>Principal perda</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
    }
    tabelaCriticas(dados) {
        const piores = this.agrupar(dados, 'esteira').filter(e => e.horas_ronda > 0).sort((a, b) => a.prodPura - b.prodPura).slice(0, 5);
        const linhas = piores.map(e => `<tr><td>${escapeHtml(e.nome_esteira)}</td><td>${escapeHtml(e.setor)}</td><td class="text-danger">${formatarPercentual(e.prodPura)}</td><td>${this.metaDoSetor(e.setor)}%</td></tr>`).join('');
        return `<div class="insight-card negative"><div class="insight-title">⚠️ 5 Esteiras Mais Críticas</div>
            <div class="table-responsive"><table class="data-table"><thead><tr><th>Esteira</th><th>Setor</th><th>Produtividade</th><th>Meta do setor</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
    }
}
class TabelaGerenciavel {
    opcoes;
    itens = [];
    pagina = 1;
    destaque = null;
    constructor(opcoes) {
        this.opcoes = opcoes;
        elemento(opcoes.buscaId)?.addEventListener('input', debounce(() => this.reiniciar(), 200));
        window.addEventListener('nexus:config', () => this.reiniciar());
    }
    definirItens(itens) {
        this.itens = itens;
        this.renderizar();
    }
    reiniciar() {
        this.pagina = 1;
        this.destaque = null;
        this.renderizar();
    }
    /** Limpa a busca, abre a página do registro e o destaca. */
    mostrar(predicado) {
        const busca = elemento(this.opcoes.buscaId);
        if (busca)
            busca.value = '';
        this.destaque = predicado;
        const indice = this.filtrar().findIndex(predicado);
        if (indice >= 0)
            this.pagina = Math.floor(indice / cfgNumero('itens_por_pagina')) + 1;
        this.renderizar();
    }
    filtrar() {
        const palavras = normalizarTexto(elemento(this.opcoes.buscaId)?.value ?? '').split(/\s+/).filter(p => p !== '');
        const extra = this.opcoes.filtroExtra;
        return this.itens.filter(i => {
            const texto = normalizarTexto(this.opcoes.textoBusca(i));
            return palavras.every(p => texto.includes(p)) && (!extra || extra(i));
        });
    }
    renderizar() {
        const corpo = elemento(this.opcoes.corpoId);
        if (!corpo)
            return;
        const porPagina = cfgNumero('itens_por_pagina');
        const filtrados = this.filtrar();
        const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
        this.pagina = Math.min(this.pagina, totalPaginas);
        const inicio = (this.pagina - 1) * porPagina;
        corpo.innerHTML = '';
        const visiveis = filtrados.slice(inicio, inicio + porPagina);
        if (visiveis.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = this.opcoes.colunas.length + 1;
            td.className = 'celula-vazia';
            td.textContent = this.opcoes.rotuloVazio;
            tr.appendChild(td);
            corpo.appendChild(tr);
        }
        visiveis.forEach(item => {
            const tr = document.createElement('tr');
            if (this.destaque && this.destaque(item))
                tr.className = 'linha-destaque';
            this.opcoes.colunas.forEach(coluna => {
                const td = document.createElement('td');
                td.textContent = coluna(item);
                tr.appendChild(td);
            });
            const acoes = document.createElement('td');
            acoes.className = 'col-acoes';
            const botao = document.createElement('button');
            botao.type = 'button';
            botao.className = 'btn-icon danger';
            botao.title = 'Excluir';
            botao.innerHTML = '<i class="fas fa-trash"></i>';
            botao.addEventListener('click', () => this.opcoes.aoExcluir(item));
            acoes.appendChild(botao);
            tr.appendChild(acoes);
            corpo.appendChild(tr);
        });
        const contador = elemento(this.opcoes.contadorId);
        if (contador)
            contador.textContent = `${filtrados.length} de ${this.itens.length}`;
        this.renderizarPaginacao(totalPaginas);
    }
    renderizarPaginacao(totalPaginas) {
        const container = elemento(this.opcoes.paginacaoId);
        if (!container)
            return;
        container.innerHTML = '';
        const botao = (icone, destino, desabilitado) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-outline btn-sm';
            b.innerHTML = `<i class="fas ${icone}"></i>`;
            b.disabled = desabilitado;
            b.addEventListener('click', () => { this.pagina = destino; this.renderizar(); });
            return b;
        };
        const info = document.createElement('span');
        info.textContent = `Página ${this.pagina} de ${totalPaginas}`;
        container.appendChild(botao('fa-chevron-left', this.pagina - 1, this.pagina <= 1));
        container.appendChild(info);
        container.appendChild(botao('fa-chevron-right', this.pagina + 1, this.pagina >= totalPaginas));
    }
}
// ============================================================
// 9. CADASTROS (funcionários, esteiras, apontamentos)
// ============================================================
class CadastroManager {
    api;
    dashboard;
    tabelaFuncionarios;
    tabelaEsteiras;
    tabelaSetores;
    setores = [];
    funcionarios = [];
    esteiras = [];
    constructor(api, dashboard) {
        this.api = api;
        this.dashboard = dashboard;
        this.tabelaFuncionarios = new TabelaGerenciavel({
            corpoId: 'func-corpo', contadorId: 'func-contador', paginacaoId: 'func-paginacao', buscaId: 'busca-func',
            colunas: [f => f.codigo_matricula, f => f.nome, f => f.setor, f => f.cargo],
            textoBusca: f => `${f.nome} ${f.codigo_matricula} ${f.cargo}`,
            rotuloVazio: 'Nenhum funcionário encontrado.',
            aoExcluir: f => { void this.excluirFuncionario(f); },
            filtroExtra: f => {
                const setor = elemento('filtro-func-setor')?.value ?? '';
                return setor === '' || f.setor === setor;
            }
        });
        this.tabelaEsteiras = new TabelaGerenciavel({
            corpoId: 'est-corpo', contadorId: 'est-contador', paginacaoId: 'est-paginacao', buscaId: 'busca-est',
            colunas: [e => e.codigo_patrimonio, e => e.nome_descricao],
            textoBusca: e => `${e.codigo_patrimonio} ${e.nome_descricao}`,
            rotuloVazio: 'Nenhuma esteira encontrada.',
            aoExcluir: e => { void this.excluirEsteira(e); }
        });
        this.tabelaSetores = new TabelaGerenciavel({
            corpoId: 'set-corpo', contadorId: 'set-contador', paginacaoId: 'set-paginacao', buscaId: 'busca-set',
            colunas: [s => s.nome, s => `${formatarNumero(Number(s.meta_percentual))}%`, s => String(s.total_funcionarios)],
            textoBusca: s => s.nome,
            rotuloVazio: 'Nenhum setor encontrado.',
            aoExcluir: s => { void this.excluirSetor(s); }
        });
        elemento('filtro-func-setor')?.addEventListener('change', () => this.tabelaFuncionarios.reiniciar());
        this.iniciarFormularios();
    }
    async carregarDadosIniciais() {
        const [setores, funcionarios, esteiras] = await Promise.all([
            this.api.getSetores(), this.api.getFuncionarios(), this.api.getEsteiras()
        ]);
        this.setores = setores;
        this.funcionarios = funcionarios;
        this.esteiras = esteiras;
        this.dashboard.definirSetores(setores);
        this.dashboard.definirEsteiras(esteiras);
        this.atualizarSelects();
        this.tabelaFuncionarios.definirItens(funcionarios);
        this.tabelaEsteiras.definirItens(esteiras);
        this.tabelaSetores.definirItens(setores);
        await this.carregarCargos();
        this.aplicarCargoPadrao();
        this.aplicarMetaPadraoSetor();
    }
    async carregarCargos() {
        const lista = elemento('lista-cargos');
        if (!lista)
            return;
        lista.innerHTML = '';
        (await this.api.getCargos()).forEach(cargo => lista.appendChild(criarOption(cargo, cargo)));
    }
    aplicarCargoPadrao() {
        const campo = elemento('cad-op-cargo');
        if (campo)
            campo.value = cfgTexto('cargo_padrao');
    }
    aplicarMetaPadraoSetor() {
        const campo = elemento('cad-setor-meta');
        if (campo)
            campo.value = String(metaPadrao());
    }
    /** Recarrega os setores e propaga para metas, selects, tabelas e gráficos. */
    async recarregarSetores(redesenharDashboard) {
        this.setores = await this.api.getSetores();
        this.dashboard.definirSetores(this.setores);
        this.atualizarSelects();
        this.tabelaSetores.definirItens(this.setores);
        if (redesenharDashboard)
            this.dashboard.renderizar();
    }
    async recarregarFuncionarios() {
        this.funcionarios = await this.api.getFuncionarios();
        this.atualizarSelects();
        this.tabelaFuncionarios.definirItens(this.funcionarios);
        await this.carregarCargos();
        await this.recarregarSetores(false); // atualiza a contagem de funcionários por setor
    }
    async recarregarEsteiras() {
        this.esteiras = await this.api.getEsteiras();
        this.dashboard.definirEsteiras(this.esteiras);
        this.atualizarSelects();
        this.tabelaEsteiras.definirItens(this.esteiras);
    }
    atualizarSelects() {
        this.renderizarOpcoesFuncionario();
        const selEsteira = elemento('ap-esteira');
        if (selEsteira) {
            selEsteira.innerHTML = '';
            selEsteira.appendChild(criarOption('', 'Selecione uma esteira...'));
            this.esteiras.forEach(e => selEsteira.appendChild(criarOption(String(e.id_esteira), `${e.nome_descricao} (${e.codigo_patrimonio})`)));
        }
        const selCadastro = elemento('cad-op-setor');
        if (selCadastro) {
            const atual = selCadastro.value;
            selCadastro.innerHTML = '';
            this.setores.forEach(s => selCadastro.appendChild(criarOption(s.nome, s.nome)));
            if (this.setores.some(s => s.nome === atual))
                selCadastro.value = atual;
        }
        const selFiltro = elemento('filtro-func-setor');
        if (selFiltro) {
            const atual = selFiltro.value;
            selFiltro.innerHTML = '';
            selFiltro.appendChild(criarOption('', 'Todos os setores'));
            this.setores.forEach(s => selFiltro.appendChild(criarOption(s.nome, s.nome)));
            if (this.setores.some(s => s.nome === atual))
                selFiltro.value = atual;
        }
    }
    // ---------- busca de funcionário no apontamento ----------
    funcionariosFiltrados() {
        const palavras = normalizarTexto(elemento('ap-busca-func')?.value ?? '').split(/\s+/).filter(p => p !== '');
        return this.funcionarios.filter(f => {
            const texto = normalizarTexto(`${f.nome} ${f.codigo_matricula}`);
            return palavras.every(p => texto.includes(p));
        });
    }
    renderizarOpcoesFuncionario() {
        const select = elemento('ap-operador');
        if (!select)
            return;
        const buscando = (elemento('ap-busca-func')?.value ?? '').trim() !== '';
        const anterior = select.value;
        const encontrados = this.funcionariosFiltrados();
        select.innerHTML = '';
        select.appendChild(criarOption('', 'Selecione um funcionário...'));
        const grupos = new Map();
        encontrados.forEach(f => {
            let grupo = grupos.get(f.setor);
            if (!grupo) {
                grupo = document.createElement('optgroup');
                grupo.label = f.setor;
                grupos.set(f.setor, grupo);
                select.appendChild(grupo);
            }
            grupo.appendChild(criarOption(String(f.id_funcionario), `${f.nome} (Matrícula: ${f.codigo_matricula})`));
        });
        const unico = encontrados.length === 1 ? encontrados[0] : undefined;
        if (encontrados.some(f => String(f.id_funcionario) === anterior))
            select.value = anterior;
        else if (buscando && unico)
            select.value = String(unico.id_funcionario);
        const info = elemento('ap-busca-info');
        if (info)
            info.textContent = buscando ? `${encontrados.length} encontrado(s) de ${this.funcionarios.length}` : `${this.funcionarios.length} funcionários`;
    }
    // ---------- setores ----------
    async excluirSetor(setor) {
        try {
            const confirmacao = await Swal.fire({
                title: 'Confirmar exclusão',
                html: `Deseja realmente excluir o setor <b>${escapeHtml(setor.nome)}</b>?`,
                icon: 'warning', showCancelButton: true, reverseButtons: true,
                confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar', confirmButtonColor: cfgTexto('cor_falha')
            });
            if (!confirmacao.isConfirmed)
                return;
            await this.api.excluirSetor(setor.id_setor);
            await this.recarregarSetores(true);
            notificar(`Setor ${setor.nome} excluído.`);
        }
        catch (e) {
            mostrarErro(e); // ex.: setor ainda possui funcionários
        }
    }
    // ---------- exclusão ----------
    async confirmarExclusao(descricao, executar, avisoVinculos) {
        const primeira = await Swal.fire({
            title: 'Confirmar exclusão',
            html: `Deseja realmente excluir <b>${escapeHtml(descricao)}</b>?`,
            icon: 'warning', showCancelButton: true, reverseButtons: true,
            confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar', confirmButtonColor: cfgTexto('cor_falha')
        });
        if (!primeira.isConfirmed)
            return false;
        try {
            await executar(false);
            return true;
        }
        catch (e) {
            const vinculos = e instanceof ApiError ? e.dados['vinculos'] : undefined;
            if (e instanceof ApiError && e.status === 409 && typeof vinculos === 'number') {
                const segunda = await Swal.fire({
                    title: 'Existem registros vinculados',
                    html: avisoVinculos(vinculos),
                    icon: 'warning', showCancelButton: true, reverseButtons: true,
                    confirmButtonText: 'Excluir tudo', cancelButtonText: 'Cancelar', confirmButtonColor: cfgTexto('cor_falha')
                });
                if (!segunda.isConfirmed)
                    return false;
                await executar(true);
                return true;
            }
            throw e;
        }
    }
    async excluirFuncionario(f) {
        try {
            const excluido = await this.confirmarExclusao(`${f.nome} (matrícula ${f.codigo_matricula})`, forcar => this.api.excluirFuncionario(f.id_funcionario, forcar), qtd => `Este funcionário possui <b>${qtd}</b> apontamento(s). Continuar apagará também todo o histórico dele.`);
            if (!excluido)
                return;
            await this.recarregarFuncionarios();
            notificar('Funcionário excluído.');
            await this.dashboard.atualizarDashboard();
        }
        catch (e) {
            mostrarErro(e);
        }
    }
    async excluirEsteira(esteira) {
        try {
            const excluido = await this.confirmarExclusao(`${esteira.nome_descricao} (${esteira.codigo_patrimonio})`, forcar => this.api.excluirEsteira(esteira.id_esteira, forcar), qtd => `Esta esteira está vinculada a <b>${qtd}</b> registro(s) de apontamento. Continuar removerá esses vínculos e as horas dela sairão do dashboard.`);
            if (!excluido)
                return;
            await this.recarregarEsteiras();
            notificar('Esteira excluída.');
            await this.dashboard.atualizarDashboard();
        }
        catch (e) {
            mostrarErro(e);
        }
    }
    // ---------- formulários ----------
    iniciarFormularios() {
        const busca = elemento('ap-busca-func');
        busca?.addEventListener('input', () => this.renderizarOpcoesFuncionario());
        busca?.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter')
                return;
            e.preventDefault(); // não envia o formulário; escolhe o primeiro resultado
            const primeiro = this.funcionariosFiltrados()[0];
            const select = elemento('ap-operador');
            if (primeiro && select)
                select.value = String(primeiro.id_funcionario);
        });
        elemento('form-setor')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const nome = elementoObrigatorio('cad-setor-nome').value.trim();
            try {
                await this.api.criarSetor(nome, lerNumero('cad-setor-meta'));
                await this.recarregarSetores(true);
                this.tabelaSetores.mostrar(s => s.nome === nome);
                notificar(`Setor ${nome} criado e disponível em todo o sistema.`);
                form.reset();
                this.aplicarMetaPadraoSetor();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
        elemento('form-esteira')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            try {
                const codigo = elementoObrigatorio('cad-codigo').value.trim().toUpperCase();
                const gravada = await this.api.criarEsteira(codigo, elementoObrigatorio('cad-descricao').value.trim());
                await this.recarregarEsteiras();
                this.tabelaEsteiras.mostrar(esteira => esteira.codigo_patrimonio === codigo);
                notificar(`Esteira cadastrada no banco (ID ${gravada.id_esteira}).`);
                form.reset();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
        elemento('form-operador')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const nome = elementoObrigatorio('cad-op-nome').value.trim();
            try {
                const matricula = elementoObrigatorio('cad-op-cracha').value.trim();
                const gravado = await this.api.criarFuncionario(matricula, elementoObrigatorio('cad-op-setor').value, nome, elementoObrigatorio('cad-op-cargo').value.trim());
                await this.recarregarFuncionarios();
                const filtroSetor = elemento('filtro-func-setor');
                if (filtroSetor)
                    filtroSetor.value = '';
                this.tabelaFuncionarios.mostrar(f => f.codigo_matricula === matricula);
                notificar(`Funcionário ${nome} cadastrado no banco (ID ${gravado.id_funcionario}).`);
                form.reset();
                this.aplicarCargoPadrao();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
        elemento('form-apontamento')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dados = {
                id_funcionario: parseInt(elementoObrigatorio('ap-operador').value),
                id_esteira: parseInt(elementoObrigatorio('ap-esteira').value),
                data_registro: elementoObrigatorio('ap-data').value,
                horas_trabalhadas_nela: lerNumero('ap-horas-nela'),
                horas_ronda: lerNumero('ap-ronda'),
                horas_apontadas: lerNumero('ap-apontadas'),
                horas_produtivas: lerNumero('ap-produtivas'),
                horas_improdutivas: lerNumero('ap-improdutivas'),
                horas_reparo: lerNumero('ap-reparo'),
                horas_flutuantes: lerNumero('ap-flutuantes')
            };
            if (isNaN(dados.id_funcionario) || isNaN(dados.id_esteira)) {
                Swal.fire('Erro', 'Selecione o funcionário e a esteira.', 'error');
                return;
            }
            if (dados.horas_trabalhadas_nela > dados.horas_ronda) {
                Swal.fire('Erro', 'As horas na esteira não podem exceder as horas de ronda.', 'error');
                return;
            }
            const somaCategorias = dados.horas_produtivas + dados.horas_improdutivas + dados.horas_reparo + dados.horas_flutuantes;
            if (somaCategorias > dados.horas_ronda + 0.001) {
                Swal.fire('Erro', 'A soma de produtivas, improdutivas, reparo e flutuantes excede as horas de ronda.', 'error');
                return;
            }
            try {
                await this.api.criarApontamento(dados);
                notificar('Apontamento registrado.');
                ['ap-horas-nela', 'ap-ronda', 'ap-apontadas', 'ap-produtivas', 'ap-improdutivas', 'ap-reparo', 'ap-flutuantes']
                    .forEach(id => { const el = elemento(id); if (el)
                    el.value = ''; });
                await this.dashboard.atualizarDashboard();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
    }
}
// ============================================================
// 10. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const api = new ApiService();
    try {
        // 1) Tudo que a tela precisa (menus, filtros, cores, metas, perfil...) vem do banco
        const inicio = await api.getInicializacao();
        App.configuracoes = inicio.configuracoes;
        App.categorias = inicio.categorias;
        App.periodos = inicio.periodos;
        App.visoes = inicio.visoes;
        document.title = cfgTexto('titulo_pagina');
        elementoObrigatorio('nome-sistema').textContent = cfgTexto('nome_sistema');
        const data = elemento('ap-data');
        if (data)
            data.value = hojeISO();
        new ThemeManager(api, inicio.usuario?.tema ?? '');
        new UIManager(inicio.abas);
        new PerfilManager(api, inicio.usuario);
        new ConfiguracoesManager(api);
        renderizarNotificacoes(inicio.notificacoes);
        // 2) Dashboard e cadastros
        const dashboard = new DashboardManager(api);
        const cadastros = new CadastroManager(api, dashboard);
        await Promise.all([cadastros.carregarDadosIniciais(), dashboard.prepararFiltros()]);
        await dashboard.atualizarDashboard();
    }
    catch (e) {
        mostrarErro(e);
    }
});
