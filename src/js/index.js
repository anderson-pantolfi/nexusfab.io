"use strict";
<<<<<<< HEAD
// --- 1. CONFIGURAÇÕES ---
const API_URL = 'http://localhost/nexusfab/src/php/api.php';
const ANO_REFERENCIA = 2026;
const META_ESTEIRA = 80;
const cores = {
    produtivas: '#10b981',
    improdutivas: '#f59e0b',
    reparo: '#ef4444',
    flutuantes: '#8b5cf6'
};
const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
// --- 3. UTILITÁRIOS ---
function escapeHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function mostrarErro(e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado.';
    Swal.fire('Erro', msg, 'error');
}
function lerNumero(id) {
    return parseFloat(document.getElementById(id).value);
}
// --- 4. API SERVICE  ---
class ApiService {
    async request(recurso, opcoes = {}, query = '') {
        let resposta;
        try {
            resposta = await fetch(`${API_URL}?recurso=${recurso}${query}`, {
                headers: { 'Content-Type': 'application/json' },
                ...opcoes
            });
        }
        catch {
            throw new Error('Não foi possível conectar ao servidor.');
        }
        let corpo = null;
        try {
            corpo = await resposta.json();
        }
        catch { /* resposta sem JSON */ }
        if (!resposta.ok) {
            throw new Error(corpo?.erro ?? `Falha na requisição (${resposta.status}).`);
        }
        return corpo;
    }
    getSetores() {
        return this.request('setores');
    }
    getFuncionarios() {
        return this.request('funcionarios');
    }
    criarFuncionario(codigo_matricula, setor, nome, cargo) {
        return this.request('funcionarios', {
            method: 'POST',
            body: JSON.stringify({ codigo_matricula, setor, nome, cargo })
        });
    }
    getEsteiras() {
        return this.request('esteiras');
    }
    criarEsteira(codigo_patrimonio, nome_descricao) {
        return this.request('esteiras', {
            method: 'POST',
            body: JSON.stringify({ codigo_patrimonio, nome_descricao })
        });
    }
    criarApontamento(dados) {
        return this.request('apontamentos', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
    }
    getDashboard(ano, mes, esteira) {
        const params = `&ano=${ano}&mes=${encodeURIComponent(mes)}&id_esteira=${encodeURIComponent(esteira)}`;
        return this.request('dashboard', {}, params);
    }
}
// --- 5. THEME MANAGER ---
=======
// --- 1. CONFIGURAÇÕES E INTERFACES ---
const PPH = 50;
const META_ESTEIRA = 80;
const metasSetor = { "Usinagem CNC": 65, "Montagem Eletrônica": 70, "Sistemas Hidráulicos": 60, "Usinagem de Precisão": 80, "Inspeção de Qualidade": 75 };
const cores = { boas: '#10b981', ineficiencia: '#f59e0b', indiretas: '#8b5cf6', vazias: '#ef4444' };
const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
// --- 2. THEME MANAGER (Gestão do Modo Escuro / Claro) ---
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
class ThemeManager {
    THEME_KEY = 'nexus_theme';
    btnTheme;
    themeIcon;
    constructor() {
        this.btnTheme = document.getElementById('btn-theme');
        this.themeIcon = document.getElementById('theme-icon');
        this.init();
    }
    init() {
        const savedTheme = localStorage.getItem(this.THEME_KEY);
<<<<<<< HEAD
        if (savedTheme === 'dark')
            this.setDarkTheme();
=======
        if (savedTheme === 'dark') {
            this.setDarkTheme();
        }
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
        this.btnTheme?.addEventListener('click', () => this.toggleTheme());
    }
    toggleTheme() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
<<<<<<< HEAD
        isDark ? this.setLightTheme() : this.setDarkTheme();
=======
        if (isDark) {
            this.setLightTheme();
        }
        else {
            this.setDarkTheme();
        }
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
    }
    setDarkTheme() {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem(this.THEME_KEY, 'dark');
<<<<<<< HEAD
        if (this.themeIcon)
            this.themeIcon.className = 'fas fa-sun';
=======
        if (this.themeIcon) {
            this.themeIcon.className = 'fas fa-sun';
        }
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
    }
    setLightTheme() {
        document.body.removeAttribute('data-theme');
        localStorage.setItem(this.THEME_KEY, 'light');
<<<<<<< HEAD
        if (this.themeIcon)
            this.themeIcon.className = 'fas fa-moon';
    }
}
// --- 6. UI MANAGER ---
=======
        if (this.themeIcon) {
            this.themeIcon.className = 'fas fa-moon';
        }
    }
}
// --- 3. UI MANAGER (Gestão de Navegação, Abas e Dropdowns do Cabeçalho) ---
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
class UIManager {
    constructor() {
        this.initNavigation();
        this.initDropdowns();
    }
    initNavigation() {
        const navLinks = document.querySelectorAll('.nav-link[data-target]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = e.currentTarget.getAttribute('data-target');
                if (!targetId)
                    return;
<<<<<<< HEAD
                document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));
                document.getElementById(targetId)?.classList.add('active');
                document.querySelectorAll(`.nav-link[data-target="${targetId}"]`).forEach(el => el.classList.add('active'));
                const barraFiltros = document.getElementById('barra-filtros');
                if (barraFiltros) {
                    barraFiltros.style.display = targetId === 'dashboard' ? 'flex' : 'none';
                }
=======
                // Remove a classe active de todas as abas e links de navegação
                document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));
                // Ativa a aba e os links correspondentes
                document.getElementById(targetId)?.classList.add('active');
                document.querySelectorAll(`.nav-link[data-target="${targetId}"]`).forEach(el => el.classList.add('active'));
                // Oculta filtros e abas principais se estivermos em páginas internas (Perfil, Configurações, Utilizadores)
                const barraFiltros = document.getElementById('barra-filtros');
                const mainTabs = document.getElementById('main-tabs');
                if (barraFiltros) {
                    barraFiltros.style.display = targetId === 'dashboard' ? 'flex' : 'none';
                }
                const hideMainTabs = ['perfil', 'configuracoes', 'usuarios'].includes(targetId);
                if (mainTabs) {
                    mainTabs.style.display = hideMainTabs ? 'none' : 'flex';
                }
                // Fecha menus dropdown abertos
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
            });
        });
    }
    initDropdowns() {
        const toggleMenu = (menuId, event) => {
            event.stopPropagation();
            const menu = document.getElementById(menuId);
            document.querySelectorAll('.dropdown-content').forEach(el => {
                if (el !== menu)
                    el.classList.remove('show');
            });
            menu?.classList.toggle('show');
        };
        document.getElementById('btn-profile')?.addEventListener('click', (e) => toggleMenu('profile-menu', e));
        document.getElementById('btn-notif')?.addEventListener('click', (e) => toggleMenu('notif-menu', e));
<<<<<<< HEAD
=======
        // Fecha os menus ao clicar fora deles
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
        });
    }
}
<<<<<<< HEAD
// --- 7. DASHBOARD MANAGER ---
class DashboardManager {
    graficosAtivos = [];
    api;
    metasSetor = {};
    esteiras = [];
    requisicaoAtual = 0; // evita que respostas antigas sobrescrevam as novas
    constructor(api) {
        this.api = api;
=======
// --- 4. DATABASE SERVICE ---
class DatabaseService {
    maquinas = [];
    operadores = [];
    apontamentos = [];
    constructor() {
        this.gerarMockData();
    }
    gerarMockData() {
        this.operadores.push({ cracha: '1001', nome: 'João Silva' }, { cracha: '1002', nome: 'Maria Santos' }, { cracha: '1003', nome: 'Carlos Sousa' });
        const setoresConfig = [
            { nome: "Usinagem CNC", inicio: 1, fim: 5 },
            { nome: "Montagem Eletrônica", inicio: 21, fim: 25 }
        ];
        for (let mes = 1; mes <= 6; mes++) {
            setoresConfig.forEach(setor => {
                for (let i = setor.inicio; i <= setor.fim; i++) {
                    let idFormatado = i.toString().padStart(3, '0') + 'A';
                    if (mes === 1) {
                        this.maquinas.push({ id: idFormatado, setor: setor.nome, nome: `Est. ${idFormatado}` });
                    }
                    let hRonda = Math.floor(Math.random() * 60) + 160;
                    let hVazias = Math.floor(hRonda * (Math.random() * 0.15));
                    let hIndiretas = Math.floor(hRonda * (Math.random() * 0.10));
                    let hApontadas = hRonda - hVazias - hIndiretas;
                    let hBoas = Math.floor(hApontadas * (Math.random() * 0.35 + 0.60));
                    let hIneficiencia = hApontadas - hBoas;
                    let opAleatorio = this.operadores[Math.floor(Math.random() * this.operadores.length)];
                    let crachaDefinitivo = opAleatorio?.cracha || "SISTEMA";
                    this.apontamentos.push({
                        cracha: crachaDefinitivo,
                        dataCompleta: `2026-${mes.toString().padStart(2, '0')}-01`,
                        id: idFormatado, nome: `Est. ${idFormatado}`, setor: setor.nome, mes: mes,
                        hRonda, hApontadas, hBoas, hIneficiencia, hVazias, hIndiretas
                    });
                }
            });
        }
    }
    addMaquina(id, setor) {
        this.maquinas.push({ id, setor, nome: `Est. ${id}` });
    }
    addOperador(cracha, nome) {
        this.operadores.push({ cracha, nome });
    }
}
// --- 5. DASHBOARD MANAGER ---
class DashboardManager {
    graficosAtivos = [];
    db;
    constructor(db) {
        this.db = db;
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
        this.bindFiltros();
    }
    bindFiltros() {
        ['filtro-mes', 'filtro-visao', 'filtro-esteira'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.atualizarDashboard());
        });
    }
<<<<<<< HEAD
    definirSetores(setores) {
        this.metasSetor = {};
        setores.forEach(s => { this.metasSetor[s.nome] = Number(s.meta_percentual); });
    }
    definirEsteiras(esteiras) {
        this.esteiras = esteiras;
        this.preencherSelectFiltros();
    }
=======
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
    preencherSelectFiltros() {
        const selectFiltro = document.getElementById('filtro-esteira');
        if (!selectFiltro)
            return;
<<<<<<< HEAD
        const valorAtual = selectFiltro.value;
        selectFiltro.innerHTML = '<option value="todas">Visão Global (Todas)</option>';
        this.esteiras.forEach(maq => {
            const opt = document.createElement('option');
            opt.value = String(maq.id_esteira);
            opt.textContent = `${maq.nome_descricao} (${maq.codigo_patrimonio})`;
            selectFiltro.appendChild(opt);
        });
        if (Array.from(selectFiltro.options).some(o => o.value === valorAtual)) {
            selectFiltro.value = valorAtual;
        }
    }
    agregar(dados, porMes) {
        const agregados = {};
        dados.forEach(d => {
            const chave = porMes ? `m${d.mes}` : `e${d.id_esteira}`;
            if (!agregados[chave]) {
                agregados[chave] = {
                    mes: d.mes,
                    id_esteira: d.id_esteira,
                    nome_esteira: d.nome_esteira,
                    setor: d.setor,
                    labelExibicao: porMes ? (nomesMeses[d.mes] ?? `Mês ${d.mes}`) : d.nome_esteira,
                    horas_ronda: 0, horas_produtivas: 0, horas_improdutivas: 0,
                    horas_reparo: 0, horas_flutuantes: 0
                };
            }
            const a = agregados[chave];
            a.horas_ronda += d.horas_ronda;
            a.horas_produtivas += d.horas_produtivas;
            a.horas_improdutivas += d.horas_improdutivas;
            a.horas_reparo += d.horas_reparo;
            a.horas_flutuantes += d.horas_flutuantes;
        });
        const lista = Object.values(agregados).map(d => ({
            ...d,
            prodPura: d.horas_ronda > 0 ? (d.horas_produtivas / d.horas_ronda) * 100 : 0
        }));
        return porMes ? lista.sort((a, b) => a.mes - b.mes) : lista;
    }
    async atualizarDashboard() {
        const dashboard = document.getElementById('dashboard-grid');
        if (!dashboard)
            return;
        const mes = document.getElementById('filtro-mes').value;
        const visao = document.getElementById('filtro-visao').value;
        const esteira = document.getElementById('filtro-esteira').value;
        const selVisao = document.getElementById('filtro-visao');
        const idRequisicao = ++this.requisicaoAtual;
        let brutos;
        try {
            brutos = await this.api.getDashboard(ANO_REFERENCIA, mes, esteira);
        }
        catch (e) {
            mostrarErro(e);
            return;
        }
        if (idRequisicao !== this.requisicaoAtual)
            return; // chegou uma requisição mais nova
        this.graficosAtivos.forEach(g => g.destroy());
        this.graficosAtivos = [];
        dashboard.innerHTML = '';
        const individual = esteira !== 'todas';
        const dados = this.agregar(brutos, individual && mes === 'todos');
        selVisao.disabled = individual;
        if (individual) {
            if (dados.length > 0 && dados[0]) {
                const tot = dados.reduce((a, c) => { a.r += c.horas_ronda; a.b += c.horas_produtivas; return a; }, { r: 0, b: 0 });
                this.renderizarCard(`Análise Temporal: ${dados[0].nome_esteira}`, dados, tot.r > 0 ? (tot.b / tot.r) * 100 : 0, META_ESTEIRA, dashboard);
            }
        }
        else {
            Object.keys(this.metasSetor).forEach(nomeSetor => {
                const dSetor = dados.filter(d => d.setor === nomeSetor);
                if (dSetor.length === 0)
                    return;
                visao === 'piores'
                    ? dSetor.sort((a, b) => (a.prodPura || 0) - (b.prodPura || 0))
                    : dSetor.sort((a, b) => b.horas_ronda - a.horas_ronda);
                const top10 = dSetor.slice(0, 10);
                const tot = top10.reduce((a, c) => { a.r += c.horas_ronda; a.b += c.horas_produtivas; return a; }, { r: 0, b: 0 });
                const metaAtual = this.metasSetor[nomeSetor] || 0;
                this.renderizarCard(`${nomeSetor} (Meta: ${metaAtual}%)`, top10, tot.r > 0 ? (tot.b / tot.r) * 100 : 0, metaAtual, dashboard);
            });
        }
        this.gerarRelatorio(dados, individual);
=======
        selectFiltro.innerHTML = '<option value="todas">Visão Global (Todas)</option>';
        this.db.maquinas.forEach(maq => {
            selectFiltro.innerHTML += `<option value="${maq.id}">${maq.nome} (${maq.setor})</option>`;
        });
    }
    filtrarEAgregarDados() {
        const mes = document.getElementById('filtro-mes').value;
        const esteira = document.getElementById('filtro-esteira').value;
        let filtrados = this.db.apontamentos.filter(d => (mes === 'todos' || d.mes.toString() === mes) &&
            (esteira === 'todas' || d.id === esteira));
        let agregados = {};
        if (esteira !== 'todas' && mes === 'todos') {
            filtrados.forEach(d => {
                if (!agregados[d.mes])
                    agregados[d.mes] = { labelExibicao: nomesMeses[d.mes], mes: d.mes, hRonda: 0, hApontadas: 0, hBoas: 0, hIneficiencia: 0, hVazias: 0, hIndiretas: 0, nome: d.nome, setor: d.setor };
                agregados[d.mes].hRonda += d.hRonda;
                agregados[d.mes].hBoas += d.hBoas;
                agregados[d.mes].hIneficiencia += d.hIneficiencia;
                agregados[d.mes].hVazias += d.hVazias;
                agregados[d.mes].hIndiretas += d.hIndiretas;
            });
            return Object.values(agregados).map((d) => ({ ...d, prodPura: (d.hRonda > 0) ? (d.hBoas / d.hRonda) * 100 : 0 })).sort((a, b) => a.mes - b.mes);
        }
        filtrados.forEach(d => {
            if (!agregados[d.id])
                agregados[d.id] = { id: d.id, nome: d.nome, setor: d.setor, labelExibicao: d.nome, hRonda: 0, hApontadas: 0, hBoas: 0, hIneficiencia: 0, hVazias: 0, hIndiretas: 0 };
            agregados[d.id].hRonda += d.hRonda;
            agregados[d.id].hBoas += d.hBoas;
            agregados[d.id].hIneficiencia += d.hIneficiencia;
            agregados[d.id].hVazias += d.hVazias;
            agregados[d.id].hIndiretas += d.hIndiretas;
        });
        return Object.values(agregados).map((d) => ({ ...d, prodPura: (d.hRonda > 0) ? (d.hBoas / d.hRonda) * 100 : 0 }));
    }
    atualizarDashboard() {
        const dashboard = document.getElementById('dashboard-grid');
        const visao = document.getElementById('filtro-visao').value;
        const esteira = document.getElementById('filtro-esteira').value;
        if (!dashboard)
            return;
        this.graficosAtivos.forEach(g => g.destroy());
        this.graficosAtivos = [];
        dashboard.innerHTML = '';
        const dados = this.filtrarEAgregarDados();
        if (esteira !== 'todas') {
            document.getElementById('filtro-visao').disabled = true;
            if (dados.length === 0)
                return;
            let tot = dados.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; return a; }, { r: 0, b: 0 });
            this.renderizarCard(`Análise Temporal: ${dados[0].nome}`, dados, (tot.r > 0 ? (tot.b / tot.r) * 100 : 0), META_ESTEIRA, dashboard);
        }
        else {
            document.getElementById('filtro-visao').disabled = false;
            Object.keys(metasSetor).forEach(nomeSetor => {
                let dSetor = dados.filter(d => d.setor === nomeSetor);
                if (dSetor.length === 0)
                    return;
                visao === 'piores' ? dSetor.sort((a, b) => a.prodPura - b.prodPura) : dSetor.sort((a, b) => b.hRonda - a.hRonda);
                let top10 = dSetor.slice(0, 10);
                let tot = top10.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; return a; }, { r: 0, b: 0 });
                const metaAtual = metasSetor[nomeSetor] || 0;
                this.renderizarCard(`${nomeSetor} (Meta: ${metaAtual}%)`, top10, (tot.r > 0 ? (tot.b / tot.r) * 100 : 0), metaAtual, dashboard);
            });
        }
        this.gerarRelatorio(dados, esteira !== 'todas');
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
    }
    renderizarCard(titulo, dados, prodPuraMedia, meta, container) {
        const idx = this.graficosAtivos.length;
        const card = document.createElement('div');
<<<<<<< HEAD
        card.className = 'card chart-card';
        card.innerHTML = `
            <div class="chart-header"><h4>${escapeHtml(titulo)}</h4></div>
=======
        card.className = `card chart-card`;
        card.innerHTML = `
            <div class="chart-header"><h4>${titulo}</h4></div>
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
            <div class="kpi-container">
                <div class="kpi-box"><div class="kpi-title">Média Atingida</div><div class="kpi-value ${prodPuraMedia >= meta ? 'good' : 'danger'}">${(prodPuraMedia || 0).toFixed(1)}%</div></div>
            </div>
            <div class="canvas-container"><canvas id="chart-dyn-${idx}"></canvas></div>`;
        container.appendChild(card);
        const canvasEl = document.getElementById(`chart-dyn-${idx}`);
<<<<<<< HEAD
        const ctx = canvasEl.getContext('2d');
        if (!ctx)
            return;
=======
        if (!canvasEl)
            return;
        const ctx = canvasEl.getContext('2d');
        if (!ctx)
            return;
        // @ts-ignore
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
        const g = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.map(d => d.labelExibicao),
                datasets: [
                    { type: 'line', label: 'Tendência Prod. Pura (%)', data: dados.map(d => d.prodPura), borderColor: '#1e293b', backgroundColor: '#1e293b', yAxisID: 'y1', tension: 0.3, borderWidth: 3, fill: false, order: 1 },
                    { type: 'line', label: 'Meta (%)', data: dados.map(() => meta), borderColor: '#2563eb', borderDash: [5, 5], pointRadius: 0, yAxisID: 'y1', borderWidth: 2, fill: false, order: 0 },
<<<<<<< HEAD
                    { type: 'bar', label: 'Horas Produtivas', data: dados.map(d => d.horas_produtivas), backgroundColor: cores.produtivas, yAxisID: 'y', order: 2, stacked: true },
                    { type: 'bar', label: 'Horas Improdutivas', data: dados.map(d => d.horas_improdutivas), backgroundColor: cores.improdutivas, yAxisID: 'y', order: 2, stacked: true },
                    { type: 'bar', label: 'Horas Reparo', data: dados.map(d => d.horas_reparo), backgroundColor: cores.reparo, yAxisID: 'y', order: 2, stacked: true },
                    { type: 'bar', label: 'Horas Flutuantes', data: dados.map(d => d.horas_flutuantes), backgroundColor: cores.flutuantes, yAxisID: 'y', order: 2, stacked: true }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, position: 'left' },
                    y1: { position: 'right', min: 0, max: 100 }
                }
=======
                    { type: 'bar', label: 'Horas Boas', data: dados.map(d => d.hBoas), backgroundColor: cores.boas, yAxisID: 'y', order: 2, stacked: true },
                    { type: 'bar', label: 'Ineficiência', data: dados.map(d => d.hIneficiencia), backgroundColor: cores.ineficiencia, yAxisID: 'y', order: 2, stacked: true },
                    { type: 'bar', label: 'Horas Indiretas', data: dados.map(d => d.hIndiretas), backgroundColor: cores.indiretas, yAxisID: 'y', order: 2, stacked: true },
                    { type: 'bar', label: 'Horas Vazias', data: dados.map(d => d.hVazias), backgroundColor: cores.vazias, yAxisID: 'y', order: 2, stacked: true }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index', intersect: false,
                        callbacks: {
                            footer: (tooltipItems) => {
                                let d = dados[tooltipItems[0].dataIndex];
                                let varRelativa = d.hRonda > 0 ? ((d.prodPura / meta) - 1) * 100 : 0;
                                let pecasBoas = d.hBoas * PPH;
                                let pecasMeta = (d.hRonda * (meta / 100)) * PPH;
                                let delta = Math.round(pecasBoas - pecasMeta);
                                return `\n-- IMPACTO VERSUS META --\nVariação: ${varRelativa > 0 ? '+' : ''}${varRelativa.toFixed(1)}%\nVolume: ${Math.round(pecasBoas)} peças\nDesvio: ${delta > 0 ? '+' : ''}${delta} peças`;
                            }
                        }
                    }
                },
                scales: { x: { stacked: true }, y: { stacked: true, position: 'left' }, y1: { position: 'right', min: 0, max: 100 } }
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
            }
        });
        this.graficosAtivos.push(g);
    }
    gerarRelatorio(dadosTotais, isIndividual) {
        const reportBody = document.getElementById('report-body');
        if (!reportBody)
            return;
        reportBody.innerHTML = '';
        if (dadosTotais.length === 0) {
            reportBody.innerHTML = '<p class="text-muted">Nenhum dado encontrado para os filtros selecionados.</p>';
            return;
        }
<<<<<<< HEAD
        const tot = dadosTotais.reduce((a, c) => { a.r += c.horas_ronda; a.b += c.horas_produtivas; return a; }, { r: 0, b: 0 });
        const mediaPura = tot.r > 0 ? (tot.b / tot.r) * 100 : 0;
        if (isIndividual) {
            reportBody.innerHTML = `
                <div class="insight-card ${mediaPura >= META_ESTEIRA ? 'positive' : 'negative'}">
                    <div class="insight-title">Análise de Desempenho: ${escapeHtml(dadosTotais[0]?.nome_esteira)}</div>
                    Produtividade pura média: <b>${mediaPura.toFixed(1)}%</b>.
                    ${mediaPura < META_ESTEIRA ? `<br><b>Alerta:</b> Abaixo da meta de ${META_ESTEIRA}%. Requer atenção.` : '<br><b>Excelente:</b> Dentro ou acima da meta.'}
=======
        let tot = dadosTotais.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; return a; }, { r: 0, b: 0 });
        let mediaPura = tot.r > 0 ? (tot.b / tot.r) * 100 : 0;
        if (isIndividual) {
            reportBody.innerHTML = `
                <div class="insight-card ${mediaPura >= META_ESTEIRA ? 'positive' : 'negative'}">
                    <div class="insight-title">Análise de Desempenho: ${dadosTotais[0].nome}</div>
                    Produtividade pura média: <b>${mediaPura.toFixed(1)}%</b>. 
                    ${mediaPura < META_ESTEIRA ? '<br><b>Alerta:</b> Abaixo da meta de 80%. Requer atenção.' : '<br><b>Excelente:</b> Dentro ou acima da meta.'}
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
                </div>`;
            return;
        }
        let htmlSetores = `<div class="insight-card neutral"><div class="insight-title">📊 Análise de Metas por Setor</div><ul class="action-list">`;
