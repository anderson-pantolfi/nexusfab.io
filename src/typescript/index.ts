
declare const Chart: any;
declare const Swal: any;

// --- 1. CONFIGURAÇÕES ---
const API_URL: string = 'http://localhost/nexusfab/src/php/api.php';
const ANO_REFERENCIA: number = 2026;
const META_ESTEIRA: number = 80;

const cores = {
    produtivas: '#10b981',
    improdutivas: '#f59e0b',
    reparo: '#ef4444',
    flutuantes: '#8b5cf6'
};

const nomesMeses: string[] = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// --- 2. INTERFACES ---
interface Setor {
    id_setor: number;
    nome: string;
    meta_percentual: number | string;
}

interface Funcionario {
    id_funcionario: number;
    codigo_matricula: string;
    nome: string;
    cargo: string;
    id_setor: number;
    setor: string;
}

interface Esteira {
    id_esteira: number;
    codigo_patrimonio: string;
    nome_descricao: string;
}

interface NovoApontamento {
    id_funcionario: number;
    id_esteira: number;
    data_registro: string;
    horas_trabalhadas_nela: number;
    horas_ronda: number;
    horas_apontadas: number;
    horas_produtivas: number;
    horas_improdutivas: number;
    horas_reparo: number;
    horas_flutuantes: number;
}

interface VisaoDashboardDTO {
    mes: number;
    id_esteira: number;
    nome_esteira: string;
    setor: string;
    horas_ronda: number;
    horas_produtivas: number;
    horas_improdutivas: number;
    horas_reparo: number;
    horas_flutuantes: number;
    prodPura?: number;
    labelExibicao?: string;
}

// --- 3. UTILITÁRIOS ---
function escapeHtml(valor: unknown): string {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function mostrarErro(e: unknown): void {
    const msg = e instanceof Error ? e.message : 'Erro inesperado.';
    Swal.fire('Erro', msg, 'error');
}

function lerNumero(id: string): number {
    return parseFloat((document.getElementById(id) as HTMLInputElement).value);
}

// --- 4. API SERVICE  ---
class ApiService {
    private async request<T>(recurso: string, opcoes: RequestInit = {}, query: string = ''): Promise<T> {
        let resposta: Response;
        try {
            resposta = await fetch(`${API_URL}?recurso=${recurso}${query}`, {
                headers: { 'Content-Type': 'application/json' },
                ...opcoes
            });
        } catch {
            throw new Error('Não foi possível conectar ao servidor.');
        }

        let corpo: any = null;
        try { corpo = await resposta.json(); } catch { /* resposta sem JSON */ }

        if (!resposta.ok) {
            throw new Error(corpo?.erro ?? `Falha na requisição (${resposta.status}).`);
        }
        return corpo as T;
    }

    public getSetores(): Promise<Setor[]> {
        return this.request<Setor[]>('setores');
    }

    public getFuncionarios(): Promise<Funcionario[]> {
        return this.request<Funcionario[]>('funcionarios');
    }

    public criarFuncionario(codigo_matricula: string, setor: string, nome: string, cargo: string): Promise<{ id_funcionario: number }> {
        return this.request('funcionarios', {
            method: 'POST',
            body: JSON.stringify({ codigo_matricula, setor, nome, cargo })
        });
    }

    public getEsteiras(): Promise<Esteira[]> {
        return this.request<Esteira[]>('esteiras');
    }

    public criarEsteira(codigo_patrimonio: string, nome_descricao: string): Promise<{ id_esteira: number }> {
        return this.request('esteiras', {
            method: 'POST',
            body: JSON.stringify({ codigo_patrimonio, nome_descricao })
        });
    }

    public criarApontamento(dados: NovoApontamento): Promise<{ id_apontamento: number }> {
        return this.request('apontamentos', {
            method: 'POST',
            body: JSON.stringify(dados)
        });
    }

    public getDashboard(ano: number, mes: string, esteira: string): Promise<VisaoDashboardDTO[]> {
        const params = `&ano=${ano}&mes=${encodeURIComponent(mes)}&id_esteira=${encodeURIComponent(esteira)}`;
        return this.request<VisaoDashboardDTO[]>('dashboard', {}, params);
    }
}

// --- 5. THEME MANAGER ---
class ThemeManager {
    private readonly THEME_KEY: string = 'nexus_theme';
    private btnTheme: HTMLElement | null;
    private themeIcon: HTMLElement | null;

    constructor() {
        this.btnTheme = document.getElementById('btn-theme');
        this.themeIcon = document.getElementById('theme-icon');
        this.init();
    }

    private init(): void {
        const savedTheme = localStorage.getItem(this.THEME_KEY);
        if (savedTheme === 'dark') this.setDarkTheme();
        this.btnTheme?.addEventListener('click', () => this.toggleTheme());
    }

    private toggleTheme(): void {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        isDark ? this.setLightTheme() : this.setDarkTheme();
    }

    private setDarkTheme(): void {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem(this.THEME_KEY, 'dark');
        if (this.themeIcon) this.themeIcon.className = 'fas fa-sun';
    }

    private setLightTheme(): void {
        document.body.removeAttribute('data-theme');
        localStorage.setItem(this.THEME_KEY, 'light');
        if (this.themeIcon) this.themeIcon.className = 'fas fa-moon';
    }
}

// --- 6. UI MANAGER ---
class UIManager {
    constructor() {
        this.initNavigation();
        this.initDropdowns();
    }

    private initNavigation(): void {
        const navLinks = document.querySelectorAll('.nav-link[data-target]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e: Event) => {
                e.preventDefault();
                const targetId = (e.currentTarget as HTMLElement).getAttribute('data-target');
                if (!targetId) return;

                document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));

                document.getElementById(targetId)?.classList.add('active');
                document.querySelectorAll(`.nav-link[data-target="${targetId}"]`).forEach(el => el.classList.add('active'));

                const barraFiltros = document.getElementById('barra-filtros');
                if (barraFiltros) {
                    barraFiltros.style.display = targetId === 'dashboard' ? 'flex' : 'none';
                }
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
            });
        });
    }

    private initDropdowns(): void {
        const toggleMenu = (menuId: string, event: Event) => {
            event.stopPropagation();
            const menu = document.getElementById(menuId);
            document.querySelectorAll('.dropdown-content').forEach(el => {
                if (el !== menu) el.classList.remove('show');
            });
            menu?.classList.toggle('show');
        };

        document.getElementById('btn-profile')?.addEventListener('click', (e) => toggleMenu('profile-menu', e));
        document.getElementById('btn-notif')?.addEventListener('click', (e) => toggleMenu('notif-menu', e));

        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
        });
    }
}

