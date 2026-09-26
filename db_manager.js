const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let electronApp;
try { electronApp = require('electron').app; } catch (e) {}

// Se estiver no Electron, usa o AppData. Se estiver no terminal, usa a pasta local.
const dirDados = electronApp ? path.join(electronApp.getPath('userData'), 'dados') : path.join(__dirname, 'dados');

if (!fs.existsSync(dirDados)) {
    fs.mkdirSync(dirDados, { recursive: true });
}

// ==========================================
// BANCO MESTRE (Guarda apenas os logins)
// ==========================================
const dbMaster = new sqlite3.Database(path.join(dirDados, 'usuarios.sqlite'), (err) => {
    if (err) console.error('❌ Erro ao conectar no Banco Mestre:', err);
    else console.log('✅ Banco Mestre de usuários conectado.');
});

dbMaster.serialize(() => {
    dbMaster.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_responsavel TEXT,
            nome_empresa TEXT,
            email TEXT UNIQUE,
            senha TEXT,
            pergunta_seguranca TEXT,
            resposta_seguranca TEXT,
            db_name TEXT
        )
    `);
});

// ==========================================
// GERENCIADOR DE BANCOS ISOLADOS (Tenants)
// ==========================================
const conexoesAtivas = {}; 

function getTenantDB(dbName) {
    if (conexoesAtivas[dbName]) return conexoesAtivas[dbName];

    const dbPath = path.join(dirDados, dbName);
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            preco_custo REAL,
            preco_venda REAL,
            estoque INTEGER,
            imagem TEXT
        )`);
        
        db.run(`ALTER TABLE produtos ADD COLUMN ativo INTEGER DEFAULT 1`, () => {});
        
        db.run(`CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id TEXT,
            produto_id INTEGER,
            quantidade INTEGER,
            valor_total REAL,
            data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
            forma_pagamento TEXT DEFAULT 'Dinheiro'
        )`);
        
        db.run(`ALTER TABLE vendas ADD COLUMN forma_pagamento TEXT DEFAULT 'Dinheiro'`, () => {});
        
        db.run(`CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            valor REAL,
            tipo TEXT,
            data_registro DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });

    conexoesAtivas[dbName] = db;
    return db;
}

// Exporta o dirDados para o server.js usar nos backups
module.exports = { dbMaster, getTenantDB, dirDados };