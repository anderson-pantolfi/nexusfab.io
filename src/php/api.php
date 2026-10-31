<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function responder($dados, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(string $msg, int $status = 400): never
{
    responder(['erro' => $msg], $status);
}

function entrada(): array
{
    $json = json_decode(file_get_contents('php://input') ?: '', true);
    return is_array($json) ? $json : [];
}

function texto(array $d, string $campo, int $max): string
{
    $v = trim((string)($d[$campo] ?? ''));
    if ($v === '' || mb_strlen($v) > $max) {
        erro("Campo '$campo' é obrigatório (máx. $max caracteres).");
    }
    return $v;
}

function horas(array $d, string $campo, bool $positivo = false): float
{
    if (!isset($d[$campo]) || !is_numeric($d[$campo])) {
        erro("Campo '$campo' inválido.");
    }
    $v = (float)$d[$campo];
    if ($v < 0 || ($positivo && $v <= 0) || $v > 9999) {
        erro("Campo '$campo' fora do intervalo permitido.");
    }
    return $v;
}

function excluir(PDO $pdo, string $tabela, string $pk, string $tabelaVinculo, string $fkVinculo, string $nomeVinculo): never
{
    $id = (int)($_GET['id'] ?? 0);
    $forcar = ($_GET['forcar'] ?? '') === '1';
    if ($id <= 0) erro('Identificador inválido.');

    $st = $pdo->prepare("SELECT 1 FROM $tabela WHERE $pk = ?");
    $st->execute([$id]);
    if (!$st->fetchColumn()) erro('Registro não encontrado.', 404);

    $st = $pdo->prepare("SELECT COUNT(*) FROM $tabelaVinculo WHERE $fkVinculo = ?");
    $st->execute([$id]);
    $vinculos = (int)$st->fetchColumn();

    if ($vinculos > 0 && !$forcar) {
        responder(['erro' => "Registro possui $vinculos $nomeVinculo vinculado(s).", 'vinculos' => $vinculos], 409);
    }

    $pdo->beginTransaction();
    try {
        if ($vinculos > 0) {
            $pdo->prepare("DELETE FROM $tabelaVinculo WHERE $fkVinculo = ?")->execute([$id]);
        }
        $pdo->prepare("DELETE FROM $tabela WHERE $pk = ?")->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    responder(['excluido' => true, 'vinculos_removidos' => $vinculos]);
}
function converterValor(string $valor, string $tipo): float|bool|string
{
    return match ($tipo) {
        'numero'   => (float)$valor,
        'booleano' => $valor === '1',
        default    => $valor,
    };
}

$recurso = $_GET['recurso'] ?? '';
$metodo  = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = db();

    switch ("$metodo:$recurso") {

        // ---------- SETORES ----------
        case 'GET:setores':
            $setores = $pdo->query(
                'SELECT s.id_setor, s.nome, s.meta_percentual, COUNT(f.id_funcionario) AS total_funcionarios
                 FROM setor s
                 LEFT JOIN funcionario f ON f.id_setor = s.id_setor
                 GROUP BY s.id_setor, s.nome, s.meta_percentual
                 ORDER BY s.nome'
            )->fetchAll();
            foreach ($setores as &$s) {
                $s['meta_percentual']    = (float)$s['meta_percentual'];
                $s['total_funcionarios'] = (int)$s['total_funcionarios'];
            }
            unset($s);
            responder($setores);

        case 'POST:setores':
            $d = entrada();
            $nome = texto($d, 'nome', 50);
            if (!isset($d['meta_percentual']) || !is_numeric($d['meta_percentual'])) erro('Informe a meta de produtividade.');
            $meta = (float)$d['meta_percentual'];
            if ($meta < 0 || $meta > 100) erro('A meta deve estar entre 0 e 100.');

            $st = $pdo->prepare('SELECT 1 FROM setor WHERE nome = ?');
            $st->execute([$nome]);
            if ($st->fetchColumn()) erro('Já existe um setor com esse nome.', 409);

            $st = $pdo->prepare('INSERT INTO setor (nome, meta_percentual) VALUES (?, ?)');
            $st->execute([$nome, $meta]);
            responder(['id_setor' => (int)$pdo->lastInsertId()], 201);

        case 'DELETE:setores':
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) erro('Identificador inválido.');

            $st = $pdo->prepare('SELECT 1 FROM setor WHERE id_setor = ?');
            $st->execute([$id]);
            if (!$st->fetchColumn()) erro('Setor não encontrado.', 404);

            // Excluir um setor com funcionários apagaria a equipe inteira: bloqueado.
            $st = $pdo->prepare('SELECT COUNT(*) FROM funcionario WHERE id_setor = ?');
            $st->execute([$id]);
            $qtd = (int)$st->fetchColumn();
            if ($qtd > 0) {
                erro("Não é possível excluir: o setor possui $qtd funcionário(s). Exclua-os antes de remover o setor.", 409);
            }

            $pdo->prepare('DELETE FROM setor WHERE id_setor = ?')->execute([$id]);
            responder(['excluido' => true]);

        // ---------- ANOS COM DADOS ----------
        case 'GET:anos':
            $linhas = $pdo->query(
                'SELECT DISTINCT YEAR(data_registro) AS ano FROM apontamento_diario ORDER BY ano'
            )->fetchAll();
            responder(array_map('intval', array_column($linhas, 'ano')));

        // ---------- FUNCIONÁRIOS ----------
        case 'GET:funcionarios':
            responder($pdo->query(
                'SELECT f.id_funcionario, f.codigo_matricula, f.nome, f.cargo,
                        s.id_setor, s.nome AS setor
                 FROM funcionario f JOIN setor s ON s.id_setor = f.id_setor
                 ORDER BY f.nome'
            )->fetchAll());

        case 'POST:funcionarios':
            $d = entrada();
            $matricula = texto($d, 'codigo_matricula', 50);
            $nome      = texto($d, 'nome', 100);
            $cargo     = texto($d, 'cargo', 50);
            $setorNome = texto($d, 'setor', 50);

            $st = $pdo->prepare('SELECT id_setor FROM setor WHERE nome = ?');
            $st->execute([$setorNome]);
            $idSetor = $st->fetchColumn();
            if (!$idSetor) erro('Setor inexistente.', 422);

            $st = $pdo->prepare('SELECT 1 FROM funcionario WHERE codigo_matricula = ?');
            $st->execute([$matricula]);
            if ($st->fetchColumn()) erro('Matrícula já cadastrada.', 409);

            $st = $pdo->prepare(
                'INSERT INTO funcionario (id_setor, codigo_matricula, nome, cargo) VALUES (?, ?, ?, ?)'
            );
            $st->execute([$idSetor, $matricula, $nome, $cargo]);
            responder(['id_funcionario' => (int)$pdo->lastInsertId()], 201);

        case 'DELETE:funcionarios':
            excluir($pdo, 'funcionario', 'id_funcionario', 'apontamento_diario', 'id_funcionario', 'apontamento(s)');

        // ---------- ESTEIRAS ----------
        case 'GET:esteiras':
            responder($pdo->query(
                'SELECT id_esteira, codigo_patrimonio, nome_descricao
                 FROM esteira ORDER BY codigo_patrimonio'
            )->fetchAll());

        case 'POST:esteiras':
            $d = entrada();
            $codigo = strtoupper(texto($d, 'codigo_patrimonio', 50));
            $desc   = texto($d, 'nome_descricao', 100);

            $st = $pdo->prepare('SELECT 1 FROM esteira WHERE codigo_patrimonio = ?');
            $st->execute([$codigo]);
            if ($st->fetchColumn()) erro('Esteira já cadastrada com esse código patrimônio.', 409);

            $st = $pdo->prepare('INSERT INTO esteira (codigo_patrimonio, nome_descricao) VALUES (?, ?)');
            $st->execute([$codigo, $desc]);
            responder(['id_esteira' => (int)$pdo->lastInsertId()], 201);

        case 'DELETE:esteiras':
            excluir($pdo, 'esteira', 'id_esteira', 'esteiras_do_dia', 'id_esteira', 'registro(s) de apontamento');

        // ---------- APONTAMENTO ----------
        case 'POST:apontamentos':
            $d = entrada();
            $idFunc    = (int)($d['id_funcionario'] ?? 0);
            $idEsteira = (int)($d['id_esteira'] ?? 0);
            $data      = (string)($d['data_registro'] ?? '');
            $dt = DateTime::createFromFormat('Y-m-d', $data);
            if (!$dt || $dt->format('Y-m-d') !== $data) erro("Data inválida (use AAAA-MM-DD).");
            if ($idFunc <= 0 || $idEsteira <= 0) erro('Funcionário e esteira são obrigatórios.');

            $nela   = horas($d, 'horas_trabalhadas_nela', true);
            $ronda  = horas($d, 'horas_ronda', true);
            $apont  = horas($d, 'horas_apontadas');
            $prod   = horas($d, 'horas_produtivas');
            $improd = horas($d, 'horas_improdutivas');
            $reparo = horas($d, 'horas_reparo');
            $flut   = horas($d, 'horas_flutuantes');

            $pdo->beginTransaction();
            try {
                $st = $pdo->prepare(
                    'INSERT INTO apontamento_diario
                       (id_funcionario, data_registro, horas_ronda, horas_apontadas,
                        horas_produtivas, horas_improdutivas, horas_reparo, horas_flutuantes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        id_apontamento     = LAST_INSERT_ID(id_apontamento),
                        horas_ronda        = GREATEST(horas_ronda, VALUES(horas_ronda)),
                        horas_apontadas    = horas_apontadas    + VALUES(horas_apontadas),
                        horas_produtivas   = horas_produtivas   + VALUES(horas_produtivas),
                        horas_improdutivas = horas_improdutivas + VALUES(horas_improdutivas),
                        horas_reparo       = horas_reparo       + VALUES(horas_reparo),
                        horas_flutuantes   = horas_flutuantes   + VALUES(horas_flutuantes)'
                );
                $st->execute([$idFunc, $data, $ronda, $apont, $prod, $improd, $reparo, $flut]);
                $idApont = (int)$pdo->lastInsertId();

                $st = $pdo->prepare(
                    'INSERT INTO esteiras_do_dia (id_apontamento, id_esteira, horas_trabalhadas_nela)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        horas_trabalhadas_nela = horas_trabalhadas_nela + VALUES(horas_trabalhadas_nela)'
                );
                $st->execute([$idApont, $idEsteira, $nela]);

                $st = $pdo->prepare(
                    'SELECT a.horas_ronda, SUM(ed.horas_trabalhadas_nela) AS soma
                     FROM apontamento_diario a
                     JOIN esteiras_do_dia ed ON ed.id_apontamento = a.id_apontamento
                     WHERE a.id_apontamento = ?
                     GROUP BY a.id_apontamento, a.horas_ronda'
                );
                $st->execute([$idApont]);
                $chk = $st->fetch();
                if ($chk && (float)$chk['soma'] > (float)$chk['horas_ronda']) {
                    throw new DomainException('A soma das horas nas esteiras excede as horas de ronda do dia.');
                }

                $pdo->commit();
                responder(['id_apontamento' => $idApont], 201);
            } catch (DomainException $e) {
                $pdo->rollBack();
                erro($e->getMessage(), 422);
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

        // ---------- DASHBOARD ----------
        case 'GET:dashboard':
            $ano    = (int)($_GET['ano'] ?? date('Y'));
            $mesIni = (int)($_GET['mes_ini'] ?? 1);
            $mesFim = (int)($_GET['mes_fim'] ?? 12);
            if ($ano < 2000 || $ano > 2100) erro('Ano inválido.');
            if ($mesIni < 1 || $mesIni > 12 || $mesFim < 1 || $mesFim > 12 || $mesIni > $mesFim) {
                erro('Período inválido.');
            }

            // Faixa de datas 
            $inicio = sprintf('%04d-%02d-01', $ano, $mesIni);
            $fim = (new DateTimeImmutable(sprintf('%04d-%02d-01', $ano, $mesFim)))
                ->modify('last day of this month')->format('Y-m-d');

            // O denominador do rateio (total de horas nas esteiras do apontamento)
            // é calculado só para o período pedido.
            $sql = 'SELECT MONTH(a.data_registro) AS mes, e.id_esteira, e.nome_descricao AS nome_esteira,
                           s.nome AS setor,
                           SUM(ed.horas_trabalhadas_nela)                                   AS horas_ronda,
                           SUM(a.horas_produtivas   * ed.horas_trabalhadas_nela / t.total) AS horas_produtivas,
                           SUM(a.horas_improdutivas * ed.horas_trabalhadas_nela / t.total) AS horas_improdutivas,
                           SUM(a.horas_reparo       * ed.horas_trabalhadas_nela / t.total) AS horas_reparo,
                           SUM(a.horas_flutuantes   * ed.horas_trabalhadas_nela / t.total) AS horas_flutuantes
                    FROM apontamento_diario a
                    JOIN (SELECT ed2.id_apontamento, SUM(ed2.horas_trabalhadas_nela) AS total
                          FROM esteiras_do_dia ed2
                          JOIN apontamento_diario a2 ON a2.id_apontamento = ed2.id_apontamento
                          WHERE a2.data_registro BETWEEN ? AND ?
                          GROUP BY ed2.id_apontamento) t ON t.id_apontamento = a.id_apontamento
                    JOIN esteiras_do_dia ed ON ed.id_apontamento = a.id_apontamento
                    JOIN esteira e          ON e.id_esteira      = ed.id_esteira
                    JOIN funcionario f      ON f.id_funcionario  = a.id_funcionario
                    JOIN setor s            ON s.id_setor        = f.id_setor
                    WHERE a.data_registro BETWEEN ? AND ?';
            $params = [$inicio, $fim, $inicio, $fim];

            if (!empty($_GET['id_esteira']) && $_GET['id_esteira'] !== 'todas') {
                $sql .= ' AND ed.id_esteira = ?';
                $params[] = (int)$_GET['id_esteira'];
            }
            $sql .= ' GROUP BY MONTH(a.data_registro), e.id_esteira, e.nome_descricao, s.nome
                      ORDER BY mes, nome_esteira';

            $st = $pdo->prepare($sql);
            $st->execute($params);
            $linhas = $st->fetchAll();

            foreach ($linhas as &$l) {
                foreach (['horas_ronda', 'horas_produtivas', 'horas_improdutivas',
                          'horas_reparo', 'horas_flutuantes'] as $c) {
                    $l[$c] = round((float)$l[$c], 2);
                }
                $l['mes'] = (int)$l['mes'];
                $l['id_esteira'] = (int)$l['id_esteira'];
            }
            unset($l);
            responder($linhas);

        // ---------- INICIALIZAÇÃO----------
        case 'GET:inicializacao':
            $configuracoes = $pdo->query(
                'SELECT chave, valor, tipo, titulo, descricao, editavel, minimo, maximo
                 FROM configuracao ORDER BY chave'
            )->fetchAll();
            foreach ($configuracoes as &$c) {
                $c['valor']    = converterValor((string)$c['valor'], (string)$c['tipo']);
                $c['editavel'] = (bool)$c['editavel'];
                $c['minimo']   = $c['minimo'] !== null ? (float)$c['minimo'] : null;
                $c['maximo']   = $c['maximo'] !== null ? (float)$c['maximo'] : null;
            }
            unset($c);

            $categorias = $pdo->query(
                'SELECT chave, rotulo, rotulo_longo, cor, icone, acao, perda
                 FROM categoria_hora ORDER BY ordem'
            )->fetchAll();
            foreach ($categorias as &$c) { $c['perda'] = (bool)$c['perda']; }
            unset($c);

            $periodos = $pdo->query(
                'SELECT codigo, rotulo, rotulo_curto, mes_inicio, mes_fim FROM periodo ORDER BY ordem'
            )->fetchAll();
            foreach ($periodos as &$p) {
                $p['mes_inicio'] = (int)$p['mes_inicio'];
                $p['mes_fim']    = (int)$p['mes_fim'];
            }
            unset($p);

            $notificacoes = $pdo->query(
                'SELECT id_notificacao, mensagem, icone, lida
                 FROM notificacao ORDER BY criada_em DESC, id_notificacao DESC LIMIT 20'
            )->fetchAll();
            foreach ($notificacoes as &$n) { $n['lida'] = (bool)$n['lida']; }
            unset($n);

            $usuario = $pdo->query(
                'SELECT nome, apelido, email, avatar_url, tema FROM usuario ORDER BY id_usuario LIMIT 1'
            )->fetch();

            responder([
                'configuracoes' => $configuracoes,
                'categorias'    => $categorias,
                'periodos'      => $periodos,
                'visoes'        => $pdo->query(
                    'SELECT codigo, rotulo, descricao_curta, ordenacao FROM visao ORDER BY ordem'
                )->fetchAll(),
                'abas'          => $pdo->query(
                    'SELECT codigo, rotulo_menu, titulo, subtitulo, icone, posicao FROM aba ORDER BY ordem'
                )->fetchAll(),
                'usuario'       => $usuario ?: null,
                'notificacoes'  => $notificacoes,
            ]);

        // ---------- CARGOS EXISTENTES ----------
        case 'GET:cargos':
            responder($pdo->query('SELECT DISTINCT cargo FROM funcionario ORDER BY cargo')
                ->fetchAll(PDO::FETCH_COLUMN));

        // ---------- CONFIGURAÇÕES ----------
        case 'POST:configuracoes':
            $d = entrada();
            $chave = texto($d, 'chave', 50);
            $st = $pdo->prepare('SELECT tipo, editavel, minimo, maximo FROM configuracao WHERE chave = ?');
            $st->execute([$chave]);
            $cfg = $st->fetch();
            if (!$cfg) erro('Configuração inexistente.', 404);
            if (!(int)$cfg['editavel']) erro('Esta configuração não pode ser alterada.', 403);

            $valor = $d['valor'] ?? null;
            if ($cfg['tipo'] === 'numero') {
                if (!is_numeric($valor)) erro('Informe um valor numérico.');
                $n = (float)$valor;
                if ($cfg['minimo'] !== null && $n < (float)$cfg['minimo']) erro("O valor mínimo é {$cfg['minimo']}.");
                if ($cfg['maximo'] !== null && $n > (float)$cfg['maximo']) erro("O valor máximo é {$cfg['maximo']}.");
                $valor = (string)$n;
            } elseif ($cfg['tipo'] === 'booleano') {
                $valor = ($valor === true || $valor === 1 || $valor === '1') ? '1' : '0';
            } else {
                $valor = trim((string)$valor);
                if ($valor === '' || mb_strlen($valor) > 255) erro('Valor inválido.');
            }

            $pdo->prepare('UPDATE configuracao SET valor = ? WHERE chave = ?')->execute([$valor, $chave]);
            responder(['chave' => $chave, 'valor' => converterValor($valor, (string)$cfg['tipo'])]);

        // ---------- PERFIL E TEMA ----------
        case 'POST:perfil':
            $d = entrada();
            $nome  = texto($d, 'nome', 100);
            $email = texto($d, 'email', 150);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) erro('E-mail inválido.');

            $idUsuario = (int)$pdo->query('SELECT id_usuario FROM usuario ORDER BY id_usuario LIMIT 1')->fetchColumn();
            if ($idUsuario <= 0) erro('Usuário não encontrado.', 404);

            $st = $pdo->prepare('SELECT 1 FROM usuario WHERE email = ? AND id_usuario <> ?');
            $st->execute([$email, $idUsuario]);
            if ($st->fetchColumn()) erro('E-mail já utilizado por outro usuário.', 409);

            $apelido = explode(' ', $nome)[0];
            $pdo->prepare('UPDATE usuario SET nome = ?, apelido = ?, email = ? WHERE id_usuario = ?')
                ->execute([$nome, $apelido, $email, $idUsuario]);

            $st = $pdo->prepare('SELECT nome, apelido, email, avatar_url, tema FROM usuario WHERE id_usuario = ?');
            $st->execute([$idUsuario]);
            responder($st->fetch());

        case 'POST:tema':
            $tema = (string)(entrada()['tema'] ?? '');
            if (!in_array($tema, ['light', 'dark'], true)) erro('Tema inválido.');
            $pdo->query('UPDATE usuario SET tema = ' . $pdo->quote($tema) . ' ORDER BY id_usuario LIMIT 1');
            responder(['tema' => $tema]);

        default:
            erro('Rota não encontrada.', 404);
    }
} catch (Throwable $e) {
    error_log($e->getMessage());
    $resposta = ['erro' => 'Erro interno do servidor.'];
    if (defined('MODO_DEBUG') && MODO_DEBUG) {
        $resposta['detalhe'] = $e->getMessage();
    }
    responder($resposta, 500);
}