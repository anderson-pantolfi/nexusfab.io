        // --- CONFIGURAÇÕES GERAIS ---
        const PPH = 50; // Peças por Hora
        const META_ESTEIRA = 80; // Meta Individual Fixa 80%
        const metasSetor = { "Usinagem CNC": 65, "Montagem Eletrônica": 70, "Sistemas Hidráulicos": 60, "Usinagem de Precisão": 80, "Inspeção de Qualidade": 75 };
        const setoresConfig = [
            { nome: "Usinagem CNC", inicio: 1, fim: 20 }, { nome: "Montagem Eletrônica", inicio: 21, fim: 40 },
            { nome: "Sistemas Hidráulicos", inicio: 41, fim: 60 }, { nome: "Usinagem de Precisão", inicio: 61, fim: 80 },
            { nome: "Inspeção de Qualidade", inicio: 81, fim: 100 }
        ];

        const corBoas = '#2ecc71', corIneficiencia = '#e67e22', corIndiretas = '#9b59b6', corVazias = '#e74c3c';
        const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let bancoDeDados = []; 
        let graficosAtivos = [];
        let listaMáquinas = [];

        window.onload = iniciarSistema;

        function iniciarSistema() {
            gerarBancoDeDados();
            preencherSelectFiltros();
            atualizarSelectEsteirasFormulario();
            atualizarDashboard();
            document.getElementById('ap-data').valueAsDate = new Date();
        }

        function gerarBancoDeDados() {
            for(let mes = 1; mes <= 6; mes++) {
                setoresConfig.forEach(setor => {
                    for(let i = setor.inicio; i <= setor.fim; i++) {
                        let idFormatado = i.toString().padStart(3, '0');
                        if(mes === 1) listaMáquinas.push({id: idFormatado, setor: setor.nome});
                        
                        let hRonda = Math.floor(Math.random() * 60) + 160; 
                        let hVazias = Math.floor(hRonda * (Math.random() * 0.15));
                        let hIndiretas = Math.floor(hRonda * (Math.random() * 0.10));
                        let hApontadas = hRonda - hVazias - hIndiretas;
                        let hBoas = Math.floor(hApontadas * (Math.random() * 0.35 + 0.60));
                        let hIneficiencia = hApontadas - hBoas;

                        bancoDeDados.push({
                            cracha: "SISTEMA", dataCompleta: `2026-${mes.toString().padStart(2,'0')}-01`,
                            id: idFormatado, nome: `Est. ${idFormatado}`, setor: setor.nome, mes: mes,
                            hRonda, hApontadas, hBoas, hIneficiencia, hVazias, hIndiretas
                        });
                    }
                });
            }
        }

        function preencherSelectFiltros() {
            const selectFiltro = document.getElementById('filtro-esteira');
            selectFiltro.innerHTML = '<option value="todas">Visão Global (Todas)</option>';
            listaMáquinas.forEach(maq => { selectFiltro.innerHTML += `<option value="${maq.id}">Est. ${maq.id}</option>`; });
        }

        function atualizarSelectEsteirasFormulario() {
            const setorSelecionado = document.getElementById('ap-setor').value;
            const selectApontamento = document.getElementById('ap-esteira');
            selectApontamento.innerHTML = '';
            let maquinasFiltradas = listaMáquinas.filter(m => m.setor === setorSelecionado);
            maquinasFiltradas.forEach(maq => { selectApontamento.innerHTML += `<option value="${maq.id}">Est. ${maq.id}</option>`; });
        }

        function salvarNovaEsteira() {
            const inputCodigo = document.getElementById('cad-codigo');
            const codigoRaw = inputCodigo.value.trim();
            const setorEscolhido = document.getElementById('cad-setor').value;
            const msgErro = document.getElementById('erro-codigo');
            
            if (!/^\d{1,3}[a-zA-Z]$/.test(codigoRaw)) {
                msgErro.style.display = 'block'; inputCodigo.style.borderColor = '#c0392b'; return;
            }

            let numeros = codigoRaw.match(/\d+/)[0];
            let letra = codigoRaw.match(/[a-zA-Z]/)[0].toUpperCase();
            let idFormatado = numeros.padStart(3, '0') + letra; 

            if (listaMáquinas.some(m => m.id === idFormatado)) { alert("Esteira já cadastrada!"); return; }

            listaMáquinas.push({id: idFormatado, setor: setorEscolhido});
            
            for(let m = 1; m <= 6; m++) {
                bancoDeDados.push({
                    cracha: "SISTEMA", dataCompleta: `2026-${m.toString().padStart(2,'0')}-01`,
                    id: idFormatado, nome: `Est. ${idFormatado}`, setor: setorEscolhido, mes: m,
                    hRonda: 0.1, hApontadas: 0, hBoas: 0, hIneficiencia: 0, hVazias: 0, hIndiretas: 0
                });
            }

            preencherSelectFiltros(); atualizarSelectEsteirasFormulario();
            msgErro.style.display = 'none'; inputCodigo.style.borderColor = '#bdc3c7'; inputCodigo.value = '';
            document.getElementById('sucesso-cad').style.display = 'block';
            setTimeout(() => { document.getElementById('sucesso-cad').style.display = 'none'; }, 3000);
            atualizarDashboard();
        }

        function salvarApontamento() {
            const dataRaw = document.getElementById('ap-data').value;
            const cracha = document.getElementById('ap-cracha').value.trim();
            const setor = document.getElementById('ap-setor').value;
            const esteira = document.getElementById('ap-esteira').value;
            
            const hRonda = parseFloat(document.getElementById('ap-ronda').value) || 0;
            const hBoas = parseFloat(document.getElementById('ap-boas').value) || 0;
            const hVazias = parseFloat(document.getElementById('ap-vazias').value) || 0;
            const hIndiretas = parseFloat(document.getElementById('ap-indiretas').value) || 0;
            const msgErro = document.getElementById('erro-apontamento');
            
            if(!dataRaw || !cracha || hRonda <= 0) {
                msgErro.textContent = "Erro: Preencha Data, Crachá e Horas Ronda (maior que 0).";
                msgErro.style.display = 'block'; return;
            }

            let hApontadas = hRonda - hVazias - hIndiretas;
            let hIneficiencia = hApontadas - hBoas;

            if (hBoas > hApontadas || hApontadas < 0) {
                msgErro.textContent = "Erro Matemático: Horas Vazias + Indiretas + Boas ultrapassam as Horas Ronda.";
                msgErro.style.display = 'block'; return;
            }

            let mesDoApontamento = parseInt(dataRaw.split('-')[1]); 

            bancoDeDados.push({
                cracha: cracha, dataCompleta: dataRaw, id: esteira, nome: `Est. ${esteira}`, setor: setor, mes: mesDoApontamento,
                hRonda, hApontadas, hBoas, hIneficiencia, hVazias, hIndiretas
            });

            let prodPura = ((hBoas / hRonda) * 100).toFixed(1);
            let dataFormatada = dataRaw.split('-').reverse().join('/');
            
            const tbody = document.getElementById('body-historico');
            if(tbody.innerText.includes("Nenhum apontamento")) tbody.innerHTML = '';
            tbody.insertAdjacentHTML('afterbegin', `<tr><td>${dataFormatada}</td><td>${cracha}</td><td>Est. ${esteira}</td><td><b>${prodPura}%</b></td></tr>`);

            msgErro.style.display = 'none';
            document.getElementById('sucesso-apontamento').style.display = 'block';
            setTimeout(() => { document.getElementById('sucesso-apontamento').style.display = 'none'; }, 3000);
            
            ['ap-ronda', 'ap-boas', 'ap-vazias', 'ap-indiretas'].forEach(id => document.getElementById(id).value = '');
            atualizarDashboard();
        }

        function filtrarEAgregarDados() {
            const mes = document.getElementById('filtro-mes').value;
            const esteira = document.getElementById('filtro-esteira').value;
            
            let filtrados = bancoDeDados.filter(d => (mes === 'todos' || d.mes == mes) && (esteira === 'todas' || d.id === esteira));

            if(esteira !== 'todas' && mes === 'todos') {
                let agregadosMes = {};
                filtrados.forEach(d => {
                    if(!agregadosMes[d.mes]) agregadosMes[d.mes] = { labelExibicao: nomesMeses[d.mes], mes: d.mes, hRonda:0, hApontadas:0, hBoas:0, hIneficiencia:0, hVazias:0, hIndiretas:0, nome: d.nome, setor: d.setor };
                    agregadosMes[d.mes].hRonda += d.hRonda; agregadosMes[d.mes].hApontadas += d.hApontadas; agregadosMes[d.mes].hBoas += d.hBoas;
                    agregadosMes[d.mes].hIneficiencia += d.hIneficiencia; agregadosMes[d.mes].hVazias += d.hVazias; agregadosMes[d.mes].hIndiretas += d.hIndiretas;
                });
                return Object.values(agregadosMes).map(d => ({ ...d, prodPura: (d.hRonda>0) ? (d.hBoas / d.hRonda) * 100 : 0 })).sort((a,b)=>a.mes-b.mes);
            }

            let agregados = {};
            filtrados.forEach(d => {
                if(!agregados[d.id]) agregados[d.id] = { id: d.id, nome: d.nome, setor: d.setor, labelExibicao: d.nome, hRonda: 0, hApontadas: 0, hBoas: 0, hIneficiencia: 0, hVazias: 0, hIndiretas: 0 };
                agregados[d.id].hRonda += d.hRonda; agregados[d.id].hApontadas += d.hApontadas; agregados[d.id].hBoas += d.hBoas;
                agregados[d.id].hIneficiencia += d.hIneficiencia; agregados[d.id].hVazias += d.hVazias; agregados[d.id].hIndiretas += d.hIndiretas;
            });
            return Object.values(agregados).map(d => ({ ...d, prodPura: (d.hRonda>0) ? (d.hBoas / d.hRonda) * 100 : 0 }));
        }

        function atualizarDashboard() {
            const dashboard = document.getElementById('dashboard');
            const visao = document.getElementById('filtro-visao').value;
            const esteira = document.getElementById('filtro-esteira').value;
            
            graficosAtivos.forEach(g => g.destroy()); graficosAtivos = []; dashboard.innerHTML = '';
            const dados = filtrarEAgregarDados();

            if (esteira !== 'todas') {
                document.getElementById('filtro-visao').disabled = true;
                if(dados.length === 0) return;
                let tot = dados.reduce((a, c) => { a.r+=c.hRonda; a.b+=c.hBoas; return a; }, {r:0, b:0});
                renderizarCard(`Análise Temporal: ${dados[0].nome} (${dados[0].setor})`, dados, (tot.r>0 ? (tot.b/tot.r)*100 : 0), META_ESTEIRA, true);
            } else {
                document.getElementById('filtro-visao').disabled = false;
                Object.keys(metasSetor).forEach(nomeSetor => {
                    let dSetor = dados.filter(d => d.setor === nomeSetor);
                    if(dSetor.length === 0) return;
                    visao === 'piores' ? dSetor.sort((a, b) => a.prodPura - b.prodPura) : dSetor.sort((a, b) => b.hRonda - a.hRonda);
                    let top10 = dSetor.slice(0, 10);
                    let tot = top10.reduce((a, c) => { a.r+=c.hRonda; a.b+=c.hBoas; return a; }, {r:0, b:0});
                    renderizarCard(`${nomeSetor} (Meta: ${metasSetor[nomeSetor]}%)`, top10, (tot.r>0 ? (tot.b/tot.r)*100 : 0), metasSetor[nomeSetor], false);
                });
            }
            gerarRelatorio(dados, esteira !== 'todas');
        }

        function renderizarCard(titulo, dados, prodPuraMedia, meta, isIndividual) {
            const dash = document.getElementById('dashboard');
            const idx = graficosAtivos.length;
            const card = document.createElement('div');
            card.className = `chart-card ${isIndividual ? 'individual' : ''}`;
            card.innerHTML = `<h2>${titulo}</h2>
                <div class="kpi-container">
                    <div class="kpi-box"><div class="kpi-title">Média Atingida</div><div class="kpi-value ${prodPuraMedia >= meta ? 'good' : 'danger'}">${(prodPuraMedia||0).toFixed(1)}%</div></div>
                </div><div class="canvas-container"><canvas id="chart-${idx}"></canvas></div>`;
            dash.appendChild(card);

            const ctx = document.getElementById(`chart-${idx}`).getContext('2d');
            const g = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: dados.map(d => d.labelExibicao),
                    datasets: [
                        { type: 'line', label: 'Tendência Prod. Pura (%)', data: dados.map(d => d.prodPura), borderColor: '#2c3e50', backgroundColor: '#2c3e50', yAxisID: 'y1', tension: 0.3, borderWidth: 3, fill: false, order: 1 },
                        { type: 'line', label: 'Meta (%)', data: dados.map(() => meta), borderColor: '#3498db', borderDash: [5, 5], pointRadius: 0, yAxisID: 'y1', borderWidth: 2, fill: false, order: 0 },
                        { type: 'bar', label: 'Horas Boas', data: dados.map(d => d.hBoas), backgroundColor: corBoas, yAxisID: 'y', order: 2 },
                        { type: 'bar', label: 'Ineficiência', data: dados.map(d => d.hIneficiencia), backgroundColor: corIneficiencia, yAxisID: 'y', order: 2 },
                        { type: 'bar', label: 'Horas Indiretas', data: dados.map(d => d.hIndiretas), backgroundColor: corIndiretas, yAxisID: 'y', order: 2 },
                        { type: 'bar', label: 'Horas Vazias', data: dados.map(d => d.hVazias), backgroundColor: corVazias, yAxisID: 'y', order: 2 }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                footer: (tooltipItems) => {
                                    let idx = tooltipItems[0].dataIndex;
                                    let d = dados[idx];
                                    // Cálculo de Variação e Peças
                                    let varRelativa = d.hRonda > 0 ? ((d.prodPura / meta) - 1) * 100 : 0;
                                    let pecasBoas = d.hBoas * PPH;
                                    let pecasMeta = (d.hRonda * (meta/100)) * PPH;
                                    let deltaPecas = Math.round(pecasBoas - pecasMeta);
                                    
                                    return `\n--- IMPACTO VERSUS META ---\n` +
                                           `Variação Relativa: ${varRelativa > 0 ? '+' : ''}${varRelativa.toFixed(1)}%\n` +
                                           `Volume Realizado: ${Math.round(pecasBoas)} peças\n` +
                                           `Desvio da Meta: ${deltaPecas > 0 ? '+' : ''}${deltaPecas} peças`;
                                }
                            }
                        }
                    },
                    scales: { x: { stacked: true }, y: { stacked: true, position: 'left' }, y1: { position: 'right', min: 0, max: 100 } } 
                }
            });
            graficosAtivos.push(g);
        }

        // --- RELATÓRIO COM METAS POR SETOR E DICAS ---
        function gerarRelatorio(dadosTotais, isIndividual) {
            const reportBody = document.getElementById('report-body');
            reportBody.innerHTML = '';

            if (dadosTotais.length === 0) {
                reportBody.innerHTML = '<p style="color:#7f8c8d;">Nenhum dado encontrado para os filtros selecionados.</p>';
                return;
            }

            // Relatório Individual
            if (isIndividual) {
                let tot = dadosTotais.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; return a; }, {r:0, b:0});
                let mediaPura = tot.r > 0 ? (tot.b / tot.r) * 100 : 0;
                let nome = dadosTotais[0].nome;
                
                reportBody.innerHTML = `
                    <div class="insight-card ${mediaPura >= META_ESTEIRA ? 'positive' : 'negative'}">
                        <div class="insight-title">Análise de Desempenho: ${nome}</div>
                        A esteira obteve uma produtividade pura média de <b>${mediaPura.toFixed(1)}%</b> no período selecionado. 
                        ${mediaPura < META_ESTEIRA ? '<br><br><b>Alerta:</b> Abaixo da meta de 80%. Requer atenção da manutenção ou engenharia de processos.' : '<br><br><b>Excelente:</b> O desempenho está dentro ou acima da meta estabelecida.'}
                    </div>
                `;
                return;
            }

            // Relatório Global: Análise de Metas por Setor
            let htmlSetores = `<div class="insight-card neutral"><div class="insight-title">📊 Análise de Metas por Setor</div><ul class="action-list">`;
            
            Object.keys(metasSetor).forEach(nomeSetor => {
                let dSetor = dadosTotais.filter(d => d.setor === nomeSetor);
                if(dSetor.length === 0) return;
                
                let tot = dSetor.reduce((a, c) => { a.r += c.hRonda; a.b += c.hBoas; a.i += c.hIneficiencia; a.v += c.hVazias; return a; }, {r:0, b:0, i:0, v:0});
                let mediaPura = tot.r > 0 ? (tot.b / tot.r) * 100 : 0;
                let meta = metasSetor[nomeSetor];
                
                if (mediaPura >= meta) {
                    htmlSetores += `<li>✅ <b>${nomeSetor}:</b> Atingiu a meta (${mediaPura.toFixed(1)}% vs Meta ${meta}%).</li>`;
                } else {
                    let causa = tot.i > tot.v ? "Alta Ineficiência (Refugo/Retrabalho/Setup Demorado)" : "Alta Ociosidade (Horas Vazias/Máquina Parada)";
                    htmlSetores += `<li>❌ <b>${nomeSetor}:</b> Reprovou (${mediaPura.toFixed(1)}% vs Meta ${meta}%). <i>Causa Raiz: ${causa}</i></li>`;
                }
            });
            htmlSetores += `</ul></div>`;
            reportBody.innerHTML += htmlSetores;

            // Top Piores Máquinas
            let piores = [...dadosTotais].map(d => {
                let pecasBoas = d.hBoas * PPH;
                let pecasMeta = (d.hRonda * (META_ESTEIRA/100)) * PPH;
                d.deltaPecas = Math.round(pecasBoas - pecasMeta);
                d.prodPura = d.hRonda > 0 ? (d.hBoas / d.hRonda) * 100 : 0;
                return d;
            }).filter(d => d.deltaPecas < 0)
              .sort((a, b) => a.deltaPecas - b.deltaPecas)
              .slice(0, 3); 

            if(piores.length > 0) {
                reportBody.innerHTML += `
                    <div class="insight-card negative">
                        <div class="insight-title">🚨 Máquinas Ofensoras (Impacto em Peças)</div>
                        <ul class="action-list">
                            ${piores.map((est, i) => `<li><b>${i+1}º - ${est.nome} (${est.setor}):</b> Produtividade de ${est.prodPura.toFixed(1)}%. Prejuízo estimado de <b>${Math.abs(est.deltaPecas)} peças</b> em relação à meta de 80%.</li>`).join('')}
                        </ul>
                    </div>
                `;
            }

            // Dicas de Melhora (Plano de Ação)
            reportBody.innerHTML += `
                <div class="insight-card positive">
                    <div class="insight-title">🛠️ Plano de Ação Estratégico para Líderes</div>
                    <ul class="action-list">
                        <li><b>Excesso de Horas Vazias (Vermelho):</b> A máquina não está operando. O líder deve acionar rapidamente a logística (verificar falta de peças no posto), o PCP ou abrir chamado de manutenção.</li>
                        <li><b>Excesso de Ineficiência (Laranja):</b> O operador aponta trabalho, mas as peças falham. O foco do líder deve ser em Treinamento Operacional, auditoria no setup da máquina ou inspeção da qualidade da matéria-prima entrante.</li>
                        <li><b>Excesso de Indiretas (Roxo):</b> Tempo alto de apoio. Sugere-se aplicar a metodologia 5S no posto e abastecimento contínuo via rotas de empilhadeira/rebocador, evitando que o operador precise sair da esteira.</li>
                    </ul>
                </div>
            `;
        }

        function mudarAba(id, btn) {
            document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(id).classList.add('active'); btn.classList.add('active');
            document.getElementById('barra-filtros').style.display = (id === 'cadastro') ? 'none' : 'flex';
        }