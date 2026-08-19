const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

db.all("SELECT id, titulo, preco_original, preco_oferta, link_afiliado, url_original FROM produtos", [], (err, rows) => {
    if (err) {
        console.error('Erro ao buscar produtos:', err);
    } else {
        console.log('--- PRODUTOS NO BANCO DE DADOS ---');
        console.dir(rows, { depth: null });
    }
    db.close();
});
