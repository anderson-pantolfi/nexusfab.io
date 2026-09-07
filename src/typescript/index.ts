// --- 1. CONFIGURAÇÕES E INTERFACES ---
const PPH = 50; 
const META_ESTEIRA = 80; 
const metasSetor: Record<string, number> = { "Usinagem CNC": 65, "Montagem Eletrônica": 70, "Sistemas Hidráulicos": 60, "Usinagem de Precisão": 80, "Inspeção de Qualidade": 75 };
const cores = { boas: '#10b981', ineficiencia: '#f59e0b', indiretas: '#8b5cf6', vazias: '#ef4444' };
const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface Maquina { id: string; setor: string; nome: string; }
interface Operador { cracha: string; nome: string; }
interface Apontamento { cracha: string; dataCompleta: string; id: string; nome: string; setor: string; mes: number; hRonda: number; hApontadas: number; hBoas: number; hIneficiencia: number; hVazias: number; hIndiretas: number; }

// --- 2. THEME MANAGER (Gestão do Modo Escuro / Claro) ---
class ThemeManager {
    private readonly THEME_KEY = 'nexus_theme';
    private btnTheme: HTMLElement | null;
    private themeIcon: HTMLElement | null;

    constructor() {
        this.btnTheme = document.getElementById('btn-theme');
        this.themeIcon = document.getElementById('theme-icon');
        this.init();
    }

    private init(): void {
        const savedTheme = localStorage.getItem(this.THEME_KEY);
        if (savedTheme === 'dark') {
            this.setDarkTheme();
        }

        this.btnTheme?.addEventListener('click', () => this.toggleTheme());
    }

    private toggleTheme(): void {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            this.setLightTheme();
        } else {
            this.setDarkTheme();
        }
    }

    private setDarkTheme(): void {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem(this.THEME_KEY, 'dark');
        if (this.themeIcon) {
            this.themeIcon.className = 'fas fa-sun';
        }
    }

    private setLightTheme(): void {
        document.body.removeAttribute('data-theme');
        localStorage.setItem(this.THEME_KEY, 'light');
        if (this.themeIcon) {
            this.themeIcon.className = 'fas fa-moon';
        }
    }
}

// --- 3. UI MANAGER (Gestão de Navegação, Abas e Dropdowns do Cabeçalho) ---
class UIManager {
    constructor() {
        this.initNavigation();
        this.initDropdowns();
    }

    private initNavigation(): void {
        const navLinks = document.querySelectorAll('.nav-link[data-target]');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = (e.currentTarget as HTMLElement).getAttribute('data-target');
                if (!targetId) return;
                
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

        // Fecha os menus ao clicar fora deles
        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.remove('show'));
        });
    }
}

// --- 4. DATABASE SERVICE ---
class DatabaseService {
    public maquinas: Maquina[] = [];
    public operadores: Operador[] = [];
    public apontamentos: Apontamento[] = [];

    constructor() {
        this.gerarMockData();
    }

    private gerarMockData(): void {
        this.operadores.push(
            { cracha: '1001', nome: 'João Silva' },
            { cracha: '1002', nome: 'Maria Santos' },
            { cracha: '1003', nome: 'Carlos Sousa' }
        );

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
                        dataCompleta: `2026-${mes.toString().padStart(2,'0')}-01`,
                        id: idFormatado, nome: `Est. ${idFormatado}`, setor: setor.nome, mes: mes,
                        hRonda, hApontadas, hBoas, hIneficiencia, hVazias, hIndiretas
                    });
                }
            });
        }
    }

    public addMaquina(id: string, setor: string): void {
        this.maquinas.push({ id, setor, nome: `Est. ${id}` });
    }

    public addOperador(cracha: string, nome: string): void {
        this.operadores.push({ cracha, nome });
    }
}

// --- 5. DASHBOARD MANAGER ---
class DashboardManager {
    private graficosAtivos: any[] = [];
    private db: DatabaseService;

    constructor(db: DatabaseService) {
        this.db = db;
        this.bindFiltros();
    }