<<<<<<< HEAD
        Object.keys(this.metasSetor).forEach(nomeSetor => {
            const dSetor = dadosTotais.filter(d => d.setor === nomeSetor);
            if (dSetor.length === 0)
                return;
            const sTot = dSetor.reduce((a, c) => {
                a.r += c.horas_ronda;
                a.b += c.horas_produtivas;
                a.i += c.horas_improdutivas;
                a.f += c.horas_flutuantes;
                return a;
            }, { r: 0, b: 0, i: 0, f: 0 });
            const sMedia = sTot.r > 0 ? (sTot.b / sTot.r) * 100 : 0;
            const meta = this.metasSetor[nomeSetor] || 0;
            if (sMedia >= meta) {
                htmlSetores += `<li>✅ <b class="text-success">${escapeHtml(nomeSetor)}:</b> Atingiu a meta (${sMedia.toFixed(1)}% vs ${meta}%).</li>`;
            }
            else {
                const causa = sTot.i > sTot.f ? 'Alta Ineficiência Operacional' : 'Muito tempo em Horas Flutuantes';
                htmlSetores += `<li>❌ <b class="text-danger">${escapeHtml(nomeSetor)}:</b> Reprovou (${sMedia.toFixed(1)}% vs ${meta}%). <i>Causa Principal: ${causa}</i></li>`;
            }
        });
        htmlSetores += '</ul></div>';
