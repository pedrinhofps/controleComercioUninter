// ==========================================
// PROTEÇÃO: SE JÁ ESTIVER LOGADO, PULA O LOGIN
// ==========================================
fetch('/api/auth/check').then(res => {
    if (res.ok) window.location.href = 'index.html'; 
});

// ==========================================
// FUNÇÕES GLOBAIS DE AUTENTICAÇÃO
// ==========================================
function togglePass(inputId, iconSpan) {
    const input = document.getElementById(inputId);
    const pathAberto = `M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z`;
    const circleAberto = `<circle cx="12" cy="12" r="3"></circle>`;
    
    const pathFechado = `M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24`;
    const lineFechado = `<line x1="1" y1="1" x2="23" y2="23"></line>`;

    if (input.type === "password") {
        input.type = "text";
        iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${pathFechado}"></path>${lineFechado}</svg>`;
    } else {
        input.type = "password";
        iconSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${pathAberto}"></path>${circleAberto}</svg>`;
    }
}

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

// Auxiliar para bloquear botões durante os envios (evita duplo clique)
function setButtonState(btn, isLoading, text = 'Aguarde...') {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerText;
        btn.innerText = text;
        btn.disabled = true;
        btn.style.opacity = '0.7';
    } else {
        btn.innerText = btn.dataset.originalText;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

// ==========================================
// LÓGICA DA TELA DE LOGIN
// ==========================================
const formLogin = document.getElementById('formLogin');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formLogin.querySelector('button[type="submit"]');
        setButtonState(btn, true, 'Entrando...');

        const email = document.getElementById('log_email').value.trim().toLowerCase();
        const senha = document.getElementById('log_senha').value;
        const lembrar = document.getElementById('log_lembrar').checked;

        try {
            const response = await fetch('/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha, lembrar })
            });
            const data = await response.json();
            
            if(response.ok) {
                showToast('✅ Acesso Liberado!', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } else {
                showToast('❌ ' + data.erro, 'error');
                setButtonState(btn, false);
            }
        } catch (error) {
            showToast('❌ Erro de conexão com o servidor.', 'error');
            setButtonState(btn, false);
        }
    });
}

// ==========================================
// LÓGICA DA TELA DE REGISTRO
// ==========================================
const formRegistro = document.getElementById('formRegistro');
if (formRegistro) {
    formRegistro.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const senha = document.getElementById('reg_senha').value;
        const senhaConfirma = document.getElementById('reg_senha_confirma').value;

        if (senha !== senhaConfirma) return showToast('❌ As senhas não são iguais.', 'error');

        const btn = formRegistro.querySelector('button[type="submit"]');
        setButtonState(btn, true, 'Criando Conta...');

        const dados = {
            nome: document.getElementById('reg_nome').value,
            empresa: document.getElementById('reg_empresa').value,
            email: document.getElementById('reg_email').value.trim().toLowerCase(),
            senha: senha,
            pergunta: document.getElementById('reg_pergunta').value,
            resposta: document.getElementById('reg_resposta').value
        };

        try {
            const response = await fetch('/api/registro', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
            });
            const data = await response.json();
            
            if(response.ok) {
                showToast('✅ Conta criada! Redirecionando...', 'success');
                setTimeout(() => window.location.href = 'index.html', 1500);
            } else {
                showToast('❌ ' + data.erro, 'error');
                setButtonState(btn, false);
            }
        } catch (error) {
            showToast('❌ Erro de conexão.', 'error');
            setButtonState(btn, false);
        }
    });
}

// ==========================================
// LÓGICA DA TELA DE RECUPERAÇÃO DE SENHA
// ==========================================
const formEtapa1 = document.getElementById('formEtapa1');
const formEtapa2 = document.getElementById('formEtapa2');
let emailConfirmado = "";

if (formEtapa1) {
    formEtapa1.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formEtapa1.querySelector('button[type="submit"]');
        setButtonState(btn, true, 'Buscando...');

        const email = document.getElementById('rec_email').value.trim().toLowerCase();

        try {
            const res = await fetch('/api/recuperar/etapa1', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (res.ok) {
                emailConfirmado = email;
                document.getElementById('texto_pergunta').innerText = data.pergunta;
                formEtapa1.style.display = 'none';
                formEtapa2.style.display = 'block';
                showToast('✅ Conta encontrada!', 'success');
            } else {
                showToast('❌ ' + data.erro, 'error');
                setButtonState(btn, false);
            }
        } catch (err) { 
            showToast('❌ Erro no servidor.', 'error'); 
            setButtonState(btn, false);
        }
    });
}

if (formEtapa2) {
    formEtapa2.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resposta = document.getElementById('rec_resposta').value;
        const novaSenha = document.getElementById('rec_senha').value;
        const senhaConfirma = document.getElementById('rec_senha_confirma').value;

        if (novaSenha !== senhaConfirma) return showToast('❌ As senhas não conferem.', 'error');

        const btn = formEtapa2.querySelector('button[type="submit"]');
        setButtonState(btn, true, 'Salvando...');

        try {
            const res = await fetch('/api/recuperar/etapa2', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ email: emailConfirmado, resposta, novaSenha })
            });
            const data = await res.json();

            if (res.ok) {
                showToast('✅ ' + data.mensagem, 'success');
                setTimeout(() => window.location.href = 'login.html', 1500);
            } else {
                showToast('❌ ' + data.erro, 'error');
                setButtonState(btn, false);
            }
        } catch (err) { 
            showToast('❌ Erro no servidor.', 'error'); 
            setButtonState(btn, false);
        }
    });
}