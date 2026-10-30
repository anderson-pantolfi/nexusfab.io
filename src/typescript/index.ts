declare const Chart: any;
declare const Swal: any;

// ============================================================
// 1. CONFIGURAÇÃO
// ============================================================
const API_URL: string = 'http://localhost/nexusfab/src/php/api.php';
const META_PADRAO: number = 80;
const TOP_ESTEIRAS: number = 10;
const ITENS_POR_PAGINA: number = 12;

const CORES = {
    produtivas: '#10b981',
    improdutivas: '#f59e0b',
    reparo: '#ef4444',
    flutuantes: '#8b5cf6',
    meta: '#2563eb'
} as const;

const MESES: readonly string[] = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS: readonly string[] = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const TITULOS: Record<string, [string, string]> = {
    dashboard: ['Painel de Gestão e Eficiência', 'Visão Estratégica de Produção'],
    relatorio: ['Relatório Gerencial', 'Diagnóstico automático e plano de ação'],
    apontamentos: ['Apontamentos', 'Registro diário de produtividade'],
    funcionarios: ['Funcionários', 'Cadastro e gestão da equipe'],
    esteiras: ['Esteiras', 'Cadastro e gestão de máquinas'],
    perfil: ['Meu Perfil', 'Dados da conta'],
    configuracoes: ['Configurações', 'Preferências do sistema']
};

// ============================================================
// 2. TIPOS
// ============================================================
interface Setor { id_setor: number; nome: string; meta_percentual: number | string; }

interface Funcionario {
    id_funcionario: number;
    codigo_matricula: string;
    nome: string;
    cargo: string;
    id_setor: number;
    setor: string;
}

interface Esteira { id_esteira: number; codigo_patrimonio: string; nome_descricao: string; }

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

interface Horas {
    horas_ronda: number;
    horas_produtivas: number;
    horas_improdutivas: number;
    horas_reparo: number;
    horas_flutuantes: number;
}

interface LinhaDashboard extends Horas {
    mes: number;
    id_esteira: number;
    nome_esteira: string;
    setor: string;
}

interface Agregado extends LinhaDashboard { rotulo: string; prodPura: number; }
interface Periodo { inicio: number; fim: number; rotulo: string; }
interface Filtros { ano: number; periodo: Periodo; visao: string; esteira: string; }

// ============================================================
// 3. UTILITÁRIOS
// ============================================================
function escapeHtml(valor: unknown): string {
    return String(valor ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function elemento<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function elementoObrigatorio<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento #${id} não encontrado.`);
    return el as T;
}

function criarOption(valor: string, texto: string): HTMLOptionElement {
    const opt = document.createElement('option');
    opt.value = valor;
    opt.textContent = texto;
    return opt;
}

function formatarNumero(valor: number, casas: number = 1): string {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarPercentual(valor: number): string {
    return `${formatarNumero(valor)}%`;
}

function nomeMes(mes: number, curto: boolean = false): string {
    return (curto ? MESES_CURTOS : MESES)[mes] ?? `Mês ${mes}`;
}

function percentual(parte: number, total: number): number {
    return total > 0 ? (parte / total) * 100 : 0;
}

function hojeISO(): string {
    const agora = new Date();
    return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
    let timer: number | undefined;
    return (...args: A) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), ms);
    };
}

function lerNumero(id: string): number {
    return parseFloat(elementoObrigatorio<HTMLInputElement>(id).value);
}

function mostrarErro(e: unknown): void {
    Swal.fire('Erro', e instanceof Error ? e.message : 'Erro inesperado.', 'error');
}

function notificar(mensagem: string): void {
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: mensagem, showConfirmButton: false, timer: 2500, timerProgressBar: true });
}

function zerarHoras(): Horas {
    return { horas_ronda: 0, horas_produtivas: 0, horas_improdutivas: 0, horas_reparo: 0, horas_flutuantes: 0 };
}

