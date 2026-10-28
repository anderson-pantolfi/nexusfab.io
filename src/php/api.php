<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

$recurso = $_GET['recurso'] ?? '';
$metodo  = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = db();

    switch ("$metodo:$recurso") {

        // ---------- SETORES ----------
        case 'GET:setores':
            responder($pdo->query(
                'SELECT id_setor, nome, meta_percentual FROM setor ORDER BY nome'
            )->fetchAll());

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
                'INSERT INTO funcionario (id_setor, codigo_matricula, nome, cargo)
                 VALUES (?, ?, ?, ?)'
            );
            $st->execute([$idSetor, $matricula, $nome, $cargo]);
            responder(['id_funcionario' => (int)$pdo->lastInsertId()], 201);

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

            $st = $pdo->prepare(
                'INSERT INTO esteira (codigo_patrimonio, nome_descricao) VALUES (?, ?)'
            );
            $st->execute([$codigo, $desc]);
            responder(['id_esteira' => (int)$pdo->lastInsertId()], 201);

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
                // Cria o apontamento do dia ou acumula se já existir
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

                // Vincula a esteira (acumula horas se já vinculada no dia)
                $st = $pdo->prepare(
                    'INSERT INTO esteiras_do_dia (id_apontamento, id_esteira, horas_trabalhadas_nela)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        horas_trabalhadas_nela = horas_trabalhadas_nela + VALUES(horas_trabalhadas_nela)'
                );
                $st->execute([$idApont, $idEsteira, $nela]);

                // Validação: soma nas esteiras não pode passar da ronda total do dia
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
                    throw new DomainException(
                        'A soma das horas nas esteiras excede as horas de ronda do dia.'
                    );
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
        // GET api.php?recurso=dashboard&ano=2026&mes=3&id_esteira=2
        case 'GET:dashboard':
            $ano = (int)($_GET['ano'] ?? date('Y'));
            $sql = 'SELECT mes, id_esteira, nome_esteira, setor,
                           SUM(horas_ronda)        AS horas_ronda,
                           SUM(horas_produtivas)   AS horas_produtivas,
                           SUM(horas_improdutivas) AS horas_improdutivas,
                           SUM(horas_reparo)       AS horas_reparo,
                           SUM(horas_flutuantes)   AS horas_flutuantes
                    FROM vw_dashboard
                    WHERE ano = ?';
            $params = [$ano];

            if (!empty($_GET['mes']) && $_GET['mes'] !== 'todos') {
                $sql .= ' AND mes = ?';
                $params[] = (int)$_GET['mes'];
            }
            if (!empty($_GET['id_esteira']) && $_GET['id_esteira'] !== 'todas') {
                $sql .= ' AND id_esteira = ?';
                $params[] = (int)$_GET['id_esteira'];
            }
            $sql .= ' GROUP BY mes, id_esteira, nome_esteira, setor ORDER BY mes, nome_esteira';

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
            responder($linhas);

        default:
            erro('Rota não encontrada.', 404);
    }
} catch (Throwable $e) {
    error_log($e->getMessage());
    erro('Erro interno do servidor.', 500);
}
