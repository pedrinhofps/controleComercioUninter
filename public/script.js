// ==========================================
// FUNÇÕES GLOBAIS
// ==========================================
function showToast(mensagem, tipo) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.innerText = mensagem;
    toast.className = `show ${tipo}`;
    setTimeout(() => toast.className = toast.className.replace('show', '').trim(), 3000);
}

// PROTEÇÃO DE TELA E DADOS DO USUÁRIO
let nomeEmpresaGlobal = "Minha Empresa"; 

fetch('/api/auth/check')
    .then(async res => {
        if (!res.ok) {
            window.location.href = 'login.html'; 
        } else {
            const dadosUsuario = await res.json();
            nomeEmpresaGlobal = dadosUsuario.empresa; 
            
            const tituloEmpresa = document.getElementById('display_nome_empresa');
            if (tituloEmpresa) tituloEmpresa.innerText = nomeEmpresaGlobal;
             
        }
    })
    .catch(() => window.location.href = 'login.html');

// ==========================================
// --- LÓGICA DO DASHBOARD E RELATÓRIOS ---
// ==========================================
const elReceitas = document.querySelector('.text-green');
const elDespesas = document.querySelector('.text-red');
const elLucro = document.querySelector('.text-blue');

const radioDiario = document.querySelector('input[value="diario"]');
const radioMensal = document.querySelector('input[value="mensal"]');
const boxDiario = document.getElementById('controle_diario');
const boxMensal = document.getElementById('controle_mensal');

const inputDataFiltro = document.getElementById('data_filtro');
const selectMes = document.getElementById('mes_select');
const inputAno = document.getElementById('ano_select');
const btnExportar = document.getElementById('btn_exportar');

let dadosVendasFiltrados = [];
let dadosDespesasFiltrados = [];

if (inputDataFiltro) {
    const dataLocal = new Date();
    dataLocal.setMinutes(dataLocal.getMinutes() - dataLocal.getTimezoneOffset()); 
    
    inputDataFiltro.value = dataLocal.toISOString().split('T')[0]; 
    selectMes.value = String(dataLocal.getMonth() + 1).padStart(2, '0');
    inputAno.value = dataLocal.getFullYear();
    
    radioDiario.addEventListener('change', alternarVisao);
    radioMensal.addEventListener('change', alternarVisao);
    
    inputDataFiltro.addEventListener('change', carregarDashboard);
    selectMes.addEventListener('change', carregarDashboard);
    inputAno.addEventListener('input', carregarDashboard);
}

function alternarVisao() {
    boxDiario.style.display = radioDiario.checked ? 'flex' : 'none';
    boxMensal.style.display = radioDiario.checked ? 'none' : 'flex';
    carregarDashboard();
}

async function carregarDashboard() {
    if (!elReceitas) return;
    try {
        const [resVendas, resDespesas] = await Promise.all([
            fetch('/api/vendas'),
            fetch('/api/despesas')
        ]);
        
        const todasVendas = await resVendas.json();
        const todasDespesas = await resDespesas.json();

        const isDiario = radioDiario.checked;
        let fAno, fMes, fDia;
        
        if (isDiario) {
            const parts = inputDataFiltro.value.split('-'); 
            fAno = parts[0]; fMes = parts[1]; fDia = parts[2];
        } else {
            fAno = inputAno.value.toString(); fMes = selectMes.value;
        }

        dadosVendasFiltrados = todasVendas.filter(v => {
            const dObj = new Date(v.data_venda + 'Z');
            const vAno = dObj.getFullYear().toString();
            const vMes = String(dObj.getMonth() + 1).padStart(2, '0');
            const vDia = String(dObj.getDate()).padStart(2, '0');
            return isDiario ? (vAno === fAno && vMes === fMes && vDia === fDia) : (vAno === fAno && vMes === fMes);
        });

        dadosDespesasFiltrados = todasDespesas.filter(d => {
            const dObj = new Date((d.data_despesa || d.data || d.data_registro) + 'Z');
            const dAno = dObj.getFullYear().toString();
            const dMes = String(dObj.getMonth() + 1).padStart(2, '0');
            const dDia = String(dObj.getDate()).padStart(2, '0');
            return isDiario ? (dAno === fAno && dMes === fMes && dDia === fDia) : (dAno === fAno && dMes === fMes);
        });

        const totalReceitas = dadosVendasFiltrados.reduce((acc, v) => acc + v.valor_pedido, 0);
        const totalDespesas = dadosDespesasFiltrados.reduce((acc, d) => acc + d.valor, 0);
        const lucroLiquido = totalReceitas - totalDespesas;

        elReceitas.innerText = `R$ ${totalReceitas.toFixed(2).replace('.', ',')}`;
        elDespesas.innerText = `R$ ${totalDespesas.toFixed(2).replace('.', ',')}`;
        elLucro.innerText = `R$ ${lucroLiquido.toFixed(2).replace('.', ',')}`;
    } catch (error) { console.error('Erro dashboard:', error); }
}