function totalizar(linhas: readonly Horas[]): Horas {
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

function produtividade(h: Horas): number {
    return percentual(h.horas_produtivas, h.horas_ronda);
}

const PERIODOS: Record<string, Periodo> = {
    todos: { inicio: 1, fim: 12, rotulo: 'Ano completo' },
    S1: { inicio: 1, fim: 6, rotulo: '1º Semestre' },
    S2: { inicio: 7, fim: 12, rotulo: '2º Semestre' }
};

function obterPeriodo(valor: string): Periodo {
    const fixo = PERIODOS[valor];
    if (fixo) return fixo;
    const mes = Number(valor);
    return { inicio: mes, fim: mes, rotulo: nomeMes(mes) };
}

// ============================================================
// 4. API
// ============================================================
class ApiError extends Error {
    public readonly status: number;
    public readonly dados: Record<string, unknown>;

    constructor(mensagem: string, status: number, dados: Record<string, unknown> = {}) {
        super(mensagem);
        this.name = 'ApiError';
        this.status = status;
        this.dados = dados;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

class ApiService {
    private async request<T>(recurso: string, metodo: string = 'GET', params: Record<string, string | number> = {}, corpo?: unknown): Promise<T> {
        const qs = new URLSearchParams({ recurso });
        Object.entries(params).forEach(([chave, valor]) => qs.set(chave, String(valor)));

        const init: RequestInit = { method: metodo, headers: { 'Content-Type': 'application/json' } };
        if (corpo !== undefined) init.body = JSON.stringify(corpo);

        let resposta: Response;
        try {
            resposta = await fetch(`${API_URL}?${qs.toString()}`, init);
        } catch {
            throw new ApiError('Não foi possível conectar ao servidor.', 0);
        }

        let dados: Record<string, unknown> = {};
        try { dados = await resposta.json(); } catch { }

        if (!resposta.ok) {
            const erro = dados['erro'];
            throw new ApiError(typeof erro === 'string' ? erro : `Falha na requisição (${resposta.status}).`, resposta.status, dados);
        }
        return dados as unknown as T;
    }

    public getSetores(): Promise<Setor[]> { return this.request<Setor[]>('setores'); }

    public async getAnos(): Promise<number[]> {
        const anos = await this.request<unknown[]>('anos');
        return anos.map(Number);
    }

    public getFuncionarios(): Promise<Funcionario[]> { return this.request<Funcionario[]>('funcionarios'); }

    public criarFuncionario(codigo_matricula: string, setor: string, nome: string, cargo: string): Promise<unknown> {
        return this.request('funcionarios', 'POST', {}, { codigo_matricula, setor, nome, cargo });
    }

    public excluirFuncionario(id: number, forcar: boolean): Promise<unknown> {
        return this.request('funcionarios', 'DELETE', forcar ? { id, forcar: 1 } : { id });
    }

    public getEsteiras(): Promise<Esteira[]> { return this.request<Esteira[]>('esteiras'); }

    public criarEsteira(codigo_patrimonio: string, nome_descricao: string): Promise<unknown> {
        return this.request('esteiras', 'POST', {}, { codigo_patrimonio, nome_descricao });
    }

    public excluirEsteira(id: number, forcar: boolean): Promise<unknown> {
        return this.request('esteiras', 'DELETE', forcar ? { id, forcar: 1 } : { id });
    }

    public criarApontamento(dados: NovoApontamento): Promise<unknown> {
        return this.request('apontamentos', 'POST', {}, dados);
    }

    public getDashboard(ano: number, mesInicio: number, mesFim: number, esteira: string): Promise<LinhaDashboard[]> {
        return this.request<LinhaDashboard[]>('dashboard', 'GET', { ano, mes_ini: mesInicio, mes_fim: mesFim, id_esteira: esteira });
    }
}

// ============================================================
// 5. TEMA E NAVEGAÇÃO
// ============================================================
class ThemeManager {
    private readonly CHAVE: string = 'nexus_theme';

    constructor() {
        if (localStorage.getItem(this.CHAVE) === 'dark') this.aplicar(true);
        elemento('btn-theme')?.addEventListener('click', () => {
            this.aplicar(document.body.getAttribute('data-theme') !== 'dark');
            window.dispatchEvent(new CustomEvent('nexus:tema'));
        });
    }

    private aplicar(escuro: boolean): void {
        if (escuro) document.body.setAttribute('data-theme', 'dark');
        else document.body.removeAttribute('data-theme');
        localStorage.setItem(this.CHAVE, escuro ? 'dark' : 'light');
        const icone = elemento('theme-icon');
        if (icone) icone.className = escuro ? 'fas fa-sun' : 'fas fa-moon';
    }
}

class UIManager {
    constructor() {
        document.querySelectorAll('.nav-link[data-target]').forEach(link => {
            link.addEventListener('click', (e: Event) => {
                e.preventDefault();
                const alvo = (e.currentTarget as HTMLElement).getAttribute('data-target');
                if (alvo) this.abrirAba(alvo);
            });
        });

        const alternar = (menuId: string, e: Event) => {
            e.stopPropagation();
            const menu = elemento(menuId);
            document.querySelectorAll('.dropdown-content').forEach(el => { if (el !== menu) el.classList.remove('show'); });
            menu?.classList.toggle('show');
        };
        elemento('btn-profile')?.addEventListener('click', e => alternar('profile-menu', e));
        elemento('btn-notif')?.addEventListener('click', e => alternar('notif-menu', e));
        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
        });
    }

    private abrirAba(id: string): void {
        document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));
        elemento(id)?.classList.add('active');
        document.querySelectorAll(`.nav-link[data-target="${id}"]`).forEach(el => el.classList.add('active'));

        const barra = elemento('barra-filtros');
        if (barra) barra.style.display = id === 'dashboard' ? 'flex' : 'none';

        const titulos = TITULOS[id];
        if (titulos) {
            const titulo = elemento('topbar-titulo');
            const subtitulo = elemento('topbar-subtitulo');
            if (titulo) titulo.textContent = titulos[0];
            if (subtitulo) subtitulo.textContent = titulos[1];
        }
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }
}