    private bindFiltros(): void {
        ['filtro-mes', 'filtro-visao', 'filtro-esteira'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.atualizarDashboard());
        });
    }

    public preencherSelectFiltros(): void {
        const selectFiltro = document.getElementById('filtro-esteira') as HTMLSelectElement;
        if (!selectFiltro) return;
        
        selectFiltro.innerHTML = '<option value="todas">Visão Global (Todas)</option>';
        this.db.maquinas.forEach(maq => { 
            selectFiltro.innerHTML += `<option value="${maq.id}">${maq.nome} (${maq.setor})</option>`; 
        });
    }

    private filtrarEAgregarDados(): any[] {
        const mes = (document.getElementById('filtro-mes') as HTMLSelectElement).value;
        const esteira = (document.getElementById('filtro-esteira') as HTMLSelectElement).value;
        
        let filtrados = this.db.apontamentos.filter(d => 
            (mes === 'todos' || d.mes.toString() === mes) && 
            (esteira === 'todas' || d.id === esteira)
        );

        let agregados: any = {};
        
        if (esteira !== 'todas' && mes === 'todos') {
            filtrados.forEach(d => {
                if (!agregados[d.mes]) agregados[d.mes] = { labelExibicao: nomesMeses[d.mes], mes: d.mes, hRonda:0, hApontadas:0, hBoas:0, hIneficiencia:0, hVazias:0, hIndiretas:0, nome: d.nome, setor: d.setor };
                agregados[d.mes].hRonda += d.hRonda; agregados[d.mes].hBoas += d.hBoas; agregados[d.mes].hIneficiencia += d.hIneficiencia; agregados[d.mes].hVazias += d.hVazias; agregados[d.mes].hIndiretas += d.hIndiretas;
            });
            return Object.values(agregados).map((d: any) => ({ ...d, prodPura: (d.hRonda>0) ? (d.hBoas / d.hRonda) * 100 : 0 })).sort((a: any, b: any) => a.mes - b.mes);
        }

        filtrados.forEach(d => {
            if (!agregados[d.id]) agregados[d.id] = { id: d.id, nome: d.nome, setor: d.setor, labelExibicao: d.nome, hRonda:0, hApontadas:0, hBoas:0, hIneficiencia:0, hVazias:0, hIndiretas:0 };
            agregados[d.id].hRonda += d.hRonda; agregados[d.id].hBoas += d.hBoas; agregados[d.id].hIneficiencia += d.hIneficiencia; agregados[d.id].hVazias += d.hVazias; agregados[d.id].hIndiretas += d.hIndiretas;
        });
        return Object.values(agregados).map((d: any) => ({ ...d, prodPura: (d.hRonda>0) ? (d.hBoas / d.hRonda) * 100 : 0 }));
    }

    public atualizarDashboard(): void {
        const dashboard = document.getElementById('dashboard-grid');
        const visao = (document.getElementById('filtro-visao') as HTMLSelectElement).value;
        const esteira = (document.getElementById('filtro-esteira') as HTMLSelectElement).value;
        
        if (!dashboard) return;
        
        this.graficosAtivos.forEach(g => g.destroy()); 
        this.graficosAtivos = []; 
        dashboard.innerHTML = '';
        
        const dados = this.filtrarEAgregarDados();

        if (esteira !== 'todas') {
            (document.getElementById('filtro-visao') as HTMLSelectElement).disabled = true;
            if (dados.length === 0) return;
            let tot = dados.reduce((a, c) => { a.r+=c.hRonda; a.b+=c.hBoas; return a; }, {r:0, b:0});
            this.renderizarCard(`Análise Temporal: ${dados[0].nome}`, dados, (tot.r>0 ? (tot.b/tot.r)*100 : 0), META_ESTEIRA, dashboard);
        } else {
            (document.getElementById('filtro-visao') as HTMLSelectElement).disabled = false;
            Object.keys(metasSetor).forEach(nomeSetor => {
                let dSetor = dados.filter(d => d.setor === nomeSetor);
                if (dSetor.length === 0) return;
                
                visao === 'piores' ? dSetor.sort((a, b) => a.prodPura - b.prodPura) : dSetor.sort((a, b) => b.hRonda - a.hRonda);
                let top10 = dSetor.slice(0, 10);
                let tot = top10.reduce((a, c) => { a.r+=c.hRonda; a.b+=c.hBoas; return a; }, {r:0, b:0});
                
                const metaAtual = metasSetor[nomeSetor] || 0;
                this.renderizarCard(`${nomeSetor} (Meta: ${metaAtual}%)`, top10, (tot.r>0 ? (tot.b/tot.r)*100 : 0), metaAtual, dashboard);
            });
        }
        
        this.gerarRelatorio(dados, esteira !== 'todas');
    }

    private renderizarCard(titulo: string, dados: any[], prodPuraMedia: number, meta: number, container: HTMLElement): void {
        const idx = this.graficosAtivos.length;
        const card = document.createElement('div');
        card.className = `card chart-card`;
        
        card.innerHTML = `
            <div class="chart-header"><h4>${titulo}</h4></div>
            <div class="kpi-container">
                <div class="kpi-box"><div class="kpi-title">Média Atingida</div><div class="kpi-value ${prodPuraMedia >= meta ? 'good' : 'danger'}">${(prodPuraMedia||0).toFixed(1)}%</div></div>
            </div>
            <div class="canvas-container"><canvas id="chart-dyn-${idx}"></canvas></div>`;
        
        container.appendChild(card);

        const canvasEl = document.getElementById(`chart-dyn-${idx}`) as HTMLCanvasElement;
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;

        // @ts-ignore
        const g = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.map(d => d.labelExibicao),
                datasets: [
                    { type: 'line', label: 'Tendência Prod. Pura (%)', data: dados.map(d => d.prodPura), borderColor: '#1e293b', backgroundColor: '#1e293b', yAxisID: 'y1', tension: 0.3, borderWidth: 3, fill: false, order: 1 },
                    { type: 'line', label: 'Meta (%)', data: dados.map(() => meta), borderColor: '#2563eb', borderDash: [5, 5], pointRadius: 0, yAxisID: 'y1', borderWidth: 2, fill: false, order: 0 },
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
                            footer: (tooltipItems: any) => {
                                let d = dados[tooltipItems[0].dataIndex];
                                let varRelativa = d.hRonda > 0 ? ((d.prodPura / meta) - 1) * 100 : 0;
                                let pecasBoas = d.hBoas * PPH;
                                let pecasMeta = (d.hRonda * (meta/100)) * PPH;
                                let delta = Math.round(pecasBoas - pecasMeta);
                                return `\n-- IMPACTO VERSUS META --\nVariação: ${varRelativa > 0 ? '+' : ''}${varRelativa.toFixed(1)}%\nVolume: ${Math.round(pecasBoas)} peças\nDesvio: ${delta > 0 ? '+' : ''}${delta} peças`;
                            }
                        }
                    }
                },
                scales: { x: { stacked: true }, y: { stacked: true, position: 'left' }, y1: { position: 'right', min: 0, max: 100 } } 
            }
        });
        this.graficosAtivos.push(g);
    }

    private gerarRelatorio(dadosTotais: any[], isIndividual: boolean): void {
        const reportBody = document.getElementById('report-body');
        if (!reportBody) return;
        reportBody.innerHTML = '';

        if (dadosTotais.length === 0) {
            reportBody.innerHTML = '<p class="text-muted">Nenhum dado encontrado para os filtros selecionados.</p>';
            return;
        }

        let tot = dadosTotais.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; return a; }, {r:0, b:0});
        let mediaPura = tot.r > 0 ? (tot.b / tot.r) * 100 : 0;

        if (isIndividual) {
            reportBody.innerHTML = `
                <div class="insight-card ${mediaPura >= META_ESTEIRA ? 'positive' : 'negative'}">
                    <div class="insight-title">Análise de Desempenho: ${dadosTotais[0].nome}</div>
                    Produtividade pura média: <b>${mediaPura.toFixed(1)}%</b>. 
                    ${mediaPura < META_ESTEIRA ? '<br><b>Alerta:</b> Abaixo da meta de 80%. Requer atenção.' : '<br><b>Excelente:</b> Dentro ou acima da meta.'}
                </div>`;
            return;
        }

        let htmlSetores = `<div class="insight-card neutral"><div class="insight-title">📊 Análise de Metas por Setor</div><ul class="action-list">`;
        Object.keys(metasSetor).forEach(nomeSetor => {
            let dSetor = dadosTotais.filter(d => d.setor === nomeSetor);
            if (dSetor.length === 0) return;
            
            let sTot = dSetor.reduce((a, c) => { a.r+=c.hRonda; a.b+=c.hBoas; a.i+=c.hIneficiencia; a.v+=c.hVazias; return a; }, {r:0, b:0, i:0, v:0});
            let sMedia = sTot.r > 0 ? (sTot.b / sTot.r) * 100 : 0;
            
            let meta = metasSetor[nomeSetor] || 0;
            
            if (sMedia >= meta) {
                htmlSetores += `<li>✅ <b class="text-success">${nomeSetor}:</b> Atingiu a meta (${sMedia.toFixed(1)}% vs ${meta}%).</li>`;
            } else {
                let causa = sTot.i > sTot.v ? "Alta Ineficiência" : "Alta Ociosidade";
                htmlSetores += `<li>❌ <b class="text-danger">${nomeSetor}:</b> Reprovou (${sMedia.toFixed(1)}% vs ${meta}%). <i>Causa: ${causa}</i></li>`;
            }
        });
        htmlSetores += `</ul></div>`;
        reportBody.innerHTML += htmlSetores;

        reportBody.innerHTML += `
            <div class="insight-card positive">
                <div class="insight-title">🛠️ Plano de Ação Estratégico</div>
                <ul class="action-list">
                    <li><b>Horas Vazias:</b> Acionar logística, PCP ou abrir chamado de manutenção.</li>
                    <li><b>Ineficiência:</b> Foco em Treinamento Operacional ou auditoria no setup da máquina.</li>
                    <li><b>Indiretas:</b> Aplicar 5S no posto e abastecimento contínuo via empilhadeira.</li>
                </ul>
            </div>`;
    }
}

