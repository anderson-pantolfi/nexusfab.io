declare const Chart: any;
declare const Swal: any;

// ============================================================
// 1. INFRAESTRUTURA (único valor fixo: o endereço da API)
// ============================================================
const API_URL: string = 'http://localhost/nexusfab/src/php/api.php';

// ============================================================
// 2. TIPOS
// ============================================================
type ValorConfig = number | string | boolean;

interface Configuracao {
    chave: string;
    valor: ValorConfig;
    tipo: 'numero' | 'texto' | 'booleano';
    titulo: string;
    descricao: string;
    editavel: boolean;
    minimo: number | null;
    maximo: number | null;
}

interface CategoriaHora {
    chave: string;
    rotulo: string;
    rotulo_longo: string;
    cor: string;
    icone: string;
    acao: string | null;
    perda: boolean;
}

interface Periodo {
    codigo: string;
    rotulo: string;
    rotulo_curto: string | null;
    mes_inicio: number;
    mes_fim: number;
}

interface Visao {
    codigo: string;
    rotulo: string;
    descricao_curta: string;
    ordenacao: 'volume' | 'produtividade_asc';
}

interface Aba {
    codigo: string;
    rotulo_menu: string;
    titulo: string;
    subtitulo: string;
    icone: string;
    posicao: 'menu' | 'perfil';
}

interface Usuario { nome: string; apelido: string; email: string; avatar_url: string; tema: string; }
interface Notificacao { id_notificacao: number; mensagem: string; icone: string; lida: boolean; }

interface Inicializacao {
    configuracoes: Configuracao[];
    categorias: CategoriaHora[];
    periodos: Periodo[];
    visoes: Visao[];
    abas: Aba[];
    usuario: Usuario | null;
    notificacoes: Notificacao[];
}

interface Setor { id_setor: number; nome: string; meta_percentual: number | string; total_funcionarios: number; }

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
interface Filtros { ano: number; periodo: Periodo; visao: string; esteira: string; }

// ============================================================
// 3. DADOS VINDOS DO BANCO (preenchidos em /inicializacao)
// ============================================================
const App: {
    configuracoes: Configuracao[];
    categorias: CategoriaHora[];
    periodos: Periodo[];
    visoes: Visao[];
} = { configuracoes: [], categorias: [], periodos: [], visoes: [] };

function configuracao(chave: string): Configuracao {
    const cfg = App.configuracoes.find(c => c.chave === chave);
    if (!cfg) throw new Error(`Configuração "${chave}" não encontrada no banco de dados.`);
    return cfg;
}
const cfgNumero = (chave: string): number => Number(configuracao(chave).valor);
const cfgTexto = (chave: string): string => String(configuracao(chave).valor);
const metaPadrao = (): number => cfgNumero('meta_padrao');

function nomeMes(mes: number, curto: boolean = false): string {
    const periodo = App.periodos.find(p => p.codigo === String(mes));
    return (curto ? periodo?.rotulo_curto : periodo?.rotulo) ?? `Mês ${mes}`;
}

function obterPeriodo(codigo: string): Periodo {
    const periodo = App.periodos.find(p => p.codigo === codigo);
    if (!periodo) throw new Error(`Período "${codigo}" não encontrado no banco de dados.`);
    return periodo;
}

function horasDe(h: Horas, chave: string): number {
    return (h as unknown as Record<string, number>)[`horas_${chave}`] ?? 0;
}

// ============================================================
// 4. UTILITÁRIOS
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

const formatarPercentual = (valor: number): string => `${formatarNumero(valor)}%`;
const percentual = (parte: number, total: number): number => (total > 0 ? (parte / total) * 100 : 0);

/** Minúsculas e sem acentos, para buscas que ignoram "João" vs "joao". */
const normalizarTexto = (texto: string): string =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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

const lerNumero = (id: string): number => parseFloat(elementoObrigatorio<HTMLInputElement>(id).value);

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

const produtividade = (h: Horas): number => percentual(h.horas_produtivas, h.horas_ronda);