if (btnExportar) {
    btnExportar.addEventListener('click', () => {
        const isDiario = radioDiario.checked;
        let tituloRelatorio = '';
        
        if (isDiario) {
            const parts = inputDataFiltro.value.split('-');
            tituloRelatorio = `Fechamento Diário - ${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            const nomeMes = selectMes.options[selectMes.selectedIndex].text;
            tituloRelatorio = `Resumo Mensal - ${nomeMes} de ${inputAno.value}`;
        }

        let somaRec = dadosVendasFiltrados.reduce((acc, v) => acc + v.valor_pedido, 0);
        let somaDesp = dadosDespesasFiltrados.reduce((acc, d) => acc + d.valor, 0);
        let lucro = somaRec - somaDesp;

        let html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>${tituloRelatorio}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 20px; max-width: 800px; margin: auto; }
                h1 { text-align: center; color: #2c3e50; margin-bottom: 5px; }
                p.subtitle { text-align: center; font-size: 18px; margin-top: 0; color: #7f8c8d; margin-bottom: 20px; }
                h2 { color: #34495e; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px; margin-top: 30px; font-size: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background-color: #f8f9fa; color: #2c3e50; }
                .valor { text-align: right; white-space: nowrap; }
                .text-green { color: #27ae60; }
                .text-red { color: #e74c3c; }
                .text-blue { color: #2980b9; }
                .resumo-box { display: flex; justify-content: space-between; background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 40px; border: 1px solid #ddd; }
                .resumo-item { text-align: center; width: 33%; }
                .resumo-item span { display: block; font-size: 24px; font-weight: bold; margin-top: 10px; }
                .info-block { background: #f4f6f7; padding: 15px 20px; border-left: 5px solid #27ae60; font-size: 18px; border-radius: 4px; margin-bottom: 20px;}
                .btn-imprimir { display: block; width: 220px; margin: 0 auto 30px auto; padding: 12px; background: #2c3e50; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; transition: 0.2s; text-align: center; }
                .btn-imprimir:hover { background: #34495e; }
                @media print { .no-print { display: none !important; } }
            </style>
        </head>
        <body>
            <button class="no-print btn-imprimir" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
            <h1>${nomeEmpresaGlobal}</h1>
            <h2 style="text-align: center; margin-top: -5px; color: #34495e; font-size: 22px;">Relatório Financeiro</h2>
            <p class="subtitle">${tituloRelatorio}</p>
        `;

        if (isDiario) {
            html += `<h2>Receitas (Vendas Detalhadas)</h2><table><thead><tr><th>Hora</th><th>Descrição</th><th class="valor">Valor (R$)</th></tr></thead><tbody>`;
            if (dadosVendasFiltrados.length === 0) {
                html += `<tr><td colspan="3" style="text-align: center;">Nenhuma venda registrada.</td></tr>`;
            } else {
                dadosVendasFiltrados.forEach(v => {
                    const hora = new Date(v.data_venda + 'Z').toLocaleTimeString('pt-BR');
                    html += `<tr><td>${hora}</td><td>${v.descricao_itens}</td><td class="valor text-green">+ ${v.valor_pedido.toFixed(2).replace('.', ',')}</td></tr>`;
                });
            }
            html += `</tbody></table>`;
        } else {
            html += `<h2>Entradas (Resumo de Vendas)</h2>
            <div class="info-block">
                O total bruto arrecadado com as vendas deste mês foi de: 
                <strong class="text-green" style="float: right;">R$ ${somaRec.toFixed(2).replace('.', ',')}</strong>
            </div>`;
        }

        html += `<h2>Despesas e Custos</h2><table><thead><tr><th>Data</th><th>Descrição</th><th class="valor">Valor (R$)</th></tr></thead><tbody>`;
        if (dadosDespesasFiltrados.length === 0) {
            html += `<tr><td colspan="3" style="text-align: center;">Nenhuma despesa registrada.</td></tr>`;
        } else {
            dadosDespesasFiltrados.forEach(d => {
                const dataObj = new Date((d.data_despesa || d.data || d.data_registro) + 'Z').toLocaleString('pt-BR');
                html += `<tr><td>${dataObj}</td><td>${d.descricao}</td><td class="valor text-red">- ${d.valor.toFixed(2).replace('.', ',')}</td></tr>`;
            });
        }
        html += `</tbody></table>
            <div class="resumo-box">
                <div class="resumo-item">Receitas <span class="text-green">R$ ${somaRec.toFixed(2).replace('.', ',')}</span></div>
                <div class="resumo-item">Despesas <span class="text-red">R$ ${somaDesp.toFixed(2).replace('.', ',')}</span></div>
                <div class="resumo-item">Lucro Líquido <span class="text-blue">R$ ${lucro.toFixed(2).replace('.', ',')}</span></div>
            </div>
        </body>
        </html>`;

        const janela = window.open('', '_blank');
        janela.document.write(html);
        janela.document.close();
        janela.focus();
    });
}

if(inputDataFiltro) carregarDashboard();

// ==========================================
// --- LÓGICA DE CADASTRO DE PRODUTOS ---
// ==========================================
const formProduto = document.getElementById('formProduto');
if (formProduto) {
    formProduto.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        const checkIlimitado = document.getElementById('check_ilimitado');
        const checkDespesa = document.getElementById('check_despesa');
        const custoInput = document.getElementById('preco_custo');
        
        const isIlimitado = checkIlimitado ? checkIlimitado.checked : false;
        const precoCustoNum = parseFloat(custoInput.value.replace(',', '.')) || 0;

        if (!isIlimitado && precoCustoNum <= 0) return showToast('❌ O preço de custo não pode ser zero.', 'error');

        const formData = new FormData();
        formData.append('nome', document.getElementById('nome').value);
        formData.append('preco_custo', precoCustoNum);
        formData.append('preco_venda', parseFloat(document.getElementById('preco_venda').value.replace(',', '.')));
        formData.append('estoque', parseInt(document.getElementById('estoque').value) || 0);
        formData.append('ilimitado', isIlimitado);
        formData.append('registrar_despesa', checkDespesa ? checkDespesa.checked : false);

        const fileInput = document.getElementById('imagem_cadastro');
        if (fileInput && fileInput.files[0]) formData.append('imagem', fileInput.files[0]);

        try {
            const response = await fetch('/api/produtos', { method: 'POST', body: formData });
            const data = await response.json();
            
            if(response.ok) {
                showToast('✅ ' + data.mensagem, 'success');
                formProduto.reset(); 
                document.getElementById('estoque').disabled = false;
                custoInput.disabled = false; 
                if (typeof carregarEstoqueCompleto === "function") carregarEstoqueCompleto();
            } else { showToast('❌ Erro: ' + data.erro, 'error'); }
        } catch (error) { showToast('❌ Erro no servidor.', 'error'); }
    });
}

