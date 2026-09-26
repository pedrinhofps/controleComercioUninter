const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs'); 
const session = require('express-session'); 
const FileStore = require('session-file-store')(session); 
const { dbMaster, getTenantDB, dirDados } = require('./db_manager'); // Puxamos o dirDados de lá

let electronApp;
try { electronApp = require('electron').app; } catch (e) {}

const dirSessoes = electronApp ? path.join(electronApp.getPath('userData'), 'dados', 'sessoes') : path.join(__dirname, 'dados', 'sessoes');
const dirUploads = electronApp ? path.join(electronApp.getPath('userData'), 'uploads') : path.join(__dirname, 'public', 'uploads');
const dirTemp = electronApp ? path.join(electronApp.getPath('userData'), 'dados', 'temp') : path.join(__dirname, 'dados', 'temp');

if (!fs.existsSync(dirSessoes)) fs.mkdirSync(dirSessoes, { recursive: true });
if (!fs.existsSync(dirUploads)) fs.mkdirSync(dirUploads, { recursive: true });
if (!fs.existsSync(dirTemp)) fs.mkdirSync(dirTemp, { recursive: true });
// ---------------------------------------

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(dirUploads)); // Libera as fotos da pasta segura

// Configurando o "Crachá" da sessão
app.use(session({
    store: new FileStore({
        path: dirSessoes, 
        retries: 0,
        logFn: function() {} 
    }),
    secret: 'pdv-super-secreto-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: null } 
}));