// ============================================================
// 5. API
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
        try { dados = await resposta.json(); } catch { /* resposta sem JSON */ }

        if (!resposta.ok) {
            const erro = dados['erro'];
            const detalhe = dados['detalhe'];
            const base = typeof erro === 'string' ? erro : `Falha na requisição (${resposta.status}).`;
            throw new ApiError(typeof detalhe === 'string' ? `${base} (${detalhe})` : base, resposta.status, dados);
        }
        return dados as unknown as T;
    }

    public getInicializacao(): Promise<Inicializacao> { return this.request<Inicializacao>('inicializacao'); }
    public getSetores(): Promise<Setor[]> { return this.request<Setor[]>('setores'); }

    public criarSetor(nome: string, meta_percentual: number): Promise<{ id_setor: number }> {
        return this.request<{ id_setor: number }>('setores', 'POST', {}, { nome, meta_percentual });
    }

    public excluirSetor(id: number): Promise<unknown> {
        return this.request('setores', 'DELETE', { id });
    }
    public getCargos(): Promise<string[]> { return this.request<string[]>('cargos'); }

    public async getAnos(): Promise<number[]> {
        const anos = await this.request<unknown[]>('anos');
        return anos.map(Number);
    }

    public getFuncionarios(): Promise<Funcionario[]> { return this.request<Funcionario[]>('funcionarios'); }

    public criarFuncionario(codigo_matricula: string, setor: string, nome: string, cargo: string): Promise<{ id_funcionario: number }> {
        return this.request<{ id_funcionario: number }>('funcionarios', 'POST', {}, { codigo_matricula, setor, nome, cargo });
    }

    public excluirFuncionario(id: number, forcar: boolean): Promise<unknown> {
        return this.request('funcionarios', 'DELETE', forcar ? { id, forcar: 1 } : { id });
    }

    public getEsteiras(): Promise<Esteira[]> { return this.request<Esteira[]>('esteiras'); }

    public criarEsteira(codigo_patrimonio: string, nome_descricao: string): Promise<{ id_esteira: number }> {
        return this.request<{ id_esteira: number }>('esteiras', 'POST', {}, { codigo_patrimonio, nome_descricao });
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

    public salvarConfiguracao(chave: string, valor: ValorConfig): Promise<{ chave: string; valor: ValorConfig }> {
        return this.request('configuracoes', 'POST', {}, { chave, valor });
    }

    public salvarPerfil(nome: string, email: string): Promise<Usuario> {
        return this.request<Usuario>('perfil', 'POST', {}, { nome, email });
    }

    public salvarTema(tema: string): Promise<unknown> {
        return this.request('tema', 'POST', {}, { tema });
    }
}

// ============================================================
// 6. TEMA, MENUS, PERFIL, NOTIFICAÇÕES E CONFIGURAÇÕES
// ============================================================
class ThemeManager {
    private readonly api: ApiService;

    constructor(api: ApiService, temaInicial: string) {
        this.api = api;
        this.aplicar(temaInicial === 'dark');
        elemento('btn-theme')?.addEventListener('click', () => {
            const escuro = document.body.getAttribute('data-theme') !== 'dark';
            this.aplicar(escuro);
            window.dispatchEvent(new CustomEvent('nexus:tema'));
            this.api.salvarTema(escuro ? 'dark' : 'light').catch(mostrarErro);
        });
    }

    private aplicar(escuro: boolean): void {
        if (escuro) document.body.setAttribute('data-theme', 'dark');
        else document.body.removeAttribute('data-theme');
        const icone = elemento('theme-icon');
        if (icone) icone.className = escuro ? 'fas fa-sun' : 'fas fa-moon';
    }
}

class UIManager {
    private readonly abas: Aba[];

    constructor(abas: Aba[]) {
        this.abas = abas;
        this.montarMenu('menu-lateral', 'menu');
        this.montarMenu('menu-perfil-links', 'perfil');

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

        const primeira = abas.find(a => a.posicao === 'menu');
        if (primeira) this.abrirAba(primeira.codigo);
    }