// ==========================================
// --- LÓGICA DE VENDAS (FRENTE DE CAIXA) ---
// ==========================================
const formAdicionarItem = document.getElementById('formAdicionarItem');
const inputBusca = document.getElementById('busca_produto');
const hiddenProdutoId = document.getElementById('produto_id');
const dropdownProdutos = document.getElementById('dropdown_produtos');
const inputQuantidade = document.getElementById('quantidade_venda');
const inputTotal = document.getElementById('valor_total_display');
const divListaCarrinho = document.getElementById('listaCarrinho');
const spanTotalPedido = document.getElementById('valorTotalPedido');
const btnFinalizarVenda = document.getElementById('btnFinalizarVenda');

let produtosCarregados = [];
let carrinho = [];

function fecharDropdown() { if (dropdownProdutos) dropdownProdutos.style.display = 'none'; }

function selecionarProduto(id, nomeCurto) {
    hiddenProdutoId.value = id; 
    inputBusca.value = nomeCurto; 
    inputTotal.dataset.nome = nomeCurto; 
    fecharDropdown(); 
    calcularSubtotal(); 
    if(inputQuantidade) inputQuantidade.focus(); 
}

function renderizarDropdown(lista) {
    if (!dropdownProdutos) return;
    dropdownProdutos.innerHTML = '';
    const produtosComEstoqueReal = lista.map(prod => {
        const itemNoCarrinho = carrinho.find(item => item.produto_id === prod.id);
        const qtdCarrinho = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;
        return {
            ...prod,
            estoque_real: prod.estoque === -1 ? -1 : prod.estoque - qtdCarrinho 
        };
    }).filter(prod => prod.estoque_real > 0 || prod.estoque_real === -1); 
    
    if (produtosComEstoqueReal.length === 0) {
        dropdownProdutos.innerHTML = '<div style="padding: 10px; color: #7f8c8d;">Nenhum produto disponível...</div>';
        dropdownProdutos.style.display = 'block';
        return;
    }

    produtosComEstoqueReal.forEach(prod => {
        const div = document.createElement('div');
        const txtEstoque = prod.estoque_real === -1 ? 'Ilimitado' : prod.estoque_real;
        div.innerText = `${prod.nome} (Estoque: ${txtEstoque} | R$ ${prod.preco_venda.toFixed(2).replace('.', ',')})`;
        div.style.cssText = 'padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; transition: background 0.2s;';
        div.onmouseover = () => div.style.backgroundColor = '#f0f2f5';
        div.onmouseout = () => div.style.backgroundColor = 'transparent';
        div.onclick = () => selecionarProduto(prod.id, prod.nome);
        dropdownProdutos.appendChild(div);
    });
    dropdownProdutos.style.display = 'block';
}