// --- 6. FORM MANAGER  ---
class FormManager {
    private db: DatabaseService;
    private dashboard: DashboardManager;

    constructor(db: DatabaseService, dashboard: DashboardManager) {
        this.db = db;
        this.dashboard = dashboard;
        this.initForms();
        this.atualizarSelects();
    }

    private atualizarSelects(): void {
        const selOp = document.getElementById('ap-operador') as HTMLSelectElement;
        if(selOp) {
            selOp.innerHTML = '<option value="">Selecione um operador...</option>';
            this.db.operadores.forEach(op => selOp.innerHTML += `<option value="${op.cracha}">${op.nome} (Crachá: ${op.cracha})</option>`);
        }

        const selSetor = document.getElementById('ap-setor') as HTMLSelectElement;
        const selEsteira = document.getElementById('ap-esteira') as HTMLSelectElement;
        
        const carregarEsteiras = () => {
            if(!selEsteira || !selSetor) return;
            selEsteira.innerHTML = '';
            let filtradas = this.db.maquinas.filter(m => m.setor === selSetor.value);
            filtradas.forEach(maq => selEsteira.innerHTML += `<option value="${maq.id}">${maq.nome}</option>`);
        };
        
        selSetor?.addEventListener('change', carregarEsteiras);
        carregarEsteiras(); 
    }