    private montarMenu(containerId: string, posicao: Aba['posicao']): void {
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
            link.addEventListener('click', (e: Event) => { e.preventDefault(); this.abrirAba(aba.codigo); });
            container.appendChild(link);
        });
    }

    private abrirAba(codigo: string): void {
        document.querySelectorAll('.tab-content, .nav-link').forEach(el => el.classList.remove('active'));
        elemento(codigo)?.classList.add('active');
        document.querySelectorAll(`.nav-link[data-target="${codigo}"]`).forEach(el => el.classList.add('active'));

        const barra = elemento('barra-filtros');
        if (barra) barra.style.display = codigo === 'dashboard' ? 'flex' : 'none';

        const aba = this.abas.find(a => a.codigo === codigo);
        if (aba) {
            const titulo = elemento('topbar-titulo');
            const subtitulo = elemento('topbar-subtitulo');
            if (titulo) titulo.textContent = aba.titulo;
            if (subtitulo) subtitulo.textContent = aba.subtitulo;
        }
        document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
    }
}

class PerfilManager {
    private readonly api: ApiService;
    private usuario: Usuario | null;

    constructor(api: ApiService, usuario: Usuario | null) {
        this.api = api;
        this.usuario = usuario;
        this.renderizar();

        elemento<HTMLFormElement>('form-perfil')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            try {
                this.usuario = await this.api.salvarPerfil(
                    elementoObrigatorio<HTMLInputElement>('perfil-nome').value.trim(),
                    elementoObrigatorio<HTMLInputElement>('perfil-email').value.trim()
                );
                this.renderizar();
                notificar('Perfil atualizado.');
            } catch (err) { mostrarErro(err); }
        });
    }

    private renderizar(): void {
        const u = this.usuario;
        if (!u) return;
        const definirImagem = (id: string) => { const img = elemento<HTMLImageElement>(id); if (img) img.src = u.avatar_url; };
        definirImagem('avatar-topbar');
        definirImagem('perfil-avatar');
        const apelido = elemento('nome-topbar');
        if (apelido) apelido.textContent = u.apelido;
        const nome = elemento<HTMLInputElement>('perfil-nome');
        if (nome) nome.value = u.nome;
        const email = elemento<HTMLInputElement>('perfil-email');
        if (email) email.value = u.email;
    }
}

