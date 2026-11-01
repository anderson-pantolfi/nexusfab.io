<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
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

function idObrigatorio(): int
{
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) erro('Identificador inválido.');
    return $id;
}

/** Primeiro e último dia do intervalo de meses de um ano. */
function faixaDeDatas(int $ano, int $mesIni, int $mesFim): array
{
    if ($ano < 2000 || $ano > 2100) erro('Ano inválido.');
    if ($mesIni < 1 || $mesIni > 12 || $mesFim < 1 || $mesFim > 12 || $mesIni > $mesFim) erro('Período inválido.');
    $inicio = sprintf('%04d-%02d-01', $ano, $mesIni);
    $fim = (new DateTimeImmutable(sprintf('%04d-%02d-01', $ano, $mesFim)))
        ->modify('last day of this month')->format('Y-m-d');
    return [$inicio, $fim];
}

const INICIO_HISTORICO = '2000-01-01';

/** Data e hora atuais no fuso configurado (a hora vem do relógio). */
function agoraLocal(PDO $pdo): DateTimeImmutable
{
    static $fuso = null;
    if ($fuso === null) {
        $nome = $pdo->query("SELECT valor FROM configuracao WHERE chave = 'fuso_horario'")->fetchColumn();
        $fuso = new DateTimeZone($nome ?: date_default_timezone_get());
    }
    return new DateTimeImmutable('now', $fuso);
}

function dataValida(string $valor): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $valor);
    return $d && $d->format('Y-m-d') === $valor;
}

function registrarMudancaSetor(PDO $pdo, int $idFuncionario, int $idSetor, string $vigencia): void
{
    $st = $pdo->prepare('SELECT id_historico, id_setor, data_inicio FROM funcionario_setor WHERE id_funcionario = ? AND data_fim IS NULL');
    $st->execute([$idFuncionario]);
    $aberto = $st->fetch();

    if ($aberto) {
        if ((int)$aberto['id_setor'] === $idSetor) return;
        if ($aberto['data_inicio'] >= $vigencia) {
            $pdo->prepare('UPDATE funcionario_setor SET id_setor = ? WHERE id_historico = ?')
                ->execute([$idSetor, $aberto['id_historico']]);
            return;
        }
        $vespera = (new DateTimeImmutable($vigencia))->modify('-1 day')->format('Y-m-d');
        $pdo->prepare('UPDATE funcionario_setor SET data_fim = ? WHERE id_historico = ?')
            ->execute([$vespera, $aberto['id_historico']]);
    } else {
        $vigencia = INICIO_HISTORICO;
    }
    $pdo->prepare('INSERT INTO funcionario_setor (id_funcionario, id_setor, data_inicio, data_fim) VALUES (?, ?, ?, NULL)')
        ->execute([$idFuncionario, $idSetor, $vigencia]);
}

function registrarMudancaMeta(PDO $pdo, int $idSetor, float $meta, string $vigencia): void
{
    $st = $pdo->prepare('SELECT id_meta, meta_percentual, data_inicio FROM setor_meta WHERE id_setor = ? AND data_fim IS NULL');
    $st->execute([$idSetor]);
    $aberta = $st->fetch();

    if ($aberta) {
        if (abs((float)$aberta['meta_percentual'] - $meta) < 0.0001) return;
        if ($aberta['data_inicio'] >= $vigencia) {
            $pdo->prepare('UPDATE setor_meta SET meta_percentual = ? WHERE id_meta = ?')
                ->execute([$meta, $aberta['id_meta']]);
            return;
        }
        $vespera = (new DateTimeImmutable($vigencia))->modify('-1 day')->format('Y-m-d');
        $pdo->prepare('UPDATE setor_meta SET data_fim = ? WHERE id_meta = ?')
            ->execute([$vespera, $aberta['id_meta']]);
    } else {
        $vigencia = INICIO_HISTORICO;
    }
    $pdo->prepare('INSERT INTO setor_meta (id_setor, meta_percentual, data_inicio, data_fim) VALUES (?, ?, ?, NULL)')
        ->execute([$idSetor, $meta, $vigencia]);
}