    private initForms(): void {
        document.getElementById('form-esteira')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = (document.getElementById('cad-codigo') as HTMLInputElement).value.toUpperCase();
            const setor = (document.getElementById('cad-setor') as HTMLSelectElement).value;
            
            if (this.db.maquinas.some(m => m.id === id)) {
                // @ts-ignore
                Swal.fire('Erro', 'Esteira já cadastrada!', 'error'); return;
            }
            
            this.db.addMaquina(id, setor);
            this.atualizarSelects();
            this.dashboard.preencherSelectFiltros();
            // @ts-ignore
            Swal.fire('Sucesso', 'Máquina adicionada.', 'success');
            (e.target as HTMLFormElement).reset();
        });

        document.getElementById('form-operador')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const cracha = (document.getElementById('cad-op-cracha') as HTMLInputElement).value;
            const nome = (document.getElementById('cad-op-nome') as HTMLInputElement).value;
            
            this.db.addOperador(cracha, nome);
            this.atualizarSelects();
            // @ts-ignore
            Swal.fire('Sucesso', `Operador ${nome} cadastrado!`, 'success');
            (e.target as HTMLFormElement).reset();
        });

        document.getElementById('form-apontamento')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const cracha = (document.getElementById('ap-operador') as HTMLSelectElement).value;
            const dataRaw = (document.getElementById('ap-data') as HTMLInputElement).value;
            const esteira = (document.getElementById('ap-esteira') as HTMLSelectElement).value;
            const setor = (document.getElementById('ap-setor') as HTMLSelectElement).value;
            const hRonda = parseFloat((document.getElementById('ap-ronda') as HTMLInputElement).value);
            const hBoas = parseFloat((document.getElementById('ap-boas') as HTMLInputElement).value);
            const hVazias = parseFloat((document.getElementById('ap-vazias') as HTMLInputElement).value);
            const hIndiretas = parseFloat((document.getElementById('ap-indiretas') as HTMLInputElement).value);

            let hApontadas = hRonda - hVazias - hIndiretas;
            let hIneficiencia = hApontadas - hBoas;

            if (hBoas > hApontadas || hApontadas < 0) {
                // @ts-ignore
                Swal.fire('Erro Matemático', 'Horas Vazias + Indiretas + Boas ultrapassam as Horas Ronda.', 'error'); return;
            }

            const partesData = dataRaw.split('-');
            const mesFormatado = partesData.length > 1 ? parseInt(partesData[1]!) : new Date().getMonth() + 1;

            this.db.apontamentos.push({
                cracha, dataCompleta: dataRaw, id: esteira, nome: `Est. ${esteira}`, setor, 
                mes: mesFormatado, hRonda, hApontadas, hBoas, hIneficiencia, hVazias, hIndiretas
            });

            this.dashboard.atualizarDashboard(); 
            // @ts-ignore
            Swal.fire('Sucesso', 'Apontamento registrado com sucesso!', 'success');
            
            ['ap-ronda', 'ap-boas', 'ap-vazias', 'ap-indiretas'].forEach(id => (document.getElementById(id) as HTMLInputElement).value = '');
        });
    }
}

// --- 7. INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const inputData = document.getElementById('ap-data') as HTMLInputElement;
    if (inputData) inputData.valueAsDate = new Date();

    new ThemeManager();
    new UIManager();
    
    const db = new DatabaseService();
    const dashboard = new DashboardManager(db);
    new FormManager(db, dashboard);

    dashboard.preencherSelectFiltros();
    dashboard.atualizarDashboard(); 
});