// --- 7. DASHBOARD MANAGER ---
class DashboardManager {
    private graficosAtivos: any[] = [];
    private api: ApiService;
    private metasSetor: Record<string, number> = {};
    private esteiras: Esteira[] = [];
    private requisicaoAtual: number = 0; // evita que respostas antigas sobrescrevam as novas

    constructor(api: ApiService) {
        this.api = api;
        this.bindFiltros();
    }

    private bindFiltros(): void {
        ['filtro-mes', 'filtro-visao', 'filtro-esteira'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.atualizarDashboard());
        });
    }

    public definirSetores(setores: Setor[]): void {
        this.metasSetor = {};
        setores.forEach(s => { this.metasSetor[s.nome] = Number(s.meta_percentual); });
    }

    public definirEsteiras(esteiras: Esteira[]): void {
        this.esteiras = esteiras;
        this.preencherSelectFiltros();
    }

    public preencherSelectFiltros(): void {
        const selectFiltro = document.getElementById('filtro-esteira') as HTMLSelectElement | null;
        if (!selectFiltro) return;

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

    private agregar(dados: VisaoDashboardDTO[], porMes: boolean): VisaoDashboardDTO[] {
        const agregados: Record<string, VisaoDashboardDTO> = {};

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
            const a = agregados[chave]!;
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

    public async atualizarDashboard(): Promise<void> {
        const dashboard = document.getElementById('dashboard-grid');
        if (!dashboard) return;

        const mes = (document.getElementById('filtro-mes') as HTMLSelectElement).value;
        const visao = (document.getElementById('filtro-visao') as HTMLSelectElement).value;
        const esteira = (document.getElementById('filtro-esteira') as HTMLSelectElement).value;
        const selVisao = document.getElementById('filtro-visao') as HTMLSelectElement;

        const idRequisicao = ++this.requisicaoAtual;

        let brutos: VisaoDashboardDTO[];
        try {
            brutos = await this.api.getDashboard(ANO_REFERENCIA, mes, esteira);
        } catch (e) {
            mostrarErro(e);
            return;
        }
        if (idRequisicao !== this.requisicaoAtual) return; // chegou uma requisição mais nova

        this.graficosAtivos.forEach(g => g.destroy());
        this.graficosAtivos = [];
        dashboard.innerHTML = '';

        const individual = esteira !== 'todas';
        const dados = this.agregar(brutos, individual && mes === 'todos');

        selVisao.disabled = individual;

        if (individual) {
            if (dados.length > 0 && dados[0]) {
                const tot = dados.reduce((a, c) => { a.r += c.horas_ronda; a.b += c.horas_produtivas; return a; }, { r: 0, b: 0 });
                this.renderizarCard(
                    `Análise Temporal: ${dados[0].nome_esteira}`,
                    dados,
                    tot.r > 0 ? (tot.b / tot.r) * 100 : 0,
                    META_ESTEIRA,
                    dashboard
                );
            }
        } else {
            Object.keys(this.metasSetor).forEach(nomeSetor => {
                const dSetor = dados.filter(d => d.setor === nomeSetor);
                if (dSetor.length === 0) return;

                visao === 'piores'
                    ? dSetor.sort((a, b) => (a.prodPura || 0) - (b.prodPura || 0))
                    : dSetor.sort((a, b) => b.horas_ronda - a.horas_ronda);

                const top10 = dSetor.slice(0, 10);
                const tot = top10.reduce((a, c) => { a.r += c.horas_ronda; a.b += c.horas_produtivas; return a; }, { r: 0, b: 0 });

                const metaAtual = this.metasSetor[nomeSetor] || 0;
                this.renderizarCard(
                    `${nomeSetor} (Meta: ${metaAtual}%)`,
                    top10,
                    tot.r > 0 ? (tot.b / tot.r) * 100 : 0,
                    metaAtual,
                    dashboard
                );
            });
        }

        this.gerarRelatorio(dados, individual);
    }

    private renderizarCard(titulo: string, dados: VisaoDashboardDTO[], prodPuraMedia: number, meta: number, container: HTMLElement): void {
        const idx = this.graficosAtivos.length;
        const card = document.createElement('div');
        card.className = 'card chart-card';

        card.innerHTML = `
            <div class="chart-header"><h4>${escapeHtml(titulo)}</h4></div>
            <div class="kpi-container">
                <div class="kpi-box"><div class="kpi-title">Média Atingida</div><div class="kpi-value ${prodPuraMedia >= meta ? 'good' : 'danger'}">${(prodPuraMedia || 0).toFixed(1)}%</div></div>
            </div>
            <div class="canvas-container"><canvas id="chart-dyn-${idx}"></canvas></div>`;

        container.appendChild(card);

        const canvasEl = document.getElementById(`chart-dyn-${idx}`) as HTMLCanvasElement;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;

        const g = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.map(d => d.labelExibicao),
                datasets: [
                    { type: 'line', label: 'Tendência Prod. Pura (%)', data: dados.map(d => d.prodPura), borderColor: '#1e293b', backgroundColor: '#1e293b', yAxisID: 'y1', tension: 0.3, borderWidth: 3, fill: false, order: 1 },
                    { type: 'line', label: 'Meta (%)', data: dados.map(() => meta), borderColor: '#2563eb', borderDash: [5, 5], pointRadius: 0, yAxisID: 'y1', borderWidth: 2, fill: false, order: 0 },
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
            }
        });
        this.graficosAtivos.push(g);
    }

    private gerarRelatorio(dadosTotais: VisaoDashboardDTO[], isIndividual: boolean): void {
        const reportBody = document.getElementById('report-body');
        if (!reportBody) return;
        reportBody.innerHTML = '';

        if (dadosTotais.length === 0) {
            reportBody.innerHTML = '<p class="text-muted">Nenhum dado encontrado para os filtros selecionados.</p>';
            return;
        }

        const tot = dadosTotais.reduce((a, c) => { a.r += c.horas_ronda; a.b += c.horas_produtivas; return a; }, { r: 0, b: 0 });
        const mediaPura = tot.r > 0 ? (tot.b / tot.r) * 100 : 0;

        if (isIndividual) {
            reportBody.innerHTML = `
                <div class="insight-card ${mediaPura >= META_ESTEIRA ? 'positive' : 'negative'}">
                    <div class="insight-title">Análise de Desempenho: ${escapeHtml(dadosTotais[0]?.nome_esteira)}</div>
                    Produtividade pura média: <b>${mediaPura.toFixed(1)}%</b>.
                    ${mediaPura < META_ESTEIRA ? `<br><b>Alerta:</b> Abaixo da meta de ${META_ESTEIRA}%. Requer atenção.` : '<br><b>Excelente:</b> Dentro ou acima da meta.'}
                </div>`;
            return;
        }

        let htmlSetores = `<div class="insight-card neutral"><div class="insight-title">📊 Análise de Metas por Setor</div><ul class="action-list">`;
        Object.keys(this.metasSetor).forEach(nomeSetor => {
            const dSetor = dadosTotais.filter(d => d.setor === nomeSetor);
            if (dSetor.length === 0) return;

            const sTot = dSetor.reduce((a, c) => {
                a.r += c.horas_ronda; a.b += c.horas_produtivas;
                a.i += c.horas_improdutivas; a.f += c.horas_flutuantes;
                return a;
            }, { r: 0, b: 0, i: 0, f: 0 });
            const sMedia = sTot.r > 0 ? (sTot.b / sTot.r) * 100 : 0;
            const meta = this.metasSetor[nomeSetor] || 0;

            if (sMedia >= meta) {
                htmlSetores += `<li>✅ <b class="text-success">${escapeHtml(nomeSetor)}:</b> Atingiu a meta (${sMedia.toFixed(1)}% vs ${meta}%).</li>`;
            } else {
                const causa = sTot.i > sTot.f ? 'Alta Ineficiência Operacional' : 'Muito tempo em Horas Flutuantes';
                htmlSetores += `<li>❌ <b class="text-danger">${escapeHtml(nomeSetor)}:</b> Reprovou (${sMedia.toFixed(1)}% vs ${meta}%). <i>Causa Principal: ${causa}</i></li>`;
            }
        });
        htmlSetores += '</ul></div>';
        reportBody.innerHTML += htmlSetores;

        reportBody.innerHTML += `
            <div class="insight-card positive">
                <div class="insight-title">🛠️ Plano de Ação Estratégico</div>
                <ul class="action-list">
                    <li><b>Horas Flutuantes/Vazias:</b> Acionar logística, PCP ou alinhar suprimento.</li>
                    <li><b>Improdutividade:</b> Foco em Treinamento Operacional ou auditoria no setup da máquina.</li>
                    <li><b>Horas Reparo:</b> Revisar cronograma de manutenção preventiva com a equipe técnica.</li>
                </ul>
            </div>`;
    }
}