function filtrosApontamento(): array
{
    $from = 'FROM apontamento_diario a
        JOIN funcionario f ON f.id_funcionario = a.id_funcionario
        JOIN funcionario_setor fs ON fs.id_funcionario = a.id_funcionario
             AND a.data_registro >= fs.data_inicio AND (fs.data_fim IS NULL OR a.data_registro <= fs.data_fim)
        JOIN setor s ON s.id_setor = fs.id_setor
        JOIN setor_meta m ON m.id_setor = fs.id_setor
             AND a.data_registro >= m.data_inicio AND (m.data_fim IS NULL OR a.data_registro <= m.data_fim)';
    $where = [];
    $params = [];
    $ini = null;
    $fim = null;

    $dataIni = trim((string)($_GET['data_ini'] ?? ''));
    $dataFim = trim((string)($_GET['data_fim'] ?? ''));
    if ($dataIni !== '' || $dataFim !== '') {
        if ($dataIni !== '') {
            if (!dataValida($dataIni)) erro('Data inicial inválida.');
            $where[] = 'a.data_registro >= ?';
            $params[] = $ini = $dataIni;
        }
        if ($dataFim !== '') {
            if (!dataValida($dataFim)) erro('Data final inválida.');
            $where[] = 'a.data_registro <= ?';
            $params[] = $fim = $dataFim;
        }
        if ($ini !== null && $fim !== null && $ini > $fim) erro('A data inicial não pode ser maior que a final.');
    } else {
        $ano = (int)($_GET['ano'] ?? 0); 
        if ($ano > 0) {
            [$ini, $fim] = faixaDeDatas($ano, (int)($_GET['mes_ini'] ?? 1), (int)($_GET['mes_fim'] ?? 12));
            $where[] = 'a.data_registro BETWEEN ? AND ?';
            array_push($params, $ini, $fim);
        }
    }

    $idFuncionario = (int)($_GET['id_funcionario'] ?? 0);
    if ($idFuncionario > 0) {
        $where[] = 'a.id_funcionario = ?';
        $params[] = $idFuncionario;
    }
    $idSetor = (int)($_GET['id_setor'] ?? 0);
    if ($idSetor > 0) {
        $where[] = 'fs.id_setor = ?';
        $params[] = $idSetor;
    }
    if (!empty($_GET['id_esteira']) && $_GET['id_esteira'] !== 'todas') {
        $where[] = 'EXISTS (SELECT 1 FROM esteiras_do_dia x WHERE x.id_apontamento = a.id_apontamento AND x.id_esteira = ?)';
        $params[] = (int)$_GET['id_esteira'];
    }
    $busca = trim((string)($_GET['busca'] ?? ''));
    if ($busca !== '') {
        foreach (preg_split('/\s+/', $busca) as $palavra) {
            $like = '%' . addcslashes($palavra, '%_\\') . '%';
            $where[] = '(f.nome LIKE ? OR f.codigo_matricula LIKE ?)';
            array_push($params, $like, $like);
        }
    }
    return [$from, $where ? 'WHERE ' . implode(' AND ', $where) : '', $params, [$ini, $fim]];
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

            $pdo->beginTransaction();
            try {
                $st = $pdo->prepare('INSERT INTO setor (nome, meta_percentual) VALUES (?, ?)');
                $st->execute([$nome, $meta]);
                $novoId = (int)$pdo->lastInsertId();
                registrarMudancaMeta($pdo, $novoId, $meta, INICIO_HISTORICO);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            responder(['id_setor' => $novoId], 201);

        case 'DELETE:setores':
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) erro('Identificador inválido.');

            $st = $pdo->prepare('SELECT 1 FROM setor WHERE id_setor = ?');
            $st->execute([$id]);
            if (!$st->fetchColumn()) erro('Setor não encontrado.', 404);

            $st = $pdo->prepare('SELECT COUNT(DISTINCT id_funcionario) FROM funcionario_setor WHERE id_setor = ?');
            $st->execute([$id]);
            $qtd = (int)$st->fetchColumn();
            if ($qtd > 0) {
                erro("Não é possível excluir: $qtd funcionário(s) estão ou já estiveram neste setor, e o histórico deles depende dele.", 409);
            }

            $pdo->prepare('DELETE FROM setor WHERE id_setor = ?')->execute([$id]);
            responder(['excluido' => true]);

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

            $pdo->beginTransaction();
            try {
                $st = $pdo->prepare(
                    'INSERT INTO funcionario (id_setor, codigo_matricula, nome, cargo) VALUES (?, ?, ?, ?)'
                );
                $st->execute([$idSetor, $matricula, $nome, $cargo]);
                $novoId = (int)$pdo->lastInsertId();
                registrarMudancaSetor($pdo, $novoId, (int)$idSetor, INICIO_HISTORICO);
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            responder(['id_funcionario' => $novoId], 201);

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

            $agora = agoraLocal($pdo)->format('Y-m-d H:i:s'); // hora do relógio do servidor

            $pdo->beginTransaction();
            try {
                $st = $pdo->prepare(
                    'INSERT INTO apontamento_diario
                       (id_funcionario, data_registro, registrado_em, horas_ronda, horas_apontadas,
                        horas_produtivas, horas_improdutivas, horas_reparo, horas_flutuantes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        id_apontamento     = LAST_INSERT_ID(id_apontamento),
                        registrado_em      = COALESCE(registrado_em, VALUES(registrado_em)),
                        horas_ronda        = GREATEST(horas_ronda, VALUES(horas_ronda)),
                        horas_apontadas    = horas_apontadas    + VALUES(horas_apontadas),
                        horas_produtivas   = horas_produtivas   + VALUES(horas_produtivas),
                        horas_improdutivas = horas_improdutivas + VALUES(horas_improdutivas),
                        horas_reparo       = horas_reparo       + VALUES(horas_reparo),
                        horas_flutuantes   = horas_flutuantes   + VALUES(horas_flutuantes)'
                );
                $st->execute([$idFunc, $data, $agora, $ronda, $apont, $prod, $improd, $reparo, $flut]);
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

            $inicio = sprintf('%04d-%02d-01', $ano, $mesIni);
            $fim = (new DateTimeImmutable(sprintf('%04d-%02d-01', $ano, $mesFim)))
                ->modify('last day of this month')->format('Y-m-d');

            $sql = 'SELECT MONTH(a.data_registro) AS mes, e.id_esteira, e.nome_descricao AS nome_esteira,
                           s.nome AS setor,
                           SUM(ed.horas_trabalhadas_nela)                                   AS horas_ronda,
                           SUM(a.horas_produtivas   * ed.horas_trabalhadas_nela / t.total) AS horas_produtivas,
                           SUM(a.horas_improdutivas * ed.horas_trabalhadas_nela / t.total) AS horas_improdutivas,
                           SUM(a.horas_reparo       * ed.horas_trabalhadas_nela / t.total) AS horas_reparo,
                           SUM(a.horas_flutuantes   * ed.horas_trabalhadas_nela / t.total) AS horas_flutuantes,
                           SUM(m.meta_percentual * ed.horas_trabalhadas_nela)               AS soma_meta_horas
                    FROM apontamento_diario a
                    JOIN (SELECT ed2.id_apontamento, SUM(ed2.horas_trabalhadas_nela) AS total
                          FROM esteiras_do_dia ed2
                          JOIN apontamento_diario a2 ON a2.id_apontamento = ed2.id_apontamento
                          WHERE a2.data_registro BETWEEN ? AND ?
                          GROUP BY ed2.id_apontamento) t ON t.id_apontamento = a.id_apontamento
                    JOIN esteiras_do_dia ed ON ed.id_apontamento = a.id_apontamento
                    JOIN esteira e          ON e.id_esteira      = ed.id_esteira
                    JOIN funcionario_setor fs ON fs.id_funcionario = a.id_funcionario
                         AND a.data_registro >= fs.data_inicio AND (fs.data_fim IS NULL OR a.data_registro <= fs.data_fim)
                    JOIN setor s            ON s.id_setor        = fs.id_setor
                    JOIN setor_meta m       ON m.id_setor        = fs.id_setor
                         AND a.data_registro >= m.data_inicio AND (m.data_fim IS NULL OR a.data_registro <= m.data_fim)
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
                          'horas_reparo', 'horas_flutuantes', 'soma_meta_horas'] as $c) {
                    $l[$c] = round((float)$l[$c], 2);
                }
                $l['mes'] = (int)$l['mes'];
                $l['id_esteira'] = (int)$l['id_esteira'];
            }
            unset($l);
            responder($linhas);

        case 'PUT:funcionarios':
            $id = idObrigatorio();
            $d = entrada();
            $matricula = texto($d, 'codigo_matricula', 50);
            $nome      = texto($d, 'nome', 100);
            $cargo     = texto($d, 'cargo', 50);
            $setorNome = texto($d, 'setor', 50);

            $st = $pdo->prepare('SELECT 1 FROM funcionario WHERE id_funcionario = ?');
            $st->execute([$id]);
            if (!$st->fetchColumn()) erro('Funcionário não encontrado.', 404);

            $st = $pdo->prepare('SELECT id_setor FROM setor WHERE nome = ?');
            $st->execute([$setorNome]);
            $idSetor = $st->fetchColumn();
            if (!$idSetor) erro('Setor inexistente.', 422);

            $st = $pdo->prepare('SELECT 1 FROM funcionario WHERE codigo_matricula = ? AND id_funcionario <> ?');
            $st->execute([$matricula, $id]);
            if ($st->fetchColumn()) erro('Matrícula já cadastrada para outro funcionário.', 409);

            $pdo->beginTransaction();
            try {
                $pdo->prepare('UPDATE funcionario SET id_setor = ?, codigo_matricula = ?, nome = ?, cargo = ? WHERE id_funcionario = ?')
                    ->execute([$idSetor, $matricula, $nome, $cargo, $id]);
                registrarMudancaSetor($pdo, $id, (int)$idSetor, agoraLocal($pdo)->format('Y-m-d'));
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            responder(['atualizado' => true]);

        case 'PUT:esteiras':
            $id = idObrigatorio();
            $d = entrada();
            $codigo = strtoupper(texto($d, 'codigo_patrimonio', 50));
            $desc   = texto($d, 'nome_descricao', 100);

            $st = $pdo->prepare('SELECT 1 FROM esteira WHERE id_esteira = ?');
            $st->execute([$id]);
            if (!$st->fetchColumn()) erro('Esteira não encontrada.', 404);

            $st = $pdo->prepare('SELECT 1 FROM esteira WHERE codigo_patrimonio = ? AND id_esteira <> ?');
            $st->execute([$codigo, $id]);
            if ($st->fetchColumn()) erro('Já existe outra esteira com esse código patrimônio.', 409);

            $pdo->prepare('UPDATE esteira SET codigo_patrimonio = ?, nome_descricao = ? WHERE id_esteira = ?')
                ->execute([$codigo, $desc, $id]);
            responder(['atualizado' => true]);

        case 'PUT:setores':
            $id = idObrigatorio();
            $d = entrada();
            $nome = texto($d, 'nome', 50);
            if (!isset($d['meta_percentual']) || !is_numeric($d['meta_percentual'])) erro('Informe a meta de produtividade.');
            $meta = (float)$d['meta_percentual'];
            if ($meta < 0 || $meta > 100) erro('A meta deve estar entre 0 e 100.');

            $st = $pdo->prepare('SELECT 1 FROM setor WHERE id_setor = ?');
            $st->execute([$id]);
            if (!$st->fetchColumn()) erro('Setor não encontrado.', 404);

            $st = $pdo->prepare('SELECT 1 FROM setor WHERE nome = ? AND id_setor <> ?');
            $st->execute([$nome, $id]);
            if ($st->fetchColumn()) erro('Já existe outro setor com esse nome.', 409);

            $pdo->beginTransaction();
            try {
                $pdo->prepare('UPDATE setor SET nome = ?, meta_percentual = ? WHERE id_setor = ?')
                    ->execute([$nome, $meta, $id]);
                registrarMudancaMeta($pdo, $id, $meta, agoraLocal($pdo)->format('Y-m-d'));
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            responder(['atualizado' => true]);

        case 'GET:apontamentos':
            [$joins, $where, $params] = filtrosApontamento();

            $porPagina = min(200, max(1, (int)($_GET['por_pagina'] ?? 25)));
            $pagina    = max(1, (int)($_GET['pagina'] ?? 1));
            $offset    = ($pagina - 1) * $porPagina;

            $st = $pdo->prepare("SELECT COUNT(*) $joins $where");
            $st->execute($params);
            $total = (int)$st->fetchColumn();

            $st = $pdo->prepare(
                "SELECT a.id_apontamento, a.id_funcionario, a.data_registro, a.registrado_em,
                        f.nome, f.codigo_matricula, s.nome AS setor, m.meta_percentual AS meta,
                        a.horas_ronda, a.horas_apontadas, a.horas_produtivas,
                        a.horas_improdutivas, a.horas_reparo, a.horas_flutuantes
                 $joins $where
                 ORDER BY a.data_registro DESC, a.id_apontamento DESC
                 LIMIT $porPagina OFFSET $offset"
            );
            $st->execute($params);
            $linhas = $st->fetchAll();

            $mapa = [];
            $ids = array_map('intval', array_column($linhas, 'id_apontamento'));
            if ($ids) {
                $marcas = implode(',', array_fill(0, count($ids), '?'));
                $st = $pdo->prepare(
                    "SELECT ed.id_apontamento, e.id_esteira, e.codigo_patrimonio, e.nome_descricao,
                            ed.horas_trabalhadas_nela
                     FROM esteiras_do_dia ed
                     JOIN esteira e ON e.id_esteira = ed.id_esteira
                     WHERE ed.id_apontamento IN ($marcas)
                     ORDER BY ed.horas_trabalhadas_nela DESC, e.codigo_patrimonio"
                );
                $st->execute($ids);
                foreach ($st->fetchAll() as $r) {
                    $mapa[(int)$r['id_apontamento']][] = [
                        'id_esteira'             => (int)$r['id_esteira'],
                        'codigo_patrimonio'      => $r['codigo_patrimonio'],
                        'nome_descricao'         => $r['nome_descricao'],
                        'horas_trabalhadas_nela' => (float)$r['horas_trabalhadas_nela'],
                    ];
                }
            }
            foreach ($linhas as &$l) {
                $l['id_apontamento'] = (int)$l['id_apontamento'];
                $l['id_funcionario'] = (int)$l['id_funcionario'];
                $l['meta'] = (float)$l['meta'];
                foreach (['horas_ronda', 'horas_apontadas', 'horas_produtivas',
                          'horas_improdutivas', 'horas_reparo', 'horas_flutuantes'] as $c) {
                    $l[$c] = (float)$l[$c];
                }
                $l['esteiras'] = $mapa[$l['id_apontamento']] ?? [];
            }
            unset($l);

            responder(['total' => $total, 'pagina' => $pagina, 'por_pagina' => $porPagina, 'itens' => $linhas]);

        case 'GET:analise_funcionarios':
            [$joins, $where, $params, $intervalo] = filtrosApontamento();
            $idFunc = (int)($_GET['id_funcionario'] ?? 0);
            $somas = 'SUM(a.horas_ronda) AS horas_ronda, SUM(a.horas_apontadas) AS horas_apontadas,
                      SUM(a.horas_produtivas) AS horas_produtivas, SUM(a.horas_improdutivas) AS horas_improdutivas,
                      SUM(a.horas_reparo) AS horas_reparo, SUM(a.horas_flutuantes) AS horas_flutuantes,
                      SUM(m.meta_percentual * a.horas_ronda) AS soma_meta_horas';
            $campos = ['horas_ronda', 'horas_apontadas', 'horas_produtivas', 'horas_improdutivas',
                       'horas_reparo', 'horas_flutuantes', 'soma_meta_horas'];

            if ($idFunc <= 0) {
                $st = $pdo->prepare(
                    "SELECT f.id_funcionario, f.nome, f.codigo_matricula, f.cargo, sa.nome AS setor_atual,
                            COUNT(*) AS dias, COUNT(DISTINCT fs.id_setor) AS qtd_setores, $somas
                     $joins
                     JOIN setor sa ON sa.id_setor = f.id_setor
                     $where
                     GROUP BY f.id_funcionario, f.nome, f.codigo_matricula, f.cargo, sa.nome"
                );
                $st->execute($params);
                $lista = $st->fetchAll();
                foreach ($lista as &$l) {
                    $l['id_funcionario'] = (int)$l['id_funcionario'];
                    $l['dias'] = (int)$l['dias'];
                    $l['qtd_setores'] = (int)$l['qtd_setores'];
                    foreach ($campos as $c) $l[$c] = round((float)$l[$c], 2);
                }
                unset($l);
                responder(['modo' => 'ranking', 'funcionarios' => $lista]);
            }

            $st = $pdo->prepare(
                'SELECT f.id_funcionario, f.nome, f.codigo_matricula, f.cargo, s.nome AS setor_atual
                 FROM funcionario f JOIN setor s ON s.id_setor = f.id_setor WHERE f.id_funcionario = ?'
            );
            $st->execute([$idFunc]);
            $funcionario = $st->fetch();
            if (!$funcionario) erro('Funcionário não encontrado.', 404);

            $agrupar = (string)($_GET['agrupar'] ?? 'auto');
            if ($agrupar !== 'dia' && $agrupar !== 'mes') {
                [$di, $df] = $intervalo;
                $curto = $di !== null && $df !== null
                    && (new DateTimeImmutable($di))->diff(new DateTimeImmutable($df))->days <= 62;
                $agrupar = $curto ? 'dia' : 'mes';
            }
            $expr = $agrupar === 'dia' ? 'a.data_registro' : "DATE_FORMAT(a.data_registro, '%Y-%m')";

            $st = $pdo->prepare(
                "SELECT $expr AS chave, COUNT(*) AS apontamentos, $somas
                 $joins $where GROUP BY chave ORDER BY chave"
            );
            $st->execute($params);
            $serie = $st->fetchAll();
            foreach ($serie as &$l) {
                $l['chave'] = (string)$l['chave'];
                $l['apontamentos'] = (int)$l['apontamentos'];
                foreach ($campos as $c) $l[$c] = round((float)$l[$c], 2);
            }
            unset($l);

            $st = $pdo->prepare(
                "SELECT e.id_esteira, e.codigo_patrimonio, e.nome_descricao,
                        SUM(ed.horas_trabalhadas_nela)                                    AS horas_ronda,
                        SUM(a.horas_apontadas    * ed.horas_trabalhadas_nela / tt.total) AS horas_apontadas,
                        SUM(a.horas_produtivas   * ed.horas_trabalhadas_nela / tt.total) AS horas_produtivas,
                        SUM(a.horas_improdutivas * ed.horas_trabalhadas_nela / tt.total) AS horas_improdutivas,
                        SUM(a.horas_reparo       * ed.horas_trabalhadas_nela / tt.total) AS horas_reparo,
                        SUM(a.horas_flutuantes   * ed.horas_trabalhadas_nela / tt.total) AS horas_flutuantes,
                        SUM(m.meta_percentual * ed.horas_trabalhadas_nela)                AS soma_meta_horas
                 $joins
                 JOIN esteiras_do_dia ed ON ed.id_apontamento = a.id_apontamento
                 JOIN esteira e          ON e.id_esteira      = ed.id_esteira
                 JOIN (SELECT id_apontamento, SUM(horas_trabalhadas_nela) AS total
                       FROM esteiras_do_dia
                       WHERE id_apontamento IN (SELECT id_apontamento FROM apontamento_diario WHERE id_funcionario = $idFunc)
                       GROUP BY id_apontamento) tt ON tt.id_apontamento = a.id_apontamento
                 $where
                 GROUP BY e.id_esteira, e.codigo_patrimonio, e.nome_descricao
                 ORDER BY horas_ronda DESC"
            );
            $st->execute($params);
            $porEsteira = $st->fetchAll();
            foreach ($porEsteira as &$l) {
                $l['id_esteira'] = (int)$l['id_esteira'];
                foreach ($campos as $c) $l[$c] = round((float)$l[$c], 2);
            }
            unset($l);

            $st = $pdo->prepare(
                'SELECT s.nome AS setor, fs.data_inicio, fs.data_fim
                 FROM funcionario_setor fs JOIN setor s ON s.id_setor = fs.id_setor
                 WHERE fs.id_funcionario = ? ORDER BY fs.data_inicio'
            );
            $st->execute([$idFunc]);
            $historico = $st->fetchAll();
            foreach ($historico as &$l) {
                if ($l['data_inicio'] === INICIO_HISTORICO) $l['data_inicio'] = null;
            }
            unset($l);

            $funcionario['id_funcionario'] = (int)$funcionario['id_funcionario'];
            responder([
                'modo' => 'individual', 'funcionario' => $funcionario, 'agrupar' => $agrupar,
                'serie' => $serie, 'esteiras' => $porEsteira, 'historico_setor' => $historico,
            ]);

        case 'GET:funcionario_historico':
            $id = idObrigatorio();
            $st = $pdo->prepare(
                'SELECT s.nome AS setor, fs.data_inicio, fs.data_fim
                 FROM funcionario_setor fs JOIN setor s ON s.id_setor = fs.id_setor
                 WHERE fs.id_funcionario = ? ORDER BY fs.data_inicio'
            );
            $st->execute([$id]);
            $linhas = $st->fetchAll();
            foreach ($linhas as &$l) {
                if ($l['data_inicio'] === INICIO_HISTORICO) $l['data_inicio'] = null;
            }
            unset($l);
            responder($linhas);

        case 'GET:setor_historico':
            $id = idObrigatorio();
            $st = $pdo->prepare(
                'SELECT meta_percentual, data_inicio, data_fim FROM setor_meta WHERE id_setor = ? ORDER BY data_inicio'
            );
            $st->execute([$id]);
            $linhas = $st->fetchAll();
            foreach ($linhas as &$l) {
                $l['meta_percentual'] = (float)$l['meta_percentual'];
                if ($l['data_inicio'] === INICIO_HISTORICO) $l['data_inicio'] = null;
            }
            unset($l);
            responder($linhas);

        case 'PUT:apontamentos':
            $id = idObrigatorio();
            $d = entrada();
            $idFunc = (int)($d['id_funcionario'] ?? 0);
            $data   = (string)($d['data_registro'] ?? '');
            $dt = DateTime::createFromFormat('Y-m-d', $data);
            if (!$dt || $dt->format('Y-m-d') !== $data) erro('Data inválida (use AAAA-MM-DD).');
            if ($idFunc <= 0) erro('Selecione o funcionário.');

            $ronda  = horas($d, 'horas_ronda', true);
            $apont  = horas($d, 'horas_apontadas');
            $prod   = horas($d, 'horas_produtivas');
            $improd = horas($d, 'horas_improdutivas');
            $reparo = horas($d, 'horas_reparo');
            $flut   = horas($d, 'horas_flutuantes');

            $lista = $d['esteiras'] ?? [];
            if (!is_array($lista) || count($lista) === 0) erro('Informe ao menos uma esteira.');
            $vinculos = [];
            $soma = 0.0;
            foreach ($lista as $item) {
                $idE = (int)($item['id_esteira'] ?? 0);
                $h   = (isset($item['horas_trabalhadas_nela']) && is_numeric($item['horas_trabalhadas_nela']))
                    ? (float)$item['horas_trabalhadas_nela'] : 0.0;
                if ($idE <= 0 || $h <= 0) erro('Esteira ou horas inválidas.');
                if (isset($vinculos[$idE])) erro('A mesma esteira foi informada mais de uma vez.');
                $vinculos[$idE] = $h;
                $soma += $h;
            }
            if ($soma > $ronda + 0.001) erro('A soma das horas nas esteiras excede as horas de ronda.', 422);

            $st = $pdo->prepare('SELECT 1 FROM apontamento_diario WHERE id_apontamento = ?');
            $st->execute([$id]);
            if (!$st->fetchColumn()) erro('Apontamento não encontrado.', 404);

            $st = $pdo->prepare('SELECT 1 FROM funcionario WHERE id_funcionario = ?');
            $st->execute([$idFunc]);
            if (!$st->fetchColumn()) erro('Funcionário inexistente.', 422);

            $marcas = implode(',', array_fill(0, count($vinculos), '?'));
            $st = $pdo->prepare("SELECT COUNT(*) FROM esteira WHERE id_esteira IN ($marcas)");
            $st->execute(array_keys($vinculos));
            if ((int)$st->fetchColumn() !== count($vinculos)) erro('Alguma esteira informada não existe.', 422);

            $st = $pdo->prepare(
                'SELECT 1 FROM apontamento_diario WHERE id_funcionario = ? AND data_registro = ? AND id_apontamento <> ?'
            );
            $st->execute([$idFunc, $data, $id]);
            if ($st->fetchColumn()) erro('Esse funcionário já possui outro apontamento nessa data.', 409);

            $pdo->beginTransaction();
            try {
                $pdo->prepare(
                    'UPDATE apontamento_diario
                     SET id_funcionario = ?, data_registro = ?, horas_ronda = ?, horas_apontadas = ?,
                         horas_produtivas = ?, horas_improdutivas = ?, horas_reparo = ?, horas_flutuantes = ?
                     WHERE id_apontamento = ?'
                )->execute([$idFunc, $data, $ronda, $apont, $prod, $improd, $reparo, $flut, $id]);

                $pdo->prepare('DELETE FROM esteiras_do_dia WHERE id_apontamento = ?')->execute([$id]);
                $ins = $pdo->prepare(
                    'INSERT INTO esteiras_do_dia (id_apontamento, id_esteira, horas_trabalhadas_nela) VALUES (?, ?, ?)'
                );
                foreach ($vinculos as $idE => $h) {
                    $ins->execute([$id, $idE, $h]);
                }
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
            responder(['atualizado' => true]);

        case 'DELETE:apontamentos':
            $id = idObrigatorio();
            $st = $pdo->prepare('DELETE FROM apontamento_diario WHERE id_apontamento = ?'); // esteiras_do_dia sai em cascata
            $st->execute([$id]);
            if ($st->rowCount() === 0) erro('Apontamento não encontrado.', 404);
            responder(['excluido' => true]);

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