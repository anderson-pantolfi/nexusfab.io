"use strict";
// ============================================================
// 1. CONFIGURAÇÃO
// ============================================================
const API_URL = 'http://localhost/nexusfab/src/php/api.php';
const META_PADRAO = 80;
const TOP_ESTEIRAS = 10;
const ITENS_POR_PAGINA = 12;
const CORES = {
    produtivas: '#10b981',
    improdutivas: '#f59e0b',
    reparo: '#ef4444',
    flutuantes: '#8b5cf6',
    meta: '#2563eb'
};
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TITULOS = {
    dashboard: ['Painel de Gestão e Eficiência', 'Visão Estratégica de Produção'],
    relatorio: ['Relatório Gerencial', 'Diagnóstico automático e plano de ação'],
    apontamentos: ['Apontamentos', 'Registro diário de produtividade'],
    funcionarios: ['Funcionários', 'Cadastro e gestão da equipe'],
    esteiras: ['Esteiras', 'Cadastro e gestão de máquinas'],
    perfil: ['Meu Perfil', 'Dados da conta'],
    configuracoes: ['Configurações', 'Preferências do sistema']
};
// ============================================================
// 3. UTILITÁRIOS
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
function formatarPercentual(valor) {
    return `${formatarNumero(valor)}%`;
}
function nomeMes(mes, curto = false) {
    return (curto ? MESES_CURTOS : MESES)[mes] ?? `Mês ${mes}`;
}
function percentual(parte, total) {
    return total > 0 ? (parte / total) * 100 : 0;
}
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
function lerNumero(id) {
    return parseFloat(elementoObrigatorio(id).value);
}
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
function produtividade(h) {
    return percentual(h.horas_produtivas, h.horas_ronda);
}
const PERIODOS = {
    todos: { inicio: 1, fim: 12, rotulo: 'Ano completo' },
    S1: { inicio: 1, fim: 6, rotulo: '1º Semestre' },
    S2: { inicio: 7, fim: 12, rotulo: '2º Semestre' }
};
function obterPeriodo(valor) {
    const fixo = PERIODOS[valor];
    if (fixo)
        return fixo;
    const mes = Number(valor);
    return { inicio: mes, fim: mes, rotulo: nomeMes(mes) };
}
// ============================================================
// 4. API
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
            throw new ApiError(typeof erro === 'string' ? erro : `Falha na requisição (${resposta.status}).`, resposta.status, dados);
        }
        return dados;
    }
    getSetores() { return this.request('setores'); }
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
}
// ============================================================
// 5. TEMA E NAVEGAÇÃO
// ============================================================
class ThemeManager {
    CHAVE = 'nexus_theme';
    constructor() {
        if (localStorage.getItem(this.CHAVE) === 'dark')
            this.aplicar(true);
        elemento('btn-theme')?.addEventListener('click', () => {
            this.aplicar(document.body.getAttribute('data-theme') !== 'dark');
            window.dispatchEvent(new CustomEvent('nexus:tema'));
        });
    }
    aplicar(escuro) {
        if (escuro)
            document.body.setAttribute('data-theme', 'dark');
        else
            document.body.removeAttribute('data-theme');
        localStorage.setItem(this.CHAVE, escuro ? 'dark' : 'light');
        const icone = elemento('theme-icon');
        if (icone)
            icone.className = escuro ? 'fas fa-sun' : 'fas fa-moon';
    }
}
class UIManager {
    constructor() {
        document.querySelectorAll('.nav-link[data-target]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const alvo = e.currentTarget.getAttribute('data-target');
                if (alvo)
                    this.abrirAba(alvo);
            });
        });
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
    }
    abrirAba(id) {
        document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));
        elemento(id)?.classList.add('active');
        document.querySelectorAll(`.nav-link[data-target="${id}"]`).forEach(el => el.classList.add('active'));
        const barra = elemento('barra-filtros');
        if (barra)
            barra.style.display = id === 'dashboard' ? 'flex' : 'none';
        const titulos = TITULOS[id];
        if (titulos) {
            const titulo = elemento('topbar-titulo');
            const subtitulo = elemento('topbar-subtitulo');
            if (titulo)
                titulo.textContent = titulos[0];
            if (subtitulo)
                subtitulo.textContent = titulos[1];
        }
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }
}
// ============================================================
// 6. DASHBOARD
// ============================================================
class DashboardManager {
    api;
    graficos = [];
    metasSetor = {};
    esteiras = [];
    ultimosDados = [];
    requisicaoAtual = 0;
    constructor(api) {
        this.api = api;
        ['filtro-ano', 'filtro-mes', 'filtro-esteira'].forEach(id => elemento(id)?.addEventListener('change', () => { void this.atualizarDashboard(); }));
        elemento('filtro-visao')?.addEventListener('change', () => this.renderizar());
        elemento('btn-limpar-filtros')?.addEventListener('click', () => this.limparFiltros());
        window.addEventListener('nexus:tema', () => this.renderizar());
    }
    // ---------- dados de apoio ----------
    definirSetores(setores) {
        this.metasSetor = {};
        setores.forEach(s => { this.metasSetor[s.nome] = Number(s.meta_percentual); });
    }
    definirEsteiras(esteiras) {
        this.esteiras = esteiras;
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
    async carregarAnos() {
        const anos = await this.api.getAnos();
        const select = elementoObrigatorio('filtro-ano');
        const atual = new Date().getFullYear();
        const lista = anos.length > 0 ? anos : [atual];
        select.innerHTML = '';
        lista.forEach(a => select.appendChild(criarOption(String(a), String(a))));
        select.value = String(lista.includes(atual) ? atual : Math.max(...lista));
    }
    limparFiltros() {
        elementoObrigatorio('filtro-mes').value = 'todos';
        elementoObrigatorio('filtro-visao').value = 'geral';
        elementoObrigatorio('filtro-esteira').value = 'todas';
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
            const dados = await this.api.getDashboard(filtros.ano, filtros.periodo.inicio, filtros.periodo.fim, filtros.esteira);
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
        return getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#1e293b';
    }
    // ---------- cálculos ----------
    metaDe(linhas) {
        const total = linhas.reduce((s, l) => s + l.horas_ronda, 0);
        if (total === 0)
            return META_PADRAO;
        return linhas.reduce((s, l) => s + (this.metasSetor[l.setor] ?? META_PADRAO) * l.horas_ronda, 0) / total;
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
        const kpi = (classe, icone, titulo, valor, detalhe) => `
            <div class="kpi-card ${classe}">
                <div class="kpi-icone"><i class="${icone}"></i></div>
                <div><div class="kpi-title">${titulo}</div><div class="kpi-valor">${valor}</div><div class="kpi-detalhe">${detalhe}</div></div>
            </div>`;
        container.innerHTML =
            kpi(delta >= 0 ? 'kpi-ok' : 'kpi-falha', 'fas fa-bullseye', 'Produtividade Geral', formatarPercentual(prod), `Meta ${formatarPercentual(meta)} · ${delta >= 0 ? '+' : ''}${formatarNumero(delta)} p.p.`) +
                kpi('kpi-neutro', 'fas fa-clock', 'Horas Operadas', `${formatarNumero(t.horas_ronda, 0)} h`, `${esteirasAtivas} esteiras ativas`) +
                kpi('kpi-improdutivas', 'fas fa-hourglass-half', 'Improdutivas', formatarPercentual(percentual(t.horas_improdutivas, t.horas_ronda)), `${formatarNumero(t.horas_improdutivas, 0)} h`) +
                kpi('kpi-reparo', 'fas fa-screwdriver-wrench', 'Reparo', formatarPercentual(percentual(t.horas_reparo, t.horas_ronda)), `${formatarNumero(t.horas_reparo, 0)} h`) +
                kpi('kpi-flutuantes', 'fas fa-wave-square', 'Flutuantes', formatarPercentual(percentual(t.horas_flutuantes, t.horas_ronda)), `${formatarNumero(t.horas_flutuantes, 0)} h`);
    }
    // ---------- visões ----------
    renderizarVisaoGeral(dados, filtros, grid) {
        if (filtros.periodo.inicio !== filtros.periodo.fim) {
            const porMes = this.agrupar(dados, 'mes').sort((a, b) => a.mes - b.mes);
            const metas = porMes.map(m => this.metaDe(dados.filter(d => d.mes === m.mes)));
            this.graficoCombinado(grid, `Evolução Mensal — ${filtros.periodo.rotulo} de ${filtros.ano}`, 'Visão consolidada de todos os setores', porMes, metas, true);
        }
        this.graficoSetores(grid, this.agrupar(dados, 'setor'));
        const titulo = document.createElement('h3');
        titulo.className = 'section-title span-total';
        titulo.textContent = 'Desempenho por Setor';
        grid.appendChild(titulo);
        Object.keys(this.metasSetor).forEach(nomeSetor => {
            const dSetor = dados.filter(d => d.setor === nomeSetor);
            if (dSetor.length === 0)
                return;
            const porEsteira = this.agrupar(dSetor, 'esteira');
            const piores = filtros.visao === 'piores';
            porEsteira.sort((a, b) => piores ? a.prodPura - b.prodPura : b.horas_ronda - a.horas_ronda);
            const meta = this.metasSetor[nomeSetor] ?? META_PADRAO;
            const media = produtividade(totalizar(dSetor));
            const destaque = `<div class="kpi-inline"><span class="kpi-title">Média do setor</span><span class="kpi-valor ${media >= meta ? 'good' : 'danger'}">${formatarPercentual(media)}</span></div>`;
            const subtitulo = `Meta ${meta}% · ${piores ? `${TOP_ESTEIRAS} piores` : `${TOP_ESTEIRAS} maiores volumes`} de ${porEsteira.length} esteiras`;
            const slice = porEsteira.slice(0, TOP_ESTEIRAS);
            this.graficoCombinado(grid, nomeSetor, subtitulo, slice, slice.map(() => meta), false, destaque);
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
        this.graficos.push(new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.map(d => d.rotulo),
                datasets: [
                    { type: 'line', label: 'Produtividade (%)', data: dados.map(d => d.prodPura), borderColor: this.corTexto(), backgroundColor: this.corTexto(), yAxisID: 'y1', tension: 0.3, borderWidth: 3, order: 1 },
                    { type: 'line', label: 'Meta (%)', data: metas, borderColor: CORES.meta, borderDash: [5, 5], pointRadius: 0, yAxisID: 'y1', borderWidth: 2, order: 0 },
                    { type: 'bar', label: 'Produtivas', data: dados.map(d => d.horas_produtivas), backgroundColor: CORES.produtivas, yAxisID: 'y', order: 2 },
                    { type: 'bar', label: 'Improdutivas', data: dados.map(d => d.horas_improdutivas), backgroundColor: CORES.improdutivas, yAxisID: 'y', order: 2 },
                    { type: 'bar', label: 'Reparo', data: dados.map(d => d.horas_reparo), backgroundColor: CORES.reparo, yAxisID: 'y', order: 2 },
                    { type: 'bar', label: 'Flutuantes', data: dados.map(d => d.horas_flutuantes), backgroundColor: CORES.flutuantes, yAxisID: 'y', order: 2 }
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
        const linhas = porSetor.map(s => ({ nome: s.setor, prod: s.prodPura, meta: this.metasSetor[s.setor] ?? META_PADRAO }));
        this.graficos.push(new Chart(ctx, {
            type: 'bar',
            data: {
                labels: linhas.map(l => l.nome),
                datasets: [
                    { label: 'Produtividade (%)', data: linhas.map(l => l.prod), backgroundColor: linhas.map(l => l.prod >= l.meta ? CORES.produtivas : CORES.reparo), borderRadius: 6 },
                    { label: 'Meta (%)', data: linhas.map(l => l.meta), backgroundColor: 'rgba(37, 99, 235, 0.35)', borderRadius: 6 }
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
        return [
            { titulo: 'Horas improdutivas', acao: 'Reforçar o treinamento operacional e auditar o setup das máquinas.', horas: t.horas_improdutivas },
            { titulo: 'Horas de reparo', acao: 'Revisar o cronograma de manutenção preventiva com a equipe técnica.', horas: t.horas_reparo },
            { titulo: 'Horas flutuantes', acao: 'Acionar logística/PCP e alinhar o suprimento de material.', horas: t.horas_flutuantes }
        ].map(c => ({ ...c, pct: percentual(c.horas, t.horas_ronda) })).sort((a, b) => b.horas - a.horas);
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
            .map(c => `<li><b>${c.titulo} (${formatarPercentual(c.pct)} das horas operadas):</b> ${c.acao}</li>`).join('');
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
            const meta = this.metasSetor[nome] ?? META_PADRAO;
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
        const linhas = piores.map(e => `<tr><td>${escapeHtml(e.nome_esteira)}</td><td>${escapeHtml(e.setor)}</td><td class="text-danger">${formatarPercentual(e.prodPura)}</td><td>${this.metasSetor[e.setor] ?? META_PADRAO}%</td></tr>`).join('');
        return `<div class="insight-card negative"><div class="insight-title">⚠️ 5 Esteiras Mais Críticas</div>
            <div class="table-responsive"><table class="data-table"><thead><tr><th>Esteira</th><th>Setor</th><th>Produtividade</th><th>Meta do setor</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
    }
}
class TabelaGerenciavel {
    opcoes;
    itens = [];
    pagina = 1;
    constructor(opcoes) {
        this.opcoes = opcoes;
        elemento(opcoes.buscaId)?.addEventListener('input', debounce(() => this.reiniciar(), 200));
    }
    definirItens(itens) {
        this.itens = itens;
        this.renderizar();
    }
    reiniciar() {
        this.pagina = 1;
        this.renderizar();
    }
    filtrar() {
        const termo = (elemento(this.opcoes.buscaId)?.value ?? '').trim().toLowerCase();
        const extra = this.opcoes.filtroExtra;
        return this.itens.filter(i => (termo === '' || this.opcoes.textoBusca(i).toLowerCase().includes(termo)) && (!extra || extra(i)));
    }
    renderizar() {
        const corpo = elemento(this.opcoes.corpoId);
        if (!corpo)
            return;
        const filtrados = this.filtrar();
        const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
        this.pagina = Math.min(this.pagina, totalPaginas);
        const inicio = (this.pagina - 1) * ITENS_POR_PAGINA;
        corpo.innerHTML = '';
        const visiveis = filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);
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
        const botao = (texto, destino, desabilitado) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn btn-outline btn-sm';
            b.innerHTML = texto;
            b.disabled = desabilitado;
            b.addEventListener('click', () => { this.pagina = destino; this.renderizar(); });
            return b;
        };
        const info = document.createElement('span');
        info.textContent = `Página ${this.pagina} de ${totalPaginas}`;
        container.appendChild(botao('<i class="fas fa-chevron-left"></i>', this.pagina - 1, this.pagina <= 1));
        container.appendChild(info);
        container.appendChild(botao('<i class="fas fa-chevron-right"></i>', this.pagina + 1, this.pagina >= totalPaginas));
    }
}
// ============================================================
// 8. CADASTROS (funcionários, esteiras, apontamentos)
// ============================================================
class CadastroManager {
    api;
    dashboard;
    tabelaFuncionarios;
    tabelaEsteiras;
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
    }
    async recarregarFuncionarios() {
        this.funcionarios = await this.api.getFuncionarios();
        this.atualizarSelects();
        this.tabelaFuncionarios.definirItens(this.funcionarios);
    }
    async recarregarEsteiras() {
        this.esteiras = await this.api.getEsteiras();
        this.dashboard.definirEsteiras(this.esteiras);
        this.atualizarSelects();
        this.tabelaEsteiras.definirItens(this.esteiras);
    }
    atualizarSelects() {
        const selFuncionario = elemento('ap-operador');
        if (selFuncionario) {
            selFuncionario.innerHTML = '';
            selFuncionario.appendChild(criarOption('', 'Selecione um funcionário...'));
            const grupos = new Map();
            this.funcionarios.forEach(f => {
                let grupo = grupos.get(f.setor);
                if (!grupo) {
                    grupo = document.createElement('optgroup');
                    grupo.label = f.setor;
                    grupos.set(f.setor, grupo);
                    selFuncionario.appendChild(grupo);
                }
                grupo.appendChild(criarOption(String(f.id_funcionario), `${f.nome} (Matrícula: ${f.codigo_matricula})`));
            });
        }
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
    // ---------- exclusão ----------
    async confirmarExclusao(descricao, executar, avisoVinculos) {
        const primeira = await Swal.fire({
            title: 'Confirmar exclusão',
            html: `Deseja realmente excluir <b>${escapeHtml(descricao)}</b>?`,
            icon: 'warning', showCancelButton: true, reverseButtons: true,
            confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444'
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
                    confirmButtonText: 'Excluir tudo', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444'
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
        elemento('form-esteira')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            try {
                await this.api.criarEsteira(elementoObrigatorio('cad-codigo').value.trim().toUpperCase(), elementoObrigatorio('cad-descricao').value.trim());
                await this.recarregarEsteiras();
                notificar('Esteira cadastrada.');
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
                await this.api.criarFuncionario(elementoObrigatorio('cad-op-cracha').value.trim(), elementoObrigatorio('cad-op-setor').value, nome, elementoObrigatorio('cad-op-cargo').value.trim());
                await this.recarregarFuncionarios();
                notificar(`Funcionário ${nome} cadastrado.`);
                form.reset();
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
        elemento('form-perfil')?.addEventListener('submit', (e) => {
            e.preventDefault();
            notificar('Perfil atualizado.');
        });
    }
}
// ============================================================
// 9. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const data = elemento('ap-data');
    if (data)
        data.value = hojeISO();
    new ThemeManager();
    new UIManager();
    const api = new ApiService();
    const dashboard = new DashboardManager(api);
    const cadastros = new CadastroManager(api, dashboard);
    try {
        await Promise.all([cadastros.carregarDadosIniciais(), dashboard.carregarAnos()]);
        await dashboard.atualizarDashboard();
    }
    catch (e) {
        mostrarErro(e);
    }
});