async function carregarProdutosParaVenda() {
    if (inputBusca) {
        try {
            const response = await fetch('/api/produtos');
            produtosCarregados = await response.json();
        } catch (e) { console.error('Erro ao carregar produtos', e); }
    }
}

if (inputBusca) {
    inputBusca.addEventListener('focus', function() { inputBusca.value = ''; hiddenProdutoId.value = ''; calcularSubtotal(); renderizarDropdown(produtosCarregados); });
    inputBusca.addEventListener('input', function() {
        hiddenProdutoId.value = ''; calcularSubtotal();
        const termo = this.value.toLowerCase();
        renderizarDropdown(produtosCarregados.filter(prod => prod.nome.toLowerCase().includes(termo)));
    });
    document.addEventListener('click', function(e) { if (e.target !== inputBusca && e.target !== dropdownProdutos) fecharDropdown(); });
}

function calcularSubtotal() {
    if (hiddenProdutoId && inputQuantidade && inputTotal) {
        const produtoId = hiddenProdutoId.value;
        const quantidade = parseInt(inputQuantidade.value) || 0;
        if (produtoId && quantidade > 0) {
            const prod = produtosCarregados.find(p => p.id == produtoId);
            if (prod) {
                const total = prod.preco_venda * quantidade;
                inputTotal.value = `R$ ${total.toFixed(2).replace('.', ',')}`;
                inputTotal.dataset.valor = total;
                inputTotal.dataset.estoque = prod.estoque; 
            }
        } else { inputTotal.value = ''; inputTotal.dataset.valor = 0; inputTotal.dataset.estoque = 0; }
    }
}
if (inputQuantidade) inputQuantidade.addEventListener('input', calcularSubtotal);

if (formAdicionarItem) {
    formAdicionarItem.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!hiddenProdutoId.value) return showToast('❌ Selecione um produto!', 'error');

        const idDesejado = parseInt(hiddenProdutoId.value);
        const quantidadeDesejada = parseInt(inputQuantidade.value);
        const estoqueTotal = parseInt(inputTotal.dataset.estoque);

        let quantidadeJaNoCarrinho = 0;
        const itemExistente = carrinho.find(item => item.produto_id === idDesejado);
        if (itemExistente) quantidadeJaNoCarrinho = itemExistente.quantidade;

        if (estoqueTotal !== -1 && (quantidadeDesejada + quantidadeJaNoCarrinho) > estoqueTotal) {
            return showToast(`❌ Limite excedido! Faltam unidades.`, 'error');
        }

        if (itemExistente) {
            itemExistente.quantidade += quantidadeDesejada;
            itemExistente.valor_total += parseFloat(inputTotal.dataset.valor);
        } else {
            carrinho.push({ produto_id: idDesejado, nome: inputTotal.dataset.nome, quantidade: quantidadeDesejada, valor_total: parseFloat(inputTotal.dataset.valor) });
        }

        atualizarVisorCarrinho();
        formAdicionarItem.reset();
        hiddenProdutoId.value = ''; inputTotal.value = ''; inputBusca.focus(); 
    });
}

function removerItemCarrinho(index) { carrinho.splice(index, 1); atualizarVisorCarrinho(); }

function atualizarVisorCarrinho() {
    if (!divListaCarrinho) return;
    if (carrinho.length === 0) { divListaCarrinho.innerHTML = '<p style="text-align: center; color: #7f8c8d; margin-top: 40px;">O carrinho está vazio</p>'; spanTotalPedido.innerText = 'R$ 0,00'; return; }
    
    let html = '<ul style="list-style: none; padding: 0;">';
    let somaTotal = 0;
    carrinho.forEach((item, index) => {
        somaTotal += item.valor_total;
        html += `<li style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #ccc; padding: 10px 0; font-size: 18px;">
            <span>🛒 ${item.quantidade}x ${item.nome}</span>
            <div><strong style="margin-right: 15px;">R$ ${item.valor_total.toFixed(2).replace('.', ',')}</strong> <button type="button" style="background:none; border:none; color:#e74c3c; font-size:18px; cursor:pointer;" onclick="removerItemCarrinho(${index})">❌</button></div>
        </li>`;
    });
    divListaCarrinho.innerHTML = html + '</ul>';
    spanTotalPedido.innerText = `R$ ${somaTotal.toFixed(2).replace('.', ',')}`;
}