// --- 8. FORM MANAGER ---
class FormManager {
    private api: ApiService;
    private dashboard: DashboardManager;
    private setores: Setor[] = [];
    private funcionarios: Funcionario[] = [];
    private esteiras: Esteira[] = [];

    constructor(api: ApiService, dashboard: DashboardManager) {
        this.api = api;
        this.dashboard = dashboard;
        this.initForms();
    }

    // Carrega todos os dados de apoio do banco
    public async carregarDadosIniciais(): Promise<void> {
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

    private async recarregarFuncionarios(): Promise<void> {
        this.funcionarios = await this.api.getFuncionarios();
        this.atualizarSelects();
        this.atualizarTabelaUsuarios();
    }

    private async recarregarEsteiras(): Promise<void> {
        this.esteiras = await this.api.getEsteiras();
        this.dashboard.definirEsteiras(this.esteiras);
        this.atualizarSelects();
    }

    private criarOption(valor: string, texto: string): HTMLOptionElement {
        const opt = document.createElement('option');
        opt.value = valor;
        opt.textContent = texto;
        return opt;
    }

    private atualizarSelects(): void {
        const selOp = document.getElementById('ap-operador') as HTMLSelectElement | null;
        if (selOp) {
            selOp.innerHTML = '';
            selOp.appendChild(this.criarOption('', 'Selecione um funcionário...'));
            this.funcionarios.forEach(op =>
                selOp.appendChild(this.criarOption(String(op.id_funcionario), `${op.nome} (Matrícula: ${op.codigo_matricula}) - ${op.setor}`))
            );
        }

        const selEsteira = document.getElementById('ap-esteira') as HTMLSelectElement | null;
        if (selEsteira) {
            selEsteira.innerHTML = '';
            selEsteira.appendChild(this.criarOption('', 'Selecione uma esteira...'));
            this.esteiras.forEach(maq =>
                selEsteira.appendChild(this.criarOption(String(maq.id_esteira), `${maq.nome_descricao} (${maq.codigo_patrimonio})`))
            );
        }

        ['cad-op-setor', 'novo-setor'].forEach(id => {
            const sel = document.getElementById(id) as HTMLSelectElement | null;
            if (!sel || this.setores.length === 0) return;
            const atual = sel.value;
            sel.innerHTML = '';
            this.setores.forEach(s => sel.appendChild(this.criarOption(s.nome, s.nome)));
            if (atual && this.setores.some(s => s.nome === atual)) sel.value = atual;
        });
    }

    public atualizarTabelaUsuarios(): void {
        const tbody = document.getElementById('tabela-usuarios-body');
        if (!tbody) return;
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

    private initForms(): void {
        document.getElementById('form-esteira')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const codigo = (document.getElementById('cad-codigo') as HTMLInputElement).value.trim().toUpperCase();
            const desc = (document.getElementById('cad-descricao') as HTMLInputElement).value.trim();

            try {
                await this.api.criarEsteira(codigo, desc);
                await this.recarregarEsteiras();
                Swal.fire('Sucesso', 'Máquina adicionada.', 'success');
                form.reset();
            } catch (err) {
                mostrarErro(err);
            }
        });

        // --- Cadastro de funcionário (aba Operação & Setup) ---
        document.getElementById('form-operador')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const cracha = (document.getElementById('cad-op-cracha') as HTMLInputElement).value.trim();
            const nome = (document.getElementById('cad-op-nome') as HTMLInputElement).value.trim();
            const setor = (document.getElementById('cad-op-setor') as HTMLSelectElement).value;
            const cargo = (document.getElementById('cad-op-cargo') as HTMLInputElement).value.trim();

            try {
                await this.api.criarFuncionario(cracha, setor, nome, cargo);
                await this.recarregarFuncionarios();
                Swal.fire('Sucesso', `Funcionário ${nome} cadastrado!`, 'success');
                form.reset();
            } catch (err) {
                mostrarErro(err);
            }
        });

        // --- Cadastro de utilizador (aba Gestão de Acessos) ---
        document.getElementById('form-novo-usuario')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const nome = (document.getElementById('novo-nome') as HTMLInputElement).value.trim();
            const cracha = (document.getElementById('novo-cracha') as HTMLInputElement).value.trim();
            const setor = (document.getElementById('novo-setor') as HTMLSelectElement).value;
            const cargo = (document.getElementById('novo-cargo') as HTMLInputElement).value.trim();

            try {
                await this.api.criarFuncionario(cracha, setor, nome, cargo);
                await this.recarregarFuncionarios();
                Swal.fire('Sucesso', `Utilizador ${nome} adicionado com sucesso!`, 'success');
                form.reset();
            } catch (err) {
                mostrarErro(err);
            }
        });

        // --- Apontamento diário ---
        document.getElementById('form-apontamento')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();

            const id_funcionario = parseInt((document.getElementById('ap-operador') as HTMLSelectElement).value);
            const id_esteira = parseInt((document.getElementById('ap-esteira') as HTMLSelectElement).value);
            const data_registro = (document.getElementById('ap-data') as HTMLInputElement).value;

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
                    const el = document.getElementById(id) as HTMLInputElement | null;
                    if (el) el.value = '';
                });
            } catch (err) {
                mostrarErro(err);
            }
        });
    }
}

// --- 9. INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    const inputData = document.getElementById('ap-data') as HTMLInputElement | null;
    if (inputData) inputData.valueAsDate = new Date();

    new ThemeManager();
    new UIManager();

    const api = new ApiService();
    const dashboard = new DashboardManager(api);
    const forms = new FormManager(api, dashboard);

    try {
        await forms.carregarDadosIniciais();
        await dashboard.atualizarDashboard();
    } catch (e) {
        mostrarErro(e);
    }
});