// ============================================================
// 6. DASHBOARD
// ============================================================
class DashboardManager {
    private readonly api: ApiService;
    private graficos: any[] = [];
    private metasSetor: Record<string, number> = {};
    private esteiras: Esteira[] = [];
    private ultimosDados: LinhaDashboard[] = [];
    private requisicaoAtual: number = 0;

    constructor(api: ApiService) {
        this.api = api;
        ['filtro-ano', 'filtro-mes', 'filtro-esteira'].forEach(id =>
            elemento(id)?.addEventListener('change', () => { void this.atualizarDashboard(); }));
        elemento('filtro-visao')?.addEventListener('change', () => this.renderizar());
        elemento('btn-limpar-filtros')?.addEventListener('click', () => this.limparFiltros());
        window.addEventListener('nexus:tema', () => this.renderizar());
    }

    // ---------- dados de apoio ----------
    public definirSetores(setores: Setor[]): void {
        this.metasSetor = {};
        setores.forEach(s => { this.metasSetor[s.nome] = Number(s.meta_percentual); });
    }

    public definirEsteiras(esteiras: Esteira[]): void {
        this.esteiras = esteiras;
        const select = elemento<HTMLSelectElement>('filtro-esteira');
        if (!select) return;
        const atual = select.value;
        select.innerHTML = '';
        select.appendChild(criarOption('todas', 'Visão Global (Todas)'));
        esteiras.forEach(e => select.appendChild(criarOption(String(e.id_esteira), `${e.nome_descricao} (${e.codigo_patrimonio})`)));
        if (esteiras.some(e => String(e.id_esteira) === atual)) select.value = atual;
    }

    public async carregarAnos(): Promise<void> {
        const anos = await this.api.getAnos();
        const select = elementoObrigatorio<HTMLSelectElement>('filtro-ano');
        const atual = new Date().getFullYear();
        const lista = anos.length > 0 ? anos : [atual];
        select.innerHTML = '';
        lista.forEach(a => select.appendChild(criarOption(String(a), String(a))));
        select.value = String(lista.includes(atual) ? atual : Math.max(...lista));
    }

    private limparFiltros(): void {
        elementoObrigatorio<HTMLSelectElement>('filtro-mes').value = 'todos';
        elementoObrigatorio<HTMLSelectElement>('filtro-visao').value = 'geral';
        elementoObrigatorio<HTMLSelectElement>('filtro-esteira').value = 'todas';
        void this.atualizarDashboard();
    }

