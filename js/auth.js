/**
 * js/auth.js
 * Gerenciamento de Autenticação com Supabase.
 */

const Auth = {
    user: null,

    async init() {
        // Verifica se já existe um usuário logado
        const { data: { session } } = await supabase.auth.getSession();
        this.user = session ? session.user : null;

        // Listener para mudanças de estado (Login/Logout)
        supabase.auth.onAuthStateChange((_event, session) => {
            this.user = session ? session.user : null;
            this.updateUI();
            if (this.user) {
                Store.loadFromSupabase(); // Carrega dados da nuvem ao logar
            } else {
                UI.refreshAll();
            }
        });

        this.updateUI();
    },

    async signUp(email, password) {
        const btn = document.querySelector('#register-form button');
        const originalText = btn.innerText;
        btn.innerText = 'Criando conta...';
        btn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            UI.showToast('Verifique seu e-mail para confirmar!');
            return data.user;
        } catch (err) {
            alert('Erro no cadastro: ' + err.message);
            UI.showToast(err.message, 'danger');
            return null;
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    async signIn(email, password) {
        const btn = document.querySelector('#login-form button');
        const originalText = btn.innerText;
        btn.innerText = 'Entrando...';
        btn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            UI.showToast('Bem-vindo!');
            return data.user;
        } catch (err) {
            alert('Erro no login: ' + err.message);
            UI.showToast(err.message, 'danger');
            return null;
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    async signOut() {
        await supabase.auth.signOut();
        this.user = null;
        UI.showToast('Sessão encerrada.');
        window.location.reload(); // Recarrega para limpar estados
    },

    updateUI() {
        const authView = document.getElementById('auth-view');
        const appContainer = document.querySelector('.app-container');

        if (this.user) {
            if (authView) authView.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            
            // Atualiza nome do usuário na sidebar
            const userNameEl = document.querySelector('.user-name');
            if (userNameEl) userNameEl.innerText = this.user.email.split('@')[0];
        } else {
            if (authView) authView.classList.remove('hidden');
            if (appContainer) appContainer.classList.add('hidden');
        }
    }
};

window.Auth = Auth;