if (btnFinalizarVenda) {
    btnFinalizarVenda.addEventListener('click', async function() {
        if (carrinho.length === 0) return showToast('❌ Carrinho vazio!', 'error');
        
        // Pega a forma de pagamento selecionada
        const selectPagamento = document.getElementById('forma_pagamento');
        const forma_pagamento = selectPagamento ? selectPagamento.value : 'Dinheiro';

        try {
            const response = await fetch('/api/vendas', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ itens: carrinho, forma_pagamento: forma_pagamento }) // Envia pro servidor
            });
            if(response.ok) { 
                showToast('✅ Venda Registrada!', 'success'); 
                carrinho = []; 
                atualizarVisorCarrinho(); 
                carregarProdutosParaVenda(); 
            } 
        } catch (error) { showToast('❌ Erro ao finalizar venda.', 'error'); }
    });
}
if (formAdicionarItem) carregarProdutosParaVenda();

// ==========================================
// --- LÓGICA DE GESTÃO DE ESTOQUE (PRODUTOS) ---
// ==========================================
const tabelaEstoque = document.getElementById('corpoTabelaEstoque');
const inputBuscaEstoque = document.getElementById('busca_estoque');
const modalEdicao = document.getElementById('modalEdicao');
const formEditarProduto = document.getElementById('formEditarProduto');
const btnFecharModalEdicao = document.getElementById('btnFecharModalEdicao');
let listaDeEstoqueGlobais = []; 

function renderizarTabelaEstoque(lista) {
    if (!tabelaEstoque) return;
    tabelaEstoque.innerHTML = '';
    if(lista.length === 0) { tabelaEstoque.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum item.</td></tr>'; return; }

    lista.forEach(prod => {
        let imagemHtml = prod.imagem 
            ? `<img src="${prod.imagem}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px; border: 1px solid #ddd;">`
            : `<div style="width: 50px; height: 50px; background: #ecf0f1; border-radius: 5px; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #7f8c8d; text-align: center; line-height: 1.2; font-weight: bold;">Sem<br>Foto</div>`;
        
        const txtEstoque = prod.estoque === -1 ? '<span style="color:#2980b9;">∞ Ilimitado</span>' : prod.estoque + ' un.';
        
        tabelaEstoque.innerHTML += `
            <tr>
                <td>${imagemHtml}</td>
                <td>${prod.nome}</td>
                <td>R$ ${prod.preco_custo.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${prod.preco_venda.toFixed(2).replace('.', ',')}</td>
                <td><strong>${txtEstoque}</strong></td>
                <td>
                    <button onclick="abrirModalEdicao(${prod.id})" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; margin-right: 5px;">✏️ Editar</button>
                    <button onclick="abrirModalExclusaoProduto(${prod.id})" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer;">🗑️</button>
                </td>
            </tr>
        `;
    });
}

async function carregarEstoqueCompleto() {
    if (!tabelaEstoque) return;
    try {
        const response = await fetch('/api/produtos');
        listaDeEstoqueGlobais = await response.json();
        renderizarTabelaEstoque(listaDeEstoqueGlobais);
    } catch (error) { console.error('Erro ao carregar estoque', error); }
}

if (inputBuscaEstoque) {
    inputBuscaEstoque.addEventListener('input', function() {
        renderizarTabelaEstoque(listaDeEstoqueGlobais.filter(prod => prod.nome.toLowerCase().includes(this.value.toLowerCase())));
    });
}

function abrirModalEdicao(id) {
    const produto = listaDeEstoqueGlobais.find(p => p.id === id);
    if (produto && modalEdicao) {
        document.getElementById('edit_id').value = produto.id;
        document.getElementById('edit_nome').value = produto.nome;
        document.getElementById('span_estoque_atual').innerHTML = produto.estoque === -1 ? '∞ Ilimitado' : produto.estoque + ' un.';
        
        const inputCusto = document.getElementById('edit_preco_custo');
        inputCusto.value = produto.preco_custo.toFixed(2).replace('.', ',');
        document.getElementById('edit_preco_venda').value = produto.preco_venda.toFixed(2).replace('.', ',');
        
        const isIlimitado = (produto.estoque === -1);
        const inputAdicional = document.getElementById('edit_estoque_adicional');
        
        if (inputAdicional) {
            inputAdicional.value = '';
            inputAdicional.disabled = isIlimitado;
        }
        
        inputCusto.disabled = isIlimitado; 
        
        const chkIlim = document.getElementById('edit_check_ilimitado');
        if(chkIlim) chkIlim.checked = isIlimitado;
        
        const chkDesp = document.getElementById('edit_check_despesa');
        if(chkDesp) chkDesp.checked = false;

        modalEdicao.style.display = 'flex';
    }
}

if (btnFecharModalEdicao) { btnFecharModalEdicao.addEventListener('click', () => { modalEdicao.style.display = 'none'; }); }

if (formEditarProduto) {
    formEditarProduto.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit_id').value;
        const formData = new FormData(formEditarProduto);
        
        const chkIlim = document.getElementById('edit_check_ilimitado');
        const chkDesp = document.getElementById('edit_check_despesa');
        const isIlimitadoEdit = chkIlim ? chkIlim.checked : false;
        
        const custoStr = formData.get('preco_custo') || document.getElementById('edit_preco_custo').value;
        const custoNum = parseFloat(custoStr.replace(',', '.')) || 0;

        if (!isIlimitadoEdit && custoNum <= 0) return showToast('❌ O preço de custo não pode ser zero.', 'error');
        
        formData.append('ilimitado', isIlimitadoEdit);
        formData.append('registrar_despesa', chkDesp ? chkDesp.checked : false);
        formData.set('preco_custo', custoNum);
        formData.set('preco_venda', formData.get('preco_venda').replace(',', '.'));

        try {
            const response = await fetch(`/api/produtos/${id}`, { method: 'PUT', body: formData });
            if (response.ok) { showToast('✅ Salvo!', 'success'); modalEdicao.style.display = 'none'; carregarEstoqueCompleto(); } 
        } catch (error) { showToast('❌ Erro.', 'error'); }
    });
}