=======
        Object.keys(metasSetor).forEach(nomeSetor => {
            let dSetor = dadosTotais.filter(d => d.setor === nomeSetor);
            if (dSetor.length === 0)
                return;
            let sTot = dSetor.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; a.i += c.hIneficiencia; a.v += c.hVazias; return a; }, { r: 0, b: 0, i: 0, v: 0 });
            let sMedia = sTot.r > 0 ? (sTot.b / sTot.r) * 100 : 0;
            let meta = metasSetor[nomeSetor] || 0;
            if (sMedia >= meta) {
                htmlSetores += `<li>✅ <b class="text-success">${nomeSetor}:</b> Atingiu a meta (${sMedia.toFixed(1)}% vs ${meta}%).</li>`;
            }
            else {
                let causa = sTot.i > sTot.v ? "Alta Ineficiência" : "Alta Ociosidade";
                htmlSetores += `<li>❌ <b class="text-danger">${nomeSetor}:</b> Reprovou (${sMedia.toFixed(1)}% vs ${meta}%). <i>Causa: ${causa}</i></li>`;
            }
        });
        htmlSetores += `</ul></div>`;
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
        reportBody.innerHTML += htmlSetores;
        reportBody.innerHTML += `
            <div class="insight-card positive">
                <div class="insight-title">🛠️ Plano de Ação Estratégico</div>
                <ul class="action-list">
<<<<<<< HEAD
                    <li><b>Horas Flutuantes/Vazias:</b> Acionar logística, PCP ou alinhar suprimento.</li>
                    <li><b>Improdutividade:</b> Foco em Treinamento Operacional ou auditoria no setup da máquina.</li>
                    <li><b>Horas Reparo:</b> Revisar cronograma de manutenção preventiva com a equipe técnica.</li>
=======
                    <li><b>Horas Vazias:</b> Acionar logística, PCP ou abrir chamado de manutenção.</li>
                    <li><b>Ineficiência:</b> Foco em Treinamento Operacional ou auditoria no setup da máquina.</li>
                    <li><b>Indiretas:</b> Aplicar 5S no posto e abastecimento contínuo via empilhadeira.</li>
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
                </ul>
            </div>`;
    }
}
<<<<<<< HEAD
// --- 8. FORM MANAGER ---
class FormManager {
    api;
    dashboard;
    setores = [];
    funcionarios = [];
    esteiras = [];
    constructor(api, dashboard) {
        this.api = api;
        this.dashboard = dashboard;
        this.initForms();
    }
    // Carrega todos os dados de apoio do banco
    async carregarDadosIniciais() {
        const [setores, funcionarios, esteiras] = await Promise.all([
            this.api.getSetores(),
            this.api.getFuncionarios(),
            this.api.getEsteiras()
        ]);
        this.setores = setores;
        this.funcionarios = funcionarios;
        this.esteiras = esteiras;
        this.dashboard.definirSetores(setores);
        this.dashboard.definirEsteiras(esteiras);
        this.atualizarSelects();
        this.atualizarTabelaUsuarios();
    }
    async recarregarFuncionarios() {
        this.funcionarios = await this.api.getFuncionarios();
        this.atualizarSelects();
        this.atualizarTabelaUsuarios();
    }
    async recarregarEsteiras() {
        this.esteiras = await this.api.getEsteiras();
        this.dashboard.definirEsteiras(this.esteiras);
        this.atualizarSelects();
    }
    criarOption(valor, texto) {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = texto;
        return opt;
=======
// --- 6. FORM MANAGER  ---
class FormManager {
    db;
    dashboard;
    constructor(db, dashboard) {
        this.db = db;
        this.dashboard = dashboard;
        this.initForms();
        this.atualizarSelects();
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
    }
    atualizarSelects() {
        const selOp = document.getElementById('ap-operador');
        if (selOp) {
<<<<<<< HEAD
            selOp.innerHTML = '';
            selOp.appendChild(this.criarOption('', 'Selecione um funcionário...'));
            this.funcionarios.forEach(op => selOp.appendChild(this.criarOption(String(op.id_funcionario), `${op.nome} (Matrícula: ${op.codigo_matricula}) - ${op.setor}`)));
        }
        const selEsteira = document.getElementById('ap-esteira');
        if (selEsteira) {
            selEsteira.innerHTML = '';
            selEsteira.appendChild(this.criarOption('', 'Selecione uma esteira...'));
            this.esteiras.forEach(maq => selEsteira.appendChild(this.criarOption(String(maq.id_esteira), `${maq.nome_descricao} (${maq.codigo_patrimonio})`)));
        }
        ['cad-op-setor', 'novo-setor'].forEach(id => {
            const sel = document.getElementById(id);
            if (!sel || this.setores.length === 0)
                return;
            const atual = sel.value;
            sel.innerHTML = '';
            this.setores.forEach(s => sel.appendChild(this.criarOption(s.nome, s.nome)));
            if (atual && this.setores.some(s => s.nome === atual))
                sel.value = atual;
        });
    }
    atualizarTabelaUsuarios() {
        const tbody = document.getElementById('tabela-usuarios-body');
        if (!tbody)
            return;
        tbody.innerHTML = '';
        this.funcionarios.forEach(f => {
            const tr = document.createElement('tr');
            [f.codigo_matricula, f.nome, f.setor, f.cargo].forEach(valor => {
                const td = document.createElement('td');
                td.textContent = valor;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
    initForms() {
        document.getElementById('form-esteira')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();
            const desc = document.getElementById('cad-descricao').value.trim();
            try {
                await this.api.criarEsteira(codigo, desc);
                await this.recarregarEsteiras();
                Swal.fire('Sucesso', 'Máquina adicionada.', 'success');
                form.reset();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
        // --- Cadastro de funcionário (aba Operação & Setup) ---
        document.getElementById('form-operador')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const cracha = document.getElementById('cad-op-cracha').value.trim();
            const nome = document.getElementById('cad-op-nome').value.trim();
            const setor = document.getElementById('cad-op-setor').value;
            const cargo = document.getElementById('cad-op-cargo').value.trim();
            try {
                await this.api.criarFuncionario(cracha, setor, nome, cargo);
                await this.recarregarFuncionarios();
                Swal.fire('Sucesso', `Funcionário ${nome} cadastrado!`, 'success');
                form.reset();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
        // --- Cadastro de utilizador (aba Gestão de Acessos) ---
        document.getElementById('form-novo-usuario')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const nome = document.getElementById('novo-nome').value.trim();
            const cracha = document.getElementById('novo-cracha').value.trim();
            const setor = document.getElementById('novo-setor').value;
            const cargo = document.getElementById('novo-cargo').value.trim();
            try {
                await this.api.criarFuncionario(cracha, setor, nome, cargo);
                await this.recarregarFuncionarios();
                Swal.fire('Sucesso', `Utilizador ${nome} adicionado com sucesso!`, 'success');
                form.reset();
            }
            catch (err) {
                mostrarErro(err);
            }
        });
        // --- Apontamento diário ---
        document.getElementById('form-apontamento')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id_funcionario = parseInt(document.getElementById('ap-operador').value);
            const id_esteira = parseInt(document.getElementById('ap-esteira').value);
            const data_registro = document.getElementById('ap-data').value;
            const horas_trabalhadas_nela = lerNumero('ap-horas-nela');
            const horas_ronda = lerNumero('ap-ronda');
            const horas_apontadas = lerNumero('ap-apontadas');
            const horas_produtivas = lerNumero('ap-produtivas');
            const horas_improdutivas = lerNumero('ap-improdutivas');
            const horas_reparo = lerNumero('ap-reparo');
            const horas_flutuantes = lerNumero('ap-flutuantes');
            if (isNaN(id_funcionario) || isNaN(id_esteira)) {
                Swal.fire('Erro', 'Selecione o funcionário e a esteira corretamente.', 'error');
                return;
            }
            if (horas_trabalhadas_nela > horas_ronda) {
                Swal.fire('Erro', 'As horas trabalhadas na esteira não podem exceder as horas de ronda.', 'error');
                return;
            }
            try {
                await this.api.criarApontamento({
                    id_funcionario, id_esteira, data_registro,
                    horas_trabalhadas_nela, horas_ronda, horas_apontadas,
                    horas_produtivas, horas_improdutivas, horas_reparo, horas_flutuantes
                });
                await this.dashboard.atualizarDashboard();
                Swal.fire('Sucesso', 'Apontamento registrado no Banco de Dados!', 'success');
                ['ap-horas-nela', 'ap-ronda', 'ap-apontadas', 'ap-produtivas', 'ap-improdutivas', 'ap-reparo', 'ap-flutuantes'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el)
                        el.value = '';
                });
            }
            catch (err) {
                mostrarErro(err);
            }
        });
    }
}
// --- 9. INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
=======
            selOp.innerHTML = '<option value="">Selecione um operador...</option>';
            this.db.operadores.forEach(op => selOp.innerHTML += `<option value="${op.cracha}">${op.nome} (Crachá: ${op.cracha})</option>`);
        }
        const selSetor = document.getElementById('ap-setor');
        const selEsteira = document.getElementById('ap-esteira');
        const carregarEsteiras = () => {
            if (!selEsteira || !selSetor)
                return;
            selEsteira.innerHTML = '';
            let filtradas = this.db.maquinas.filter(m => m.setor === selSetor.value);
            filtradas.forEach(maq => selEsteira.innerHTML += `<option value="${maq.id}">${maq.nome}</option>`);
        };
        selSetor?.addEventListener('change', carregarEsteiras);
        carregarEsteiras();
    }
    initForms() {
        document.getElementById('form-esteira')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('cad-codigo').value.toUpperCase();
            const setor = document.getElementById('cad-setor').value;
            if (this.db.maquinas.some(m => m.id === id)) {
                // @ts-ignore
                Swal.fire('Erro', 'Esteira já cadastrada!', 'error');
                return;
            }
            this.db.addMaquina(id, setor);
            this.atualizarSelects();
            this.dashboard.preencherSelectFiltros();
            // @ts-ignore
            Swal.fire('Sucesso', 'Máquina adicionada.', 'success');
            e.target.reset();
        });
        document.getElementById('form-operador')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const cracha = document.getElementById('cad-op-cracha').value;
            const nome = document.getElementById('cad-op-nome').value;
            this.db.addOperador(cracha, nome);
            this.atualizarSelects();
            // @ts-ignore
            Swal.fire('Sucesso', `Operador ${nome} cadastrado!`, 'success');
            e.target.reset();
        });
        document.getElementById('form-apontamento')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const cracha = document.getElementById('ap-operador').value;
            const dataRaw = document.getElementById('ap-data').value;
            const esteira = document.getElementById('ap-esteira').value;
            const setor = document.getElementById('ap-setor').value;
            const hRonda = parseFloat(document.getElementById('ap-ronda').value);
            const hBoas = parseFloat(document.getElementById('ap-boas').value);
            const hVazias = parseFloat(document.getElementById('ap-vazias').value);
            const hIndiretas = parseFloat(document.getElementById('ap-indiretas').value);
            let hApontadas = hRonda - hVazias - hIndiretas;
            let hIneficiencia = hApontadas - hBoas;
            if (hBoas > hApontadas || hApontadas < 0) {
                // @ts-ignore
                Swal.fire('Erro Matemático', 'Horas Vazias + Indiretas + Boas ultrapassam as Horas Ronda.', 'error');
                return;
            }
            const partesData = dataRaw.split('-');
            const mesFormatado = partesData.length > 1 ? parseInt(partesData[1]) : new Date().getMonth() + 1;
            this.db.apontamentos.push({
                cracha, dataCompleta: dataRaw, id: esteira, nome: `Est. ${esteira}`, setor,
                mes: mesFormatado, hRonda, hApontadas, hBoas, hIneficiencia, hVazias, hIndiretas
            });
            this.dashboard.atualizarDashboard();
            // @ts-ignore
            Swal.fire('Sucesso', 'Apontamento registrado com sucesso!', 'success');
            ['ap-ronda', 'ap-boas', 'ap-vazias', 'ap-indiretas'].forEach(id => document.getElementById(id).value = '');
        });
    }
}
// --- 7. INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
    const inputData = document.getElementById('ap-data');
    if (inputData)
        inputData.valueAsDate = new Date();
    new ThemeManager();
    new UIManager();
<<<<<<< HEAD
    const api = new ApiService();
    const dashboard = new DashboardManager(api);
    const forms = new FormManager(api, dashboard);
    try {
        await forms.carregarDadosIniciais();
        await dashboard.atualizarDashboard();
    }
    catch (e) {
        mostrarErro(e);
    }
=======
    const db = new DatabaseService();
    const dashboard = new DashboardManager(db);
    new FormManager(db, dashboard);
    dashboard.preencherSelectFiltros();
    dashboard.atualizarDashboard();
>>>>>>> b11dcfeb65d6d469031dfeed45adf1732dd04a38
});