function renderizarNotificacoes(lista: Notificacao[]): void {
    const container = elementoObrigatorio('notif-lista');
    container.innerHTML = '';
    lista.forEach(n => {
        const link = document.createElement('a');
        link.href = '#';
        link.addEventListener('click', (e: Event) => e.preventDefault());
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
    private readonly api: ApiService;

    constructor(api: ApiService) {
        this.api = api;
        this.renderizar();
    }

    private renderizar(): void {
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

    private criarControle(cfg: Configuracao): HTMLElement {
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
        if (cfg.minimo !== null) input.min = String(cfg.minimo);
        if (cfg.maximo !== null) input.max = String(cfg.maximo);
        input.addEventListener('change', () => {
            void this.salvar(cfg, cfg.tipo === 'numero' ? Number(input.value) : input.value.trim());
        });
        return input;
    }

    private async salvar(cfg: Configuracao, valor: ValorConfig): Promise<void> {
        try {
            const resposta = await this.api.salvarConfiguracao(cfg.chave, valor);
            cfg.valor = resposta.valor;
            notificar('Configuração salva.');
            window.dispatchEvent(new CustomEvent('nexus:config'));
        } catch (e) {
            mostrarErro(e);
            this.renderizar();
        }
    }
}

// ============================================================
// 7. DASHBOARD
// ============================================================
class DashboardManager {
    private readonly api: ApiService;
    private graficos: any[] = [];
    private metasSetor: Record<string, number> = {};
    private ultimosDados: LinhaDashboard[] = [];
    private requisicaoAtual: number = 0;

    constructor(api: ApiService) {
        this.api = api;
        ['filtro-ano', 'filtro-mes', 'filtro-esteira'].forEach(id =>
            elemento(id)?.addEventListener('change', () => { void this.atualizarDashboard(); }));
        elemento('filtro-visao')?.addEventListener('change', () => this.renderizar());
        elemento('btn-limpar-filtros')?.addEventListener('click', () => this.limparFiltros());
        window.addEventListener('nexus:tema', () => this.renderizar());
        window.addEventListener('nexus:config', () => this.renderizar());
    }

    // ---------- dados de apoio ----------
    public definirSetores(setores: Setor[]): void {
        this.metasSetor = {};
        setores.forEach(s => { this.metasSetor[s.nome] = Number(s.meta_percentual); });
    }

    public definirEsteiras(esteiras: Esteira[]): void {
        const select = elemento<HTMLSelectElement>('filtro-esteira');
        if (!select) return;
        const atual = select.value;
        select.innerHTML = '';
        select.appendChild(criarOption('todas', 'Visão Global (Todas)'));
        esteiras.forEach(e => select.appendChild(criarOption(String(e.id_esteira), `${e.nome_descricao} (${e.codigo_patrimonio})`)));
        if (esteiras.some(e => String(e.id_esteira) === atual)) select.value = atual;
    }

    public async prepararFiltros(): Promise<void> {
        const periodo = elementoObrigatorio<HTMLSelectElement>('filtro-mes');
        periodo.innerHTML = '';
        App.periodos.forEach(p => periodo.appendChild(criarOption(p.codigo, p.rotulo)));

        const visao = elementoObrigatorio<HTMLSelectElement>('filtro-visao');
        visao.innerHTML = '';
        App.visoes.forEach(v => visao.appendChild(criarOption(v.codigo, v.rotulo)));

        const anos = await this.api.getAnos();
        const atual = new Date().getFullYear();
        const lista = anos.length > 0 ? anos : [atual];
        const select = elementoObrigatorio<HTMLSelectElement>('filtro-ano');
        select.innerHTML = '';
        lista.forEach(a => select.appendChild(criarOption(String(a), String(a))));
        select.value = String(lista.includes(atual) ? atual : Math.max(...lista));
    }

    private limparFiltros(): void {
        ['filtro-mes', 'filtro-visao', 'filtro-esteira'].forEach(id => { elementoObrigatorio<HTMLSelectElement>(id).selectedIndex = 0; });
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
            const dados = await this.api.getDashboard(filtros.ano, filtros.periodo.mes_inicio, filtros.periodo.mes_fim, filtros.esteira);
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
        return getComputedStyle(document.body).getPropertyValue('--text-main').trim();
    }

    private metaDoSetor(setor: string): number {
        return this.metasSetor[setor] ?? metaPadrao();
    }

    // ---------- cálculos ----------
    private metaDe(linhas: LinhaDashboard[]): number {
        const total = linhas.reduce((s, l) => s + l.horas_ronda, 0);
        if (total === 0) return metaPadrao();
        return linhas.reduce((s, l) => s + this.metaDoSetor(l.setor) * l.horas_ronda, 0) / total;
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

        const kpi = (classe: string, icone: string, titulo: string, valor: string, detalhe: string, cor: string = ''): string => `
            <div class="kpi-card ${classe}" ${cor ? `style="border-left-color: ${escapeHtml(cor)};"` : ''}>
                <div class="kpi-icone" ${cor ? `style="color: ${escapeHtml(cor)}; background-color: ${escapeHtml(cor)}1f;"` : ''}><i class="${escapeHtml(icone)}"></i></div>
                <div><div class="kpi-title">${escapeHtml(titulo)}</div><div class="kpi-valor">${valor}</div><div class="kpi-detalhe">${detalhe}</div></div>
            </div>`;

        const perdas = App.categorias.filter(c => c.perda).map(c => {
            const horas = horasDe(t, c.chave);
            return kpi('', c.icone, c.rotulo, formatarPercentual(percentual(horas, t.horas_ronda)), `${formatarNumero(horas, 0)} h`, c.cor);
        }).join('');

        container.innerHTML =
            kpi(delta >= 0 ? 'kpi-ok' : 'kpi-falha', 'fas fa-bullseye', 'Produtividade Geral', formatarPercentual(prod),
                `Meta ${formatarPercentual(meta)} · ${delta >= 0 ? '+' : ''}${formatarNumero(delta)} p.p.`) +
            kpi('kpi-neutro', 'fas fa-clock', 'Horas Operadas', `${formatarNumero(t.horas_ronda, 0)} h`, `${esteirasAtivas} esteiras ativas`) +
            perdas;
    }

    // ---------- visões ----------
    private renderizarVisaoGeral(dados: LinhaDashboard[], filtros: Filtros, grid: HTMLElement): void {
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
            if (dSetor.length === 0) return;

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
                    tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${formatarNumero(c.parsed.y)}${c.dataset.yAxisID === 'y1' ? '%' : ' h'}` } }
                }
            }
        }));
    }

    private graficoSetores(grid: HTMLElement, porSetor: Agregado[]): void {
        const ctx = this.criarCard(grid, 'Produtividade por Setor vs Meta', 'Verde: meta atingida · Vermelho: abaixo da meta', false);
        if (!ctx) return;
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
                    tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${formatarNumero(c.parsed.y)}%` } }
                }
            }
        }));
    }

    // ---------- relatório ----------
    private rankingCausas(t: Horas) {
        return App.categorias.filter(c => c.perda).map(c => {
            const horas = horasDe(t, c.chave);
            return { titulo: c.rotulo_longo, acao: c.acao ?? '', horas, pct: percentual(horas, t.horas_ronda) };
        }).sort((a, b) => b.horas - a.horas);
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
            .map(c => `<li><b>${escapeHtml(c.titulo)} (${formatarPercentual(c.pct)} das horas operadas):</b> ${escapeHtml(c.acao)}</li>`).join('');
        html += `<div class="insight-card positive"><div class="insight-title">🛠️ Plano de Ação (priorizado pelo maior impacto)</div><ul class="action-list">${plano}</ul></div>`;
        corpo.innerHTML = html;
    }

    private tabelaSetores(dados: LinhaDashboard[]): string {
        const linhas = Object.keys(this.metasSetor).map(nome => {
            const d = dados.filter(x => x.setor === nome);
            if (d.length === 0) return '';
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

    private tabelaCriticas(dados: LinhaDashboard[]): string {
        const piores = this.agrupar(dados, 'esteira').filter(e => e.horas_ronda > 0).sort((a, b) => a.prodPura - b.prodPura).slice(0, 5);
        const linhas = piores.map(e => `<tr><td>${escapeHtml(e.nome_esteira)}</td><td>${escapeHtml(e.setor)}</td><td class="text-danger">${formatarPercentual(e.prodPura)}</td><td>${this.metaDoSetor(e.setor)}%</td></tr>`).join('');
        return `<div class="insight-card negative"><div class="insight-title">⚠️ 5 Esteiras Mais Críticas</div>
            <div class="table-responsive"><table class="data-table"><thead><tr><th>Esteira</th><th>Setor</th><th>Produtividade</th><th>Meta do setor</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`;
    }
}

// ============================================================
// 8. TABELA GERENCIÁVEL (busca + paginação + exclusão)
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
    private destaque: ((item: T) => boolean) | null = null;

    constructor(opcoes: OpcoesTabela<T>) {
        this.opcoes = opcoes;
        elemento<HTMLInputElement>(opcoes.buscaId)?.addEventListener('input', debounce(() => this.reiniciar(), 200));
        window.addEventListener('nexus:config', () => this.reiniciar());
    }

    public definirItens(itens: T[]): void {
        this.itens = itens;
        this.renderizar();
    }

    public reiniciar(): void {
        this.pagina = 1;
        this.destaque = null;
        this.renderizar();
    }

    /** Limpa a busca, abre a página do registro e o destaca. */
    public mostrar(predicado: (item: T) => boolean): void {
        const busca = elemento<HTMLInputElement>(this.opcoes.buscaId);
        if (busca) busca.value = '';
        this.destaque = predicado;
        const indice = this.filtrar().findIndex(predicado);
        if (indice >= 0) this.pagina = Math.floor(indice / cfgNumero('itens_por_pagina')) + 1;
        this.renderizar();
    }

    private filtrar(): T[] {
        const palavras = normalizarTexto(elemento<HTMLInputElement>(this.opcoes.buscaId)?.value ?? '').split(/\s+/).filter(p => p !== '');
        const extra = this.opcoes.filtroExtra;
        return this.itens.filter(i => {
            const texto = normalizarTexto(this.opcoes.textoBusca(i));
            return palavras.every(p => texto.includes(p)) && (!extra || extra(i));
        });
    }

    public renderizar(): void {
        const corpo = elemento(this.opcoes.corpoId);
        if (!corpo) return;

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
            if (this.destaque && this.destaque(item)) tr.className = 'linha-destaque';
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

        const botao = (icone: string, destino: number, desabilitado: boolean): HTMLButtonElement => {
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
    private readonly api: ApiService;
    private readonly dashboard: DashboardManager;
    private readonly tabelaFuncionarios: TabelaGerenciavel<Funcionario>;
    private readonly tabelaEsteiras: TabelaGerenciavel<Esteira>;
    private readonly tabelaSetores: TabelaGerenciavel<Setor>;
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

        this.tabelaSetores = new TabelaGerenciavel<Setor>({
            corpoId: 'set-corpo', contadorId: 'set-contador', paginacaoId: 'set-paginacao', buscaId: 'busca-set',
            colunas: [s => s.nome, s => `${formatarNumero(Number(s.meta_percentual))}%`, s => String(s.total_funcionarios)],
            textoBusca: s => s.nome,
            rotuloVazio: 'Nenhum setor encontrado.',
            aoExcluir: s => { void this.excluirSetor(s); }
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
        this.tabelaSetores.definirItens(setores);
        await this.carregarCargos();
        this.aplicarCargoPadrao();
        this.aplicarMetaPadraoSetor();
    }

    private async carregarCargos(): Promise<void> {
        const lista = elemento('lista-cargos');
        if (!lista) return;
        lista.innerHTML = '';
        (await this.api.getCargos()).forEach(cargo => lista.appendChild(criarOption(cargo, cargo)));
    }

    private aplicarCargoPadrao(): void {
        const campo = elemento<HTMLInputElement>('cad-op-cargo');
        if (campo) campo.value = cfgTexto('cargo_padrao');
    }

    private aplicarMetaPadraoSetor(): void {
        const campo = elemento<HTMLInputElement>('cad-setor-meta');
        if (campo) campo.value = String(metaPadrao());
    }

    /** Recarrega os setores e propaga para metas, selects, tabelas e gráficos. */
    private async recarregarSetores(redesenharDashboard: boolean): Promise<void> {
        this.setores = await this.api.getSetores();
        this.dashboard.definirSetores(this.setores);
        this.atualizarSelects();
        this.tabelaSetores.definirItens(this.setores);
        if (redesenharDashboard) this.dashboard.renderizar();
    }

    private async recarregarFuncionarios(): Promise<void> {
        this.funcionarios = await this.api.getFuncionarios();
        this.atualizarSelects();
        this.tabelaFuncionarios.definirItens(this.funcionarios);
        await this.carregarCargos();
        await this.recarregarSetores(false); // atualiza a contagem de funcionários por setor
    }

    private async recarregarEsteiras(): Promise<void> {
        this.esteiras = await this.api.getEsteiras();
        this.dashboard.definirEsteiras(this.esteiras);
        this.atualizarSelects();
        this.tabelaEsteiras.definirItens(this.esteiras);
    }

    private atualizarSelects(): void {
        this.renderizarOpcoesFuncionario();

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

    // ---------- busca de funcionário no apontamento ----------
    private funcionariosFiltrados(): Funcionario[] {
        const palavras = normalizarTexto(elemento<HTMLInputElement>('ap-busca-func')?.value ?? '').split(/\s+/).filter(p => p !== '');
        return this.funcionarios.filter(f => {
            const texto = normalizarTexto(`${f.nome} ${f.codigo_matricula}`);
            return palavras.every(p => texto.includes(p));
        });
    }

    private renderizarOpcoesFuncionario(): void {
        const select = elemento<HTMLSelectElement>('ap-operador');
        if (!select) return;
        const buscando = (elemento<HTMLInputElement>('ap-busca-func')?.value ?? '').trim() !== '';
        const anterior = select.value;
        const encontrados = this.funcionariosFiltrados();

        select.innerHTML = '';
        select.appendChild(criarOption('', 'Selecione um funcionário...'));
        const grupos = new Map<string, HTMLOptGroupElement>();
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
        if (encontrados.some(f => String(f.id_funcionario) === anterior)) select.value = anterior;
        else if (buscando && unico) select.value = String(unico.id_funcionario);

        const info = elemento('ap-busca-info');
        if (info) info.textContent = buscando ? `${encontrados.length} encontrado(s) de ${this.funcionarios.length}` : `${this.funcionarios.length} funcionários`;
    }

    // ---------- setores ----------
    private async excluirSetor(setor: Setor): Promise<void> {
        try {
            const confirmacao = await Swal.fire({
                title: 'Confirmar exclusão',
                html: `Deseja realmente excluir o setor <b>${escapeHtml(setor.nome)}</b>?`,
                icon: 'warning', showCancelButton: true, reverseButtons: true,
                confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar', confirmButtonColor: cfgTexto('cor_falha')
            });
            if (!confirmacao.isConfirmed) return;
            await this.api.excluirSetor(setor.id_setor);
            await this.recarregarSetores(true);
            notificar(`Setor ${setor.nome} excluído.`);
        } catch (e) {
            mostrarErro(e); // ex.: setor ainda possui funcionários
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
            confirmButtonText: 'Sim, excluir', cancelButtonText: 'Cancelar', confirmButtonColor: cfgTexto('cor_falha')
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
                    confirmButtonText: 'Excluir tudo', cancelButtonText: 'Cancelar', confirmButtonColor: cfgTexto('cor_falha')
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
        const busca = elemento<HTMLInputElement>('ap-busca-func');
        busca?.addEventListener('input', () => this.renderizarOpcoesFuncionario());
        busca?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            e.preventDefault(); // não envia o formulário; escolhe o primeiro resultado
            const primeiro = this.funcionariosFiltrados()[0];
            const select = elemento<HTMLSelectElement>('ap-operador');
            if (primeiro && select) select.value = String(primeiro.id_funcionario);
        });

        elemento<HTMLFormElement>('form-setor')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const nome = elementoObrigatorio<HTMLInputElement>('cad-setor-nome').value.trim();
            try {
                await this.api.criarSetor(nome, lerNumero('cad-setor-meta'));
                await this.recarregarSetores(true);
                this.tabelaSetores.mostrar(s => s.nome === nome);
                notificar(`Setor ${nome} criado e disponível em todo o sistema.`);
                form.reset();
                this.aplicarMetaPadraoSetor();
            } catch (err) { mostrarErro(err); }
        });
        elemento<HTMLFormElement>('form-esteira')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            try {
                const codigo = elementoObrigatorio<HTMLInputElement>('cad-codigo').value.trim().toUpperCase();
                const gravada = await this.api.criarEsteira(codigo, elementoObrigatorio<HTMLInputElement>('cad-descricao').value.trim());
                await this.recarregarEsteiras();
                this.tabelaEsteiras.mostrar(esteira => esteira.codigo_patrimonio === codigo);
                notificar(`Esteira cadastrada no banco (ID ${gravada.id_esteira}).`);
                form.reset();
            } catch (err) { mostrarErro(err); }
        });

        elemento<HTMLFormElement>('form-operador')?.addEventListener('submit', async (e: Event) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const nome = elementoObrigatorio<HTMLInputElement>('cad-op-nome').value.trim();
            try {
                const matricula = elementoObrigatorio<HTMLInputElement>('cad-op-cracha').value.trim();
                const gravado = await this.api.criarFuncionario(
                    matricula,
                    elementoObrigatorio<HTMLSelectElement>('cad-op-setor').value,
                    nome,
                    elementoObrigatorio<HTMLInputElement>('cad-op-cargo').value.trim()
                );
                await this.recarregarFuncionarios();
                const filtroSetor = elemento<HTMLSelectElement>('filtro-func-setor');
                if (filtroSetor) filtroSetor.value = '';
                this.tabelaFuncionarios.mostrar(f => f.codigo_matricula === matricula);
                notificar(`Funcionário ${nome} cadastrado no banco (ID ${gravado.id_funcionario}).`);
                form.reset();
                this.aplicarCargoPadrao();
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
    }
}

// ============================================================
// 10. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    const api = new ApiService();
    try {
        const inicio = await api.getInicializacao();
        App.configuracoes = inicio.configuracoes;
        App.categorias = inicio.categorias;
        App.periodos = inicio.periodos;
        App.visoes = inicio.visoes;

        document.title = cfgTexto('titulo_pagina');
        elementoObrigatorio('nome-sistema').textContent = cfgTexto('nome_sistema');
        const data = elemento<HTMLInputElement>('ap-data');
        if (data) data.value = hojeISO();

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
    } catch (e) {
        mostrarErro(e);
    }
});