if(tabelaEstoque) carregarEstoqueCompleto(); 

// ==========================================
// --- LÓGICA DE EXCLUSÃO DE PRODUTO ---
// ==========================================
const modalConfirmacaoProduto = document.getElementById('modalConfirmacaoProduto');
const btnFecharModalExclusaoProd = document.getElementById('btnFecharModalExclusaoProd');
const btnConfirmarExclusaoProd = document.getElementById('btnConfirmarExclusaoProd');
let produtoIdParaExcluir = null;

function abrirModalExclusaoProduto(id) {
    produtoIdParaExcluir = id;
    if (modalConfirmacaoProduto) modalConfirmacaoProduto.style.display = 'flex';
}

if (btnFecharModalExclusaoProd) {
    btnFecharModalExclusaoProd.addEventListener('click', () => {
        modalConfirmacaoProduto.style.display = 'none';
        produtoIdParaExcluir = null;
    });
}

if (btnConfirmarExclusaoProd) {
    btnConfirmarExclusaoProd.addEventListener('click', async () => {
        if (!produtoIdParaExcluir) return;
        try {
            const response = await fetch(`/api/produtos/${produtoIdParaExcluir}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) { showToast('✅ ' + data.mensagem, 'success'); carregarEstoqueCompleto(); } 
            else { showToast('❌ Erro: ' + data.erro, 'error'); }
        } catch (error) { showToast('❌ Erro.', 'error'); } 
        finally { modalConfirmacaoProduto.style.display = 'none'; produtoIdParaExcluir = null; }
    });
}

// ==========================================
// --- LÓGICA DO HISTÓRICO DE VENDAS ---
// ==========================================
const tabelaHistorico = document.getElementById('corpoTabelaHistorico');
const modalConfirmacao = document.getElementById('modalConfirmacao');
const btnFecharModal = document.getElementById('btnFecharModal');
const btnConfirmarExclusao = document.getElementById('btnConfirmarExclusao');
let pedidoIdParaExcluir = null; 

async function carregarHistorico() {
    if (!tabelaHistorico) return;
    try {
        const response = await fetch('/api/vendas');
        const vendas = await response.json();
        tabelaHistorico.innerHTML = ''; 
        if (vendas.length === 0) { tabelaHistorico.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma venda registada.</td></tr>'; return; }

        vendas.forEach(venda => {
            const dataFormatada = new Date(venda.data_venda + 'Z').toLocaleString('pt-BR');
            tabelaHistorico.innerHTML += `
                <tr>
                    <td>${dataFormatada}</td>
                    <td><span style="font-size: 14px; line-height: 1.6;">${venda.descricao_itens}</span></td>
                    <td><strong>${venda.total_itens} un.</strong></td>
                    <td class="text-green" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>R$ ${venda.valor_pedido.toFixed(2).replace('.', ',')}</strong>
                            <div style="font-size: 12px; color: #7f8c8d; margin-top: 3px;">Pagamento: ${venda.forma_pagamento || 'Dinheiro'}</div>
                        </div>
                        <button onclick="abrirModalExclusao('${venda.pedido_id}')" style="background: none; border: none; cursor: pointer; font-size: 16px; color: #e74c3c; margin-left: 10px;">❌</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { showToast('❌ Erro ao carregar o histórico.', 'error'); }
}

function abrirModalExclusao(pedido_id) {
    pedidoIdParaExcluir = pedido_id;
    if (modalConfirmacao) modalConfirmacao.style.display = 'flex';
}

if (btnFecharModal) { btnFecharModal.addEventListener('click', () => { modalConfirmacao.style.display = 'none'; pedidoIdParaExcluir = null; }); }

if (btnConfirmarExclusao) {
    btnConfirmarExclusao.addEventListener('click', async () => {
        if (!pedidoIdParaExcluir) return;
        try {
            const response = await fetch(`/api/vendas/${pedidoIdParaExcluir}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) { showToast('✅ ' + data.mensagem, 'success'); carregarHistorico(); } 
            else { showToast('❌ Erro: ' + data.erro, 'error'); }
        } catch (error) { showToast('❌ Erro.', 'error'); } 
        finally { modalConfirmacao.style.display = 'none'; pedidoIdParaExcluir = null; }
    });
}
if (tabelaHistorico) carregarHistorico();

// ==========================================
// --- LÓGICA DE CONTROLE DE DESPESAS ---
// ==========================================
const formDespesa = document.getElementById('formDespesa');
const tabelaDespesas = document.getElementById('corpoTabelaDespesas');
const modalConfirmacaoDespesa = document.getElementById('modalConfirmacaoDespesa');
let despesaIdParaExcluir = null;

async function carregarDespesas() {
    if (!tabelaDespesas) return;
    try {
        const response = await fetch('/api/despesas');
        const despesas = await response.json();
        tabelaDespesas.innerHTML = '';
        if (despesas.length === 0) { tabelaDespesas.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #7f8c8d;">Nenhuma despesa registrada.</td></tr>'; return; }

        despesas.forEach(d => {
            const dataBruta = d.data_despesa || d.data || d.data_registro;
            const dataFormatada = dataBruta ? new Date(dataBruta + 'Z').toLocaleString('pt-BR') : '-';
            tabelaDespesas.innerHTML += `
                <tr>
                    <td>${dataFormatada}</td>
                    <td>${d.descricao}</td>
                    <td class="text-red"><strong>R$ ${d.valor.toFixed(2).replace('.', ',')}</strong></td>
                    <td>
                        <button onclick="abrirModalExclusaoDespesa(${d.id})" style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer;">🗑️</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) { showToast('❌ Erro ao carregar despesas.', 'error'); }
}

if (formDespesa) {
    formDespesa.addEventListener('submit', async (e) => {
        e.preventDefault();
        const descricao = document.getElementById('desc_despesa').value;
        const valor = parseFloat(document.getElementById('valor_despesa').value.replace(',', '.'));

        try {
            const response = await fetch('/api/despesas', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descricao, valor }) 
            });
            const data = await response.json();
            
            if (response.ok) { 
                showToast('✅ ' + data.mensagem, 'success'); 
                formDespesa.reset(); 
                carregarDespesas(); 
            } else { showToast('❌ Erro: ' + data.erro, 'error'); }
        } catch (error) { showToast('❌ Erro de conexão.', 'error'); }
    });
}

function abrirModalExclusaoDespesa(id) {
    despesaIdParaExcluir = id;
    if (modalConfirmacaoDespesa) modalConfirmacaoDespesa.style.display = 'flex';
}

const btnFecharModalDespesa = document.getElementById('btnFecharModalDespesa');
if (btnFecharModalDespesa) {
    btnFecharModalDespesa.addEventListener('click', () => { modalConfirmacaoDespesa.style.display = 'none'; despesaIdParaExcluir = null; });
}

const btnConfirmarExclusaoDespesa = document.getElementById('btnConfirmarExclusaoDespesa');
if (btnConfirmarExclusaoDespesa) {
    btnConfirmarExclusaoDespesa.addEventListener('click', async () => {
        if (!despesaIdParaExcluir) return;
        try {
            const response = await fetch(`/api/despesas/${despesaIdParaExcluir}`, { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) { showToast('✅ ' + data.mensagem, 'success'); carregarDespesas(); } 
            else { showToast('❌ Erro: ' + data.erro, 'error'); }
        } catch (error) { showToast('❌ Erro ao excluir.', 'error'); } 
        finally { modalConfirmacaoDespesa.style.display = 'none'; despesaIdParaExcluir = null; }
    });
}
if (tabelaDespesas) carregarDespesas();

// ==========================================
// LÓGICA DO MEU PERFIL E LOGOUT
// ==========================================
async function fazerLogout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'login.html';
    } catch (e) { console.error(e); }
}

const formPerfilDados = document.getElementById('formPerfilDados');
if (formPerfilDados) {
    fetch('/api/perfil').then(res => res.json()).then(data => {
        if(data.email) {
            document.getElementById('perfil_email').value = data.email;
            document.getElementById('perfil_nome').value = data.nome_responsavel;
            document.getElementById('perfil_empresa').value = data.nome_empresa;
        }
    }).catch(() => {});

    formPerfilDados.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('perfil_nome').value;
        const empresa = document.getElementById('perfil_empresa').value;

        try {
            const res = await fetch('/api/perfil/dados', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, empresa })
            });
            const data = await res.json();
            if (res.ok) {
                showToast('✅ ' + data.mensagem, 'success');
                document.getElementById('display_nome_empresa').innerText = empresa; 
            } else { showToast('❌ ' + data.erro, 'error'); }
        } catch (err) { showToast('❌ Erro no servidor.', 'error'); }
    });
}