// ==========================================
// ROTAS ABERTAS (Registro e Login)
// ==========================================
app.post('/api/registro', async (req, res) => {
    const { nome, empresa, email, senha, pergunta, resposta } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Dados incompletos.' });

    try {
        const senhaCriptografada = await bcrypt.hash(senha, 10);
        const nomeArquivoBanco = `pdv_${Date.now()}_${Math.floor(Math.random() * 1000)}.sqlite`;

        dbMaster.run(`INSERT INTO usuarios (nome_responsavel, nome_empresa, email, senha, pergunta_seguranca, resposta_seguranca, db_name) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
        [nome, empresa, email, senhaCriptografada, pergunta, resposta.toLowerCase(), nomeArquivoBanco], function(err) {
            if (err) return res.status(400).json({ erro: 'E-mail já cadastrado.' });
            
            getTenantDB(nomeArquivoBanco); 
            req.session.userId = this.lastID;
            req.session.dbName = nomeArquivoBanco;
            res.json({ mensagem: 'Conta criada e banco de dados gerado!' });
        });
    } catch (error) { res.status(500).json({ erro: 'Erro interno no servidor.' }); }
});

app.post('/api/login', (req, res) => {
    const { email, senha, lembrar } = req.body;
    
    dbMaster.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, usuario) => {
        if (err || !usuario) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        
        try {
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            if (!senhaCorreta) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });

            req.session.cookie.maxAge = lembrar ? (1000 * 60 * 60 * 24 * 30) : null;
            req.session.userId = usuario.id;
            req.session.dbName = usuario.db_name;
            
            res.json({ mensagem: 'Login efetuado com sucesso!' });
        } catch (error) { res.status(500).json({ erro: 'Erro ao validar senha.' }); }
    });
});

app.post('/api/recuperar/etapa1', (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    dbMaster.get(`SELECT pergunta_seguranca FROM usuarios WHERE email = ?`, [email], (err, usuario) => {
        if (err || !usuario) return res.status(404).json({ erro: 'E-mail não encontrado.' });
        res.json({ pergunta: usuario.pergunta_seguranca });
    });
});

app.post('/api/recuperar/etapa2', (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const { resposta, novaSenha } = req.body;
    
    dbMaster.get(`SELECT resposta_seguranca FROM usuarios WHERE email = ?`, [email], async (err, usuario) => {
        if (err || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        if (usuario.resposta_seguranca !== resposta.trim().toLowerCase()) return res.status(401).json({ erro: 'Resposta de segurança incorreta.' });

        try {
            const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
            dbMaster.run(`UPDATE usuarios SET senha = ? WHERE email = ?`, [senhaCriptografada, email], function(err) {
                if (err) return res.status(500).json({ erro: 'Erro ao redefinir senha.' });
                res.json({ mensagem: 'Senha redefinida com sucesso!' });
            });
        } catch (error) { res.status(500).json({ erro: 'Erro interno.' }); }
    });
});

// ==========================================
// MURALHA DE SEGURANÇA (Middleware)
// ==========================================
function verificarAuth(req, res, next) {
    if (req.session && req.session.userId && req.session.dbName) {
        req.db = getTenantDB(req.session.dbName);
        next();
    } else {
        res.status(401).json({ erro: 'Acesso negado. Faça login.' });
    }
}

app.get('/api/auth/check', (req, res) => {
    if (req.session && req.session.userId) {
        dbMaster.get(`SELECT nome_responsavel, nome_empresa FROM usuarios WHERE id = ?`, [req.session.userId], (err, usuario) => {
            if (err || !usuario) return res.status(401).json({ logado: false });
            res.json({ logado: true, nome: usuario.nome_responsavel, empresa: usuario.nome_empresa });
        });
    } else {
        res.status(401).json({ logado: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ mensagem: 'Deslogado com sucesso!' });
});

// ==========================================
// CONFIGURAÇÃO DE UPLOADS
// ==========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dirUploads),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, ''))
});
const upload = multer({ storage: storage });
const uploadBackup = multer({ dest: dirTemp });

// ==========================================
// ROTAS DE PRODUTOS
// ==========================================
app.post('/api/produtos', verificarAuth, upload.single('imagem'), (req, res) => {
    const { nome, preco_custo, preco_venda, estoque, ilimitado, registrar_despesa } = req.body;
    const estoqueFinal = (ilimitado === 'true') ? -1 : (parseInt(estoque) || 0);
    let caminhoImagem = req.file ? `/uploads/${req.file.filename}` : null;
    
    req.db.run(`INSERT INTO produtos (nome, preco_custo, preco_venda, estoque, imagem) VALUES (?, ?, ?, ?, ?)`, 
    [nome, preco_custo, preco_venda, estoqueFinal, caminhoImagem], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        
        if (registrar_despesa === 'true' && estoqueFinal > 0 && preco_custo > 0) {
            req.db.run(`INSERT INTO despesas (descricao, valor, tipo) VALUES (?, ?, 'variavel')`, 
            [`Estoque Inicial: ${estoqueFinal}x ${nome}`, preco_custo * estoqueFinal]);
        }
        res.json({ id: this.lastID, mensagem: 'Cadastrado com sucesso!' });
    });
});

app.get('/api/produtos', verificarAuth, (req, res) => {
    req.db.all(`SELECT * FROM produtos WHERE ativo = 1 OR ativo IS NULL`, [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.put('/api/produtos/:id', verificarAuth, upload.single('imagem'), (req, res) => {
    const { id } = req.params;
    const { nome, preco_custo, preco_venda, estoque_adicional, ilimitado, registrar_despesa } = req.body;
    let caminhoImagem = req.file ? `/uploads/${req.file.filename}` : null;

    req.db.get(`SELECT * FROM produtos WHERE id = ?`, [id], (err, prodAntigo) => {
        if (!prodAntigo) return res.status(404).json({ erro: 'Não encontrado' });
        
        let novoEstoque = prodAntigo.estoque;
        const ajuste = parseInt(estoque_adicional) || 0;

        if (ilimitado === 'true') novoEstoque = -1;
        else if (prodAntigo.estoque === -1) novoEstoque = ajuste;
        else novoEstoque += ajuste;

        if (caminhoImagem && prodAntigo.imagem) {
            try {
                const camAntigo = path.join(dirUploads, path.basename(prodAntigo.imagem));
                if (fs.existsSync(camAntigo)) fs.unlinkSync(camAntigo);
            } catch (e) {}
        }

        const imgFinal = caminhoImagem || prodAntigo.imagem;
        req.db.run(`UPDATE produtos SET nome=?, preco_custo=?, preco_venda=?, estoque=?, imagem=? WHERE id=?`, 
        [nome, preco_custo, preco_venda, novoEstoque, imgFinal, id], function(err) {
            if (registrar_despesa === 'true' && ajuste > 0 && preco_custo > 0) {
                req.db.run(`INSERT INTO despesas (descricao, valor, tipo) VALUES (?, ?, 'variavel')`, 
                [`Entrada: ${ajuste}x ${nome}`, preco_custo * ajuste]);
            }
            res.json({ mensagem: 'Atualizado!' });
        });
    });
});

app.delete('/api/produtos/:id', verificarAuth, (req, res) => {
    req.db.get(`SELECT imagem FROM produtos WHERE id = ?`, [req.params.id], (err, prod) => {
        if (prod && prod.imagem) {
            try {
                const cam = path.join(dirUploads, path.basename(prod.imagem));
                if (fs.existsSync(cam)) fs.unlinkSync(cam);
            } catch (e) {}
        }
        req.db.run(`UPDATE produtos SET ativo = 0, imagem = null WHERE id = ?`, [req.params.id], () => res.json({ mensagem: 'Excluído!' }));
    });
});

// ==========================================
// ROTAS DE VENDAS E DESPESAS
// ==========================================
app.post('/api/vendas', verificarAuth, (req, res) => {
    const { itens, forma_pagamento } = req.body; 
    const pedido_id = 'PED-' + Date.now();
    
    req.db.serialize(() => {
        itens.forEach(item => {
            req.db.run(`INSERT INTO vendas (pedido_id, produto_id, quantidade, valor_total, forma_pagamento) VALUES (?, ?, ?, ?, ?)`, 
            [pedido_id, item.produto_id, item.quantidade, item.valor_total, forma_pagamento || 'Dinheiro']);
            
            req.db.run(`UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque != -1`, 
            [item.quantidade, item.produto_id]);
        });
        res.json({ mensagem: 'Venda finalizada!' });
    });
});

app.get('/api/vendas', verificarAuth, (req, res) => {
    const query = `
        SELECT 
            vendas.pedido_id, 
            vendas.data_venda, 
            MAX(vendas.forma_pagamento) as forma_pagamento, 
            SUM(vendas.quantidade) as total_itens, 
            SUM(vendas.valor_total) as valor_pedido, 
            GROUP_CONCAT(vendas.quantidade || 'x ' || COALESCE(produtos.nome, '[Produto Excluído]'), ' | ') as descricao_itens 
        FROM vendas 
        LEFT JOIN produtos ON vendas.produto_id = produtos.id 
        GROUP BY vendas.pedido_id 
        ORDER BY vendas.data_venda DESC
    `;
    req.db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows || []);
    });
});

app.delete('/api/vendas/:pedido_id', verificarAuth, (req, res) => {
    req.db.all(`SELECT produto_id, quantidade FROM vendas WHERE pedido_id = ?`, [req.params.pedido_id], (err, itens) => {
        req.db.serialize(() => {
            itens.forEach(item => req.db.run(`UPDATE produtos SET estoque = estoque + ? WHERE id = ? AND estoque != -1`, [item.quantidade, item.produto_id]));
            req.db.run(`DELETE FROM vendas WHERE pedido_id = ?`, [req.params.pedido_id], () => res.json({ mensagem: 'Cancelada.' }));
        });
    });
});

app.post('/api/despesas', verificarAuth, (req, res) => {
    req.db.run(`INSERT INTO despesas (descricao, valor, tipo) VALUES (?, ?, 'variavel')`, [req.body.descricao, req.body.valor], function() {
        res.json({ mensagem: 'Despesa registrada!' });
    });
});

app.get('/api/despesas', verificarAuth, (req, res) => {
    req.db.all(`SELECT * FROM despesas ORDER BY id DESC`, [], (err, rows) => res.json(rows || []));
});

app.delete('/api/despesas/:id', verificarAuth, (req, res) => {
    req.db.run(`DELETE FROM despesas WHERE id = ?`, [req.params.id], () => res.json({ mensagem: 'Removida!' }));
});

// ==========================================
// ROTAS DE PERFIL E BACKUP
// ==========================================
app.get('/api/perfil', verificarAuth, (req, res) => {
    dbMaster.get(`SELECT nome_responsavel, nome_empresa, email FROM usuarios WHERE id = ?`, [req.session.userId], (err, usuario) => {
        if (err || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        res.json(usuario);
    });
});

app.put('/api/perfil/dados', verificarAuth, (req, res) => {
    const { nome, empresa } = req.body;
    dbMaster.run(`UPDATE usuarios SET nome_responsavel = ?, nome_empresa = ? WHERE id = ?`, 
    [nome, empresa, req.session.userId], function(err) {
        if (err) return res.status(500).json({ erro: 'Erro ao atualizar perfil.' });
        res.json({ mensagem: 'Dados atualizados com sucesso!' });
    });
});

app.put('/api/perfil/senha', verificarAuth, (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    dbMaster.get(`SELECT senha FROM usuarios WHERE id = ?`, [req.session.userId], async (err, usuario) => {
        if (err || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        
        try {
            const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha);
            if (!senhaCorreta) return res.status(401).json({ erro: 'Sua senha atual está incorreta.' });
            
            const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
            dbMaster.run(`UPDATE usuarios SET senha = ? WHERE id = ?`, [senhaCriptografada, req.session.userId], function(err) {
                if (err) return res.status(500).json({ erro: 'Erro ao trocar a senha.' });
                res.json({ mensagem: 'Senha alterada com sucesso!' });
            });
        } catch (error) { res.status(500).json({ erro: 'Erro interno.' }); }
    });
});

app.post('/api/backup/exportar', verificarAuth, (req, res) => {
    const { senha } = req.body;
    dbMaster.get(`SELECT senha, db_name FROM usuarios WHERE id = ?`, [req.session.userId], async (err, usuario) => {
        if (err || !usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        
        try {
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            if (!senhaCorreta) return res.status(401).json({ erro: 'Senha incorreta. Backup bloqueado.' });

            // Usa o dirDados dinâmico que vem do db_manager
            const dbPath = path.join(dirDados, usuario.db_name);
            res.download(dbPath, `MeuCaixa_Backup_${Date.now()}.sqlite`);
        } catch (error) { res.status(500).json({ erro: 'Erro ao validar senha.' }); }
    });
});

app.post('/api/backup/importar', verificarAuth, uploadBackup.single('arquivo_backup'), (req, res) => {
    const { senha } = req.body;
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });

    dbMaster.get(`SELECT senha, db_name FROM usuarios WHERE id = ?`, [req.session.userId], async (err, usuario) => {
        try {
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            
            if (!senhaCorreta) {
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(401).json({ erro: 'Senha incorreta. Restauração bloqueada.' });
            }

            const dbPath = path.join(dirDados, usuario.db_name);
            
            fs.copyFileSync(req.file.path, dbPath);
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            
            res.json({ mensagem: 'Backup restaurado com sucesso! O sistema será atualizado.' });
        } catch (error) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ erro: 'Erro ao processar o arquivo de backup.' });
        }
    });
});

// --- INICIALIZAÇÃO ---
app.listen(PORT, () => {
    console.log(`Servidor do Sistema iniciado e aguardando a Interface...`);
});