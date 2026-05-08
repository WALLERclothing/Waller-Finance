/**
 * js/auth.js
 * Gerenciamento de Autenticação com Supabase.
 */

const Auth = {
    user: null,
    profile: null, // Armazena o group_id e outros dados do perfil

    async init() {
        // Monitora mudanças no estado de autenticação
        supabase.auth.onAuthStateChange(async (event, session) => {
            this.user = session?.user || null;
            if (this.user) {
                await this.loadProfile();
                await Store.loadFromSupabase();
            } else {
                this.profile = null;
                UI.refreshAll();
            }
            this.updateUI();
        });

        // Verifica estado inicial
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.user = session.user;
            await this.loadProfile();
            await Store.loadFromSupabase();
        }
        this.updateUI();
    },

    async loadProfile() {
        if (!this.user) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', this.user.id)
            .single();
        
        if (!error && data) {
            this.profile = data;
        } else if (error && error.code === 'PGRST116') {
            // Se perfil não existe, tenta criar um (fallback)
            const { data: newProfile } = await supabase
                .from('profiles')
                .insert([{ id: this.user.id, email: this.user.email }])
                .select()
                .single();
            if (newProfile) this.profile = newProfile;
        }
    },

    async signUp(email, password) {
        const btn = document.querySelector('#register-form button');
        const originalText = btn.innerText;
        btn.innerText = 'Criando conta...';
        btn.disabled = true;

        try {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            
            // Sucesso Visual
            document.getElementById('register-form-container').innerHTML = `
                <div style="text-align: center; padding: 1rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📧</div>
                    <h2 style="margin-bottom: 1rem;">Quase lá!</h2>
                    <p style="color: var(--text-secondary); line-height: 1.5;">
                        Enviamos um e-mail de confirmação para <strong>${email}</strong>.<br><br>
                        Clique no link que enviamos para ativar sua conta e depois faça o login.
                    </p>
                    <button onclick="location.reload()" class="btn-primary" style="width: 100%; margin-top: 2rem;">Voltar para o Login</button>
                </div>
            `;
            
            UI.showToast('Verifique seu e-mail!');
            return data.user;
        } catch (err) {
            alert('Erro no cadastro: ' + err.message);
            UI.showToast(err.message, 'danger');
            return null;
        } finally {
            if (document.querySelector('#register-form button')) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
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
            const avatarEl = document.querySelector('.avatar');
            
            if (userNameEl) {
                const name = this.user.email.split('@')[0];
                userNameEl.innerText = name.charAt(0).toUpperCase() + name.slice(1);
            }
            
            if (avatarEl) {
                avatarEl.innerText = this.user.email.substring(0, 2).toUpperCase();
            }
        } else {
            if (authView) authView.classList.remove('hidden');
            if (appContainer) appContainer.classList.add('hidden');
        }
    }
};

window.Auth = Auth;