const formPerfilSenha = document.getElementById('formPerfilSenha');
if (formPerfilSenha) {
    formPerfilSenha.addEventListener('submit', async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById('senha_atual').value;
        const novaSenha = document.getElementById('nova_senha').value;
        const novaSenhaConfirma = document.getElementById('nova_senha_confirma').value;

        if (novaSenha !== novaSenhaConfirma) return showToast('❌ As senhas novas não conferem.', 'error');

        try {
            const res = await fetch('/api/perfil/senha', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senhaAtual, novaSenha })
            });
            const data = await res.json();
            
            if (res.ok) {
                showToast('✅ ' + data.mensagem, 'success');
                formPerfilSenha.reset(); 
            } else { showToast('❌ ' + data.erro, 'error'); }
        } catch (err) { showToast('❌ Erro no servidor.', 'error'); }
    });
}

// ==========================================
// LÓGICA DE BACKUP E RESTAURAÇÃO
// ==========================================
const btnExportarDb = document.getElementById('btn_exportar_db');
const inputImportar = document.getElementById('arquivo_importar');

if (btnExportarDb) {
    btnExportarDb.addEventListener('click', async () => {
        const senha = document.getElementById('senha_backup').value;
        if (!senha) return showToast('❌ Digite sua senha para autorizar o Backup.', 'error');

        showToast('⏳ Gerando backup...', 'success');
        
        try {
            const res = await fetch('/api/backup/exportar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senha })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const dataHoje = new Date().toISOString().split('T')[0];
                a.download = `Backup_Sistema_${dataHoje}.sqlite`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                document.getElementById('senha_backup').value = ''; 
                showToast('✅ Backup realizado com sucesso!', 'success');
            } else {
                const data = await res.json();
                showToast('❌ ' + data.erro, 'error');
            }
        } catch (err) { showToast('❌ Erro de conexão.', 'error'); }
    });

    inputImportar.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const senha = document.getElementById('senha_backup').value;
        if (!senha) {
            inputImportar.value = ''; 
            return showToast('❌ Digite sua senha antes de selecionar o arquivo.', 'error');
        }

        if (!file.name.endsWith('.sqlite')) {
            inputImportar.value = '';
            return showToast('❌ Arquivo inválido! Selecione um backup .sqlite', 'error');
        }

        const confirmacao = await showConfirmModal(
            'Atenção aos Dados', 
            'A restauração apagará todos os dados atuais (vendas, despesas e produtos) e os substituirá pelos dados do backup. Tem certeza que deseja continuar?'
        );

        if (!confirmacao) {
            inputImportar.value = ''; 
            return;
        }

        const formData = new FormData();
        formData.append('senha', senha);
        formData.append('arquivo_backup', file);

        showToast('⏳ Restaurando sistema...', 'success');

        try {
            const res = await fetch('/api/backup/importar', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                showToast('✅ ' + data.mensagem, 'success');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showToast('❌ ' + data.erro, 'error');
                inputImportar.value = '';
            }
        } catch (err) { 
            showToast('❌ Erro no servidor.', 'error'); 
            inputImportar.value = '';
        }
    });
}

// ==========================================
//            MODAL CUSTOMIZADO 
// ==========================================
function showConfirmModal(titulo, mensagem) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '9999';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';

        const modal = document.createElement('div');
        modal.style.backgroundColor = '#fff';
        modal.style.padding = '30px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
        modal.style.maxWidth = '400px';
        modal.style.width = '90%';
        modal.style.textAlign = 'center';
        modal.style.transform = 'translateY(-30px)';
        modal.style.transition = 'transform 0.3s ease';

        modal.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 10px;">⚠️</div>
            <h3 style="margin-top: 0; color: #2c3e50; font-size: 22px;">${titulo}</h3>
            <p style="color: #7f8c8d; font-size: 15px; margin-bottom: 25px; line-height: 1.5;">${mensagem}</p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="btn_cancelar_modal" style="padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; background: #ecf0f1; color: #7f8c8d; font-size: 15px; font-weight: bold; flex: 1; transition: 0.2s;">Cancelar</button>
                <button id="btn_confirmar_modal" style="padding: 12px 20px; border: none; border-radius: 8px; cursor: pointer; background: #e74c3c; color: white; font-size: 15px; font-weight: bold; flex: 1; transition: 0.2s;">Sim, Restaurar</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'translateY(0)';
        }, 10);

        document.getElementById('btn_cancelar_modal').addEventListener('click', () => {
            fecharModal();
            resolve(false); 
        });

        document.getElementById('btn_confirmar_modal').addEventListener('click', () => {
            fecharModal();
            resolve(true); 
        });

        function fecharModal() {
            overlay.style.opacity = '0';
            modal.style.transform = 'translateY(-30px)';
            setTimeout(() => document.body.removeChild(overlay), 300);
        }
    });
}