    private obterFiltros(): Filtros {
        return {
            ano: Number(elementoObrigatorio<HTMLSelectElement>('filtro-ano').value),
            periodo: obterPeriodo(elementoObrigatorio<HTMLSelectElement>('filtro-mes').value),
            visao: elementoObrigatorio<HTMLSelectElement>('filtro-visao').value,
            esteira: elementoObrigatorio<HTMLSelectElement>('filtro-esteira').value
        };
    }

    // ---------- carga e renderização ----------
    public async atualizarDashboard(): Promise<void> {
        const filtros = this.obterFiltros();
        const id = ++this.requisicaoAtual;
        elemento('dashboard')?.classList.add('carregando');
        try {
            const dados = await this.api.getDashboard(filtros.ano, filtros.periodo.inicio, filtros.periodo.fim, filtros.esteira);
            if (id !== this.requisicaoAtual) return; // chegou uma requisição mais nova
            this.ultimosDados = dados;
            this.renderizar();
        } catch (e) {
            if (id === this.requisicaoAtual) mostrarErro(e);
        } finally {
            if (id === this.requisicaoAtual) elemento('dashboard')?.classList.remove('carregando');
        }
    }

    public renderizar(): void {
        const grid = elementoObrigatorio('dashboard-grid');
        const kpis = elementoObrigatorio('kpi-grid');
        this.graficos.forEach(g => g.destroy());
        this.graficos = [];
        grid.innerHTML = '';
        kpis.innerHTML = '';
        this.aplicarTemaGraficos();

        const filtros = this.obterFiltros();
        const individual = filtros.esteira !== 'todas';
        elementoObrigatorio<HTMLSelectElement>('filtro-visao').disabled = individual;

        const dados = this.ultimosDados;
        this.gerarRelatorio(dados, individual);

        if (dados.length === 0) {
            grid.innerHTML = '<div class="card estado-vazio span-total"><i class="fas fa-inbox"></i><p>Nenhum apontamento encontrado para os filtros selecionados.</p></div>';
            return;
        }

        this.renderizarKpis(dados, kpis);
        if (individual) this.renderizarVisaoEsteira(dados, grid);
        else this.renderizarVisaoGeral(dados, filtros, grid);
    }

    private aplicarTemaGraficos(): void {
        const css = getComputedStyle(document.body);
        Chart.defaults.color = css.getPropertyValue('--text-muted').trim();
        Chart.defaults.borderColor = css.getPropertyValue('--border-color').trim();
        Chart.defaults.font.family = "'Inter', sans-serif";
    }

    private corTexto(): string {
        return getComputedStyle(document.body).getPropertyValue('--text-main').trim() || '#1e293b';
    }

    // ---------- cálculos ----------
    private metaDe(linhas: LinhaDashboard[]): number {
        const total = linhas.reduce((s, l) => s + l.horas_ronda, 0);
        if (total === 0) return META_PADRAO;
        return linhas.reduce((s, l) => s + (this.metasSetor[l.setor] ?? META_PADRAO) * l.horas_ronda, 0) / total;
    }

    private agrupar(linhas: LinhaDashboard[], modo: 'mes' | 'esteira' | 'setor'): Agregado[] {
        const mapa = new Map<string, Agregado>();
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
    private renderizarKpis(dados: LinhaDashboard[], container: HTMLElement): void {
        const t = totalizar(dados);
        const prod = produtividade(t);
        const meta = this.metaDe(dados);
        const delta = prod - meta;
        const esteirasAtivas = new Set(dados.map(d => d.id_esteira)).size;

        const kpi = (classe: string, icone: string, titulo: string, valor: string, detalhe: string): string => `
            <div class="kpi-card ${classe}">
                <div class="kpi-icone"><i class="${icone}"></i></div>
                <div><div class="kpi-title">${titulo}</div><div class="kpi-valor">${valor}</div><div class="kpi-detalhe">${detalhe}</div></div>
            </div>`;

        container.innerHTML =
            kpi(delta >= 0 ? 'kpi-ok' : 'kpi-falha', 'fas fa-bullseye', 'Produtividade Geral', formatarPercentual(prod),
                `Meta ${formatarPercentual(meta)} · ${delta >= 0 ? '+' : ''}${formatarNumero(delta)} p.p.`) +
            kpi('kpi-neutro', 'fas fa-clock', 'Horas Operadas', `${formatarNumero(t.horas_ronda, 0)} h`, `${esteirasAtivas} esteiras ativas`) +
            kpi('kpi-improdutivas', 'fas fa-hourglass-half', 'Improdutivas', formatarPercentual(percentual(t.horas_improdutivas, t.horas_ronda)), `${formatarNumero(t.horas_improdutivas, 0)} h`) +
            kpi('kpi-reparo', 'fas fa-screwdriver-wrench', 'Reparo', formatarPercentual(percentual(t.horas_reparo, t.horas_ronda)), `${formatarNumero(t.horas_reparo, 0)} h`) +
            kpi('kpi-flutuantes', 'fas fa-wave-square', 'Flutuantes', formatarPercentual(percentual(t.horas_flutuantes, t.horas_ronda)), `${formatarNumero(t.horas_flutuantes, 0)} h`);
    }

    // ---------- visões ----------
    private renderizarVisaoGeral(dados: LinhaDashboard[], filtros: Filtros, grid: HTMLElement): void {
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
            if (dSetor.length === 0) return;

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

    private renderizarVisaoEsteira(dados: LinhaDashboard[], grid: HTMLElement): void {
        const primeiro = dados[0];
        if (!primeiro) return;
        const meta = this.metaDe(dados);
        const setores = Array.from(new Set(dados.map(d => d.setor))).join(', ');
        const porMes = this.agrupar(dados, 'mes').sort((a, b) => a.mes - b.mes);
        this.graficoCombinado(grid, `Análise Temporal — ${primeiro.nome_esteira}`, `Setor: ${setores} · Meta ${formatarPercentual(meta)}`, porMes, porMes.map(() => meta), true);
    }

    // ---------- gráficos ----------
    private criarCard(grid: HTMLElement, titulo: string, subtitulo: string, largo: boolean, extra: string = ''): CanvasRenderingContext2D | null {
        const card = document.createElement('div');
        card.className = `card chart-card${largo ? ' span-total' : ''}`;
        card.innerHTML = `
            <div class="chart-header"><div><h4>${escapeHtml(titulo)}</h4><p class="chart-subtitle">${escapeHtml(subtitulo)}</p></div>${extra}</div>
            <div class="canvas-container"><canvas></canvas></div>`;
        grid.appendChild(card);
        return card.querySelector('canvas')?.getContext('2d') ?? null;
    }

    private graficoCombinado(grid: HTMLElement, titulo: string, subtitulo: string, dados: Agregado[], metas: number[], largo: boolean, extra: string = ''): void {
        const ctx = this.criarCard(grid, titulo, subtitulo, largo, extra);
        if (!ctx) return;

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
                    tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${formatarNumero(c.parsed.y)}${c.dataset.yAxisID === 'y1' ? '%' : ' h'}` } }
                }
            }
        }));
    }

    private graficoSetores(grid: HTMLElement, porSetor: Agregado[]): void {
        const ctx = this.criarCard(grid, 'Produtividade por Setor vs Meta', 'Verde: meta atingida · Vermelho: abaixo da meta', false);
        if (!ctx) return;
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
                    tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${formatarNumero(c.parsed.y)}%` } }
                }
            }
        }));
    }

    // ---------- relatório ----------
    private rankingCausas(t: Horas) {
        return [
            { titulo: 'Horas improdutivas', acao: 'Reforçar o treinamento operacional e auditar o setup das máquinas.', horas: t.horas_improdutivas },
            { titulo: 'Horas de reparo', acao: 'Revisar o cronograma de manutenção preventiva com a equipe técnica.', horas: t.horas_reparo },
            { titulo: 'Horas flutuantes', acao: 'Acionar logística/PCP e alinhar o suprimento de material.', horas: t.horas_flutuantes }
        ].map(c => ({ ...c, pct: percentual(c.horas, t.horas_ronda) })).sort((a, b) => b.horas - a.horas);
    }

    private gerarRelatorio(dados: LinhaDashboard[], individual: boolean): void {
        const corpo = elemento('report-body');
        if (!corpo) return;
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

        if (!individual) html += this.tabelaSetores(dados) + this.tabelaCriticas(dados);

        const plano = this.rankingCausas(total)
            .map(c => `<li><b>${c.titulo} (${formatarPercentual(c.pct)} das horas operadas):</b> ${c.acao}</li>`).join('');
        html += `<div class="insight-card positive"><div class="insight-title">🛠️ Plano de Ação (priorizado pelo maior impacto)</div><ul class="action-list">${plano}</ul></div>`;
        corpo.innerHTML = html;
    }

    private tabelaSetores(dados: LinhaDashboard[]): string {
        const linhas = Object.keys(this.metasSetor).map(nome => {
            const d = dados.filter(x => x.setor === nome);
            if (d.length === 0) return '';
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

    private tabelaCriticas(dados: LinhaDashboard[]): string {
        const piores = this.agrupar(dados, 'esteira').filter(e => e.horas_ronda > 0).sort((a, b) => a.prodPura - b.prodPura).slice(0, 5);
        const linhas = piores.map(e => `<tr><td>${escapeHtml(e.nome_esteira)}</td><td>${escapeHtml(e.setor)}</td><td class="text-danger">${formatarPercentual(e.prodPura)}</td><td>${this.metasSetor[e.setor] ?? META_PADRAO}%</td></tr>`).join('');
        return `<div class="insight-card negative"><div class="insight-title">⚠️ 5 Esteiras Mais Críticas</div>
            <div class="table-responsive"><table class="data-table"><thead><tr><th>Esteira</th><th>Setor</th><th>Produtividade</th><th>Meta do setor</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
    }
}

// ============================================================
// 7. TABELA GERENCIÁVEL 
// ============================================================
interface OpcoesTabela<T> {
    corpoId: string;
    contadorId: string;
    paginacaoId: string;
    buscaId: string;
    colunas: Array<(item: T) => string>;
    textoBusca: (item: T) => string;
    rotuloVazio: string;
    aoExcluir: (item: T) => void;
    filtroExtra?: (item: T) => boolean;
}

class TabelaGerenciavel<T> {
    private readonly opcoes: OpcoesTabela<T>;
    private itens: T[] = [];
    private pagina: number = 1;

    constructor(opcoes: OpcoesTabela<T>) {
        this.opcoes = opcoes;
        elemento<HTMLInputElement>(opcoes.buscaId)?.addEventListener('input', debounce(() => this.reiniciar(), 200));
    }

    public definirItens(itens: T[]): void {
        this.itens = itens;
        this.renderizar();
    }

    public reiniciar(): void {
        this.pagina = 1;
        this.renderizar();
    }

    private filtrar(): T[] {
        const termo = (elemento<HTMLInputElement>(this.opcoes.buscaId)?.value ?? '').trim().toLowerCase();
        const extra = this.opcoes.filtroExtra;
        return this.itens.filter(i =>
            (termo === '' || this.opcoes.textoBusca(i).toLowerCase().includes(termo)) && (!extra || extra(i)));
    }

    public renderizar(): void {
        const corpo = elemento(this.opcoes.corpoId);
        if (!corpo) return;

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
        if (contador) contador.textContent = `${filtrados.length} de ${this.itens.length}`;
        this.renderizarPaginacao(totalPaginas);
    }

    private renderizarPaginacao(totalPaginas: number): void {
        const container = elemento(this.opcoes.paginacaoId);
        if (!container) return;
        container.innerHTML = '';

        const botao = (texto: string, destino: number, desabilitado: boolean): HTMLButtonElement => {
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
// 8. CADASTROS 
// ============================================================
class CadastroManager {
    private readonly api: ApiService;
    private readonly dashboard: DashboardManager;
    private readonly tabelaFuncionarios: TabelaGerenciavel<Funcionario>;
    private readonly tabelaEsteiras: TabelaGerenciavel<Esteira>;
    private setores: Setor[] = [];
    private funcionarios: Funcionario[] = [];
    private esteiras: Esteira[] = [];

    constructor(api: ApiService, dashboard: DashboardManager) {
        this.api = api;
        this.dashboard = dashboard;

        this.tabelaFuncionarios = new TabelaGerenciavel<Funcionario>({
            corpoId: 'func-corpo', contadorId: 'func-contador', paginacaoId: 'func-paginacao', buscaId: 'busca-func',
            colunas: [f => f.codigo_matricula, f => f.nome, f => f.setor, f => f.cargo],
            textoBusca: f => `${f.nome} ${f.codigo_matricula} ${f.cargo}`,
            rotuloVazio: 'Nenhum funcionário encontrado.',
            aoExcluir: f => { void this.excluirFuncionario(f); },
            filtroExtra: f => {
                const setor = elemento<HTMLSelectElement>('filtro-func-setor')?.value ?? '';
                return setor === '' || f.setor === setor;
            }
        });

        this.tabelaEsteiras = new TabelaGerenciavel<Esteira>({
            corpoId: 'est-corpo', contadorId: 'est-contador', paginacaoId: 'est-paginacao', buscaId: 'busca-est',
            colunas: [e => e.codigo_patrimonio, e => e.nome_descricao],
            textoBusca: e => `${e.codigo_patrimonio} ${e.nome_descricao}`,
            rotuloVazio: 'Nenhuma esteira encontrada.',
            aoExcluir: e => { void this.excluirEsteira(e); }
        });

        elemento('filtro-func-setor')?.addEventListener('change', () => this.tabelaFuncionarios.reiniciar());
        this.iniciarFormularios();
    }

    public async carregarDadosIniciais(): Promise<void> {
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

    private async recarregarFuncionarios(): Promise<void> {
        this.funcionarios = await this.api.getFuncionarios();
        this.atualizarSelects();
        this.tabelaFuncionarios.definirItens(this.funcionarios);
    }

    private async recarregarEsteiras(): Promise<void> {
        this.esteiras = await this.api.getEsteiras();
        this.dashboard.definirEsteiras(this.esteiras);
        this.atualizarSelects();
        this.tabelaEsteiras.definirItens(this.esteiras);
    }

    private atualizarSelects(): void {
        const selFuncionario = elemento<HTMLSelectElement>('ap-operador');
        if (selFuncionario) {
            selFuncionario.innerHTML = '';
            selFuncionario.appendChild(criarOption('', 'Selecione um funcionário...'));
            const grupos = new Map<string, HTMLOptGroupElement>();
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

        const selEsteira = elemento<HTMLSelectElement>('ap-esteira');
        if (selEsteira) {
            selEsteira.innerHTML = '';
            selEsteira.appendChild(criarOption('', 'Selecione uma esteira...'));
            this.esteiras.forEach(e => selEsteira.appendChild(criarOption(String(e.id_esteira), `${e.nome_descricao} (${e.codigo_patrimonio})`)));
        }

        const selCadastro = elemento<HTMLSelectElement>('cad-op-setor');
        if (selCadastro) {
            const atual = selCadastro.value;
            selCadastro.innerHTML = '';
            this.setores.forEach(s => selCadastro.appendChild(criarOption(s.nome, s.nome)));
            if (this.setores.some(s => s.nome === atual)) selCadastro.value = atual;
        }

        const selFiltro = elemento<HTMLSelectElement>('filtro-func-setor');
        if (selFiltro) {
            const atual = selFiltro.value;
            selFiltro.innerHTML = '';
            selFiltro.appendChild(criarOption('', 'Todos os setores'));
            this.setores.forEach(s => selFiltro.appendChild(criarOption(s.nome, s.nome)));
            if (this.setores.some(s => s.nome === atual)) selFiltro.value = atual;
        }
    }

    // ---------- exclusão ----------
    private async confirmarExclusao(
        descricao: string,
        executar: (forcar: boolean) => Promise<unknown>,
        avisoVinculos: (qtd: number) => string
    ): Promise<boolean> {
        const primeira = await Swal.fire({
            title: 'Confirmar exclusão',
            html: `Deseja realmente excluir <b>${escapeHtml(descricao)}</b>?`,
            icon: 'warning', showCancelButton: true, reverseButtons: true,
            confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444'
        });
        if (!primeira.isConfirmed) return false;

        try {
            await executar(false);
            return true;
        } catch (e) {
            const vinculos = e instanceof ApiError ? e.dados['vinculos'] : undefined;
            if (e instanceof ApiError && e.status === 409 && typeof vinculos === 'number') {
                const segunda = await Swal.fire({
                    title: 'Existem registros vinculados',
                    html: avisoVinculos(vinculos),
                    icon: 'warning', showCancelButton: true, reverseButtons: true,
                    confirmButtonText: 'Excluir tudo', cancelButtonText: 'Cancelar', confirmButtonColor: '#ef4444'
                });
                if (!segunda.isConfirmed) return false;
                await executar(true);
                return true;
            }
            throw e;
        }
    }

    private async excluirFuncionario(f: Funcionario): Promise<void> {
        try {
            const excluido = await this.confirmarExclusao(
                `${f.nome} (matrícula ${f.codigo_matricula})`,
                forcar => this.api.excluirFuncionario(f.id_funcionario, forcar),
                qtd => `Este funcionário possui <b>${qtd}</b> apontamento(s). Continuar apagará também todo o histórico dele.`
            );
            if (!excluido) return;
            await this.recarregarFuncionarios();
            notificar('Funcionário excluído.');
            await this.dashboard.atualizarDashboard();
        } catch (e) {
            mostrarErro(e);
        }
    }

    private async excluirEsteira(esteira: Esteira): Promise<void> {
        try {
            const excluido = await this.confirmarExclusao(
                `${esteira.nome_descricao} (${esteira.codigo_patrimonio})`,
                forcar => this.api.excluirEsteira(esteira.id_esteira, forcar),
                qtd => `Esta esteira está vinculada a <b>${qtd}</b> registro(s) de apontamento. Continuar removerá esses vínculos e as horas dela sairão do dashboard.`
            );
            if (!excluido) return;
            await this.recarregarEsteiras();
            notificar('Esteira excluída.');
            await this.dashboard.atualizarDashboard();
        } catch (e) {
            mostrarErro(e);
        }
    }

    // ---------- formulários ----------
    private iniciarFormularios(): void {
        elemento<HTMLFormElement>('form-esteira')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            try {
                await this.api.criarEsteira(
                    elementoObrigatorio<HTMLInputElement>('cad-codigo').value.trim().toUpperCase(),
                    elementoObrigatorio<HTMLInputElement>('cad-descricao').value.trim()
                );
                await this.recarregarEsteiras();
                notificar('Esteira cadastrada.');
                form.reset();
            } catch (err) { mostrarErro(err); }
        });

        elemento<HTMLFormElement>('form-operador')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const nome = elementoObrigatorio<HTMLInputElement>('cad-op-nome').value.trim();
            try {
                await this.api.criarFuncionario(
                    elementoObrigatorio<HTMLInputElement>('cad-op-cracha').value.trim(),
                    elementoObrigatorio<HTMLSelectElement>('cad-op-setor').value,
                    nome,
                    elementoObrigatorio<HTMLInputElement>('cad-op-cargo').value.trim()
                );
                await this.recarregarFuncionarios();
                notificar(`Funcionário ${nome} cadastrado.`);
                form.reset();
            } catch (err) { mostrarErro(err); }
        });

        elemento<HTMLFormElement>('form-apontamento')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const dados: NovoApontamento = {
                id_funcionario: parseInt(elementoObrigatorio<HTMLSelectElement>('ap-operador').value),
                id_esteira: parseInt(elementoObrigatorio<HTMLSelectElement>('ap-esteira').value),
                data_registro: elementoObrigatorio<HTMLInputElement>('ap-data').value,
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
                    .forEach(id => { const el = elemento<HTMLInputElement>(id); if (el) el.value = ''; });
                await this.dashboard.atualizarDashboard();
            } catch (err) { mostrarErro(err); }
        });

        elemento<HTMLFormElement>('form-perfil')?.addEventListener('submit', (e: Event) => {
            e.preventDefault();
            notificar('Perfil atualizado.');
        });
    }
}

// ============================================================
// 9. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const data = elemento<HTMLInputElement>('ap-data');
    if (data) data.value = hojeISO();

    new ThemeManager();
    new UIManager();

    const api = new ApiService();
    const dashboard = new DashboardManager(api);
    const cadastros = new CadastroManager(api, dashboard);

    try {
        await Promise.all([cadastros.carregarDadosIniciais(), dashboard.carregarAnos()]);
        await dashboard.atualizarDashboard();
    } catch (e) {
        mostrarErro(e);
    }
});