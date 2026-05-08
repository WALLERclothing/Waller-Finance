/**
 * js/settings.js
 * Gerencia Contas Bancárias e Categorias.
 */

const Settings = {
    editingAccountId: null,

    // ---- ACCOUNTS ----
    openAccountModal() {
        this.editingAccountId = null;
        document.getElementById('account-modal').classList.add('active');
        document.querySelector('#account-modal h2').innerText = 'Nova Conta';
    },

    openEditAccountModal(id) {
        this.editingAccountId = id;
        const acc = Store.accounts.find(a => a.id === id);
        if (!acc) return;

        document.getElementById('account-name').value = acc.name;
        document.getElementById('account-balance').value = acc.initialBalance;
        
        document.getElementById('account-modal').classList.add('active');
        document.querySelector('#account-modal h2').innerText = 'Editar Conta';
    },

    closeAccountModal() {
        this.editingAccountId = null;
        document.getElementById('account-modal').classList.remove('active');
        document.getElementById('account-form').reset();
    },

    saveAccount(formData) {
        // Garantir que o ID seja comparado como string
        const idToFind = this.editingAccountId ? String(this.editingAccountId) : null;
        
        if (idToFind) {
            const acc = Store.accounts.find(a => String(a.id) === idToFind);
            if (acc) {
                // Se o nome mudar, atualizar as transações vinculadas
                if (acc.name !== formData.name) {
                    Store.transactions.forEach(t => {
                        if (t.account === acc.name) t.account = formData.name;
                    });
                }
                acc.name = formData.name;
                acc.initialBalance = formData.initialBalance;
                UI.showToast('Conta atualizada!');
            } else {
                // Caso o ID não seja encontrado (erro inesperado), criar nova
                Store.accounts.push({
                    id: Utils.generateId().toString(),
                    name: formData.name,
                    initialBalance: formData.initialBalance
                });
                UI.showToast('Conta adicionada!');
            }
        } else {
            // Modo Criação
            Store.accounts.push({
                id: Utils.generateId().toString(),
                name: formData.name,
                initialBalance: formData.initialBalance
            });
            UI.showToast('Conta adicionada!');
        }
        
        Store.save();
        UI.refreshAll();
    },

    addAccount(formData) {
        this.saveAccount(formData);
    },

    deleteAccount(id) {
        const idStr = String(id);
        Store.accounts = Store.accounts.filter(a => String(a.id) !== idStr);
        Store.save();
        UI.refreshAll();
        UI.showToast('Conta removida!', 'danger');
    },

    // ---- ACCOUNT DETAILS MODAL ----
    currentViewingAccountId: null,

    openAccountDetailsModal(id) {
        const idStr = String(id);
        this.currentViewingAccountId = idStr;
        const acc = Store.accounts.find(a => String(a.id) === idStr);
        if (!acc) return;

        const stats = Store.getAccountStats(acc.name);
        
        document.getElementById('acc-detail-name').innerText = acc.name;
        document.getElementById('acc-detail-balance').innerText = Utils.formatCurrency(stats.balance);
        document.getElementById('acc-detail-income').innerText = Utils.formatCurrency(stats.totalIncome);
        document.getElementById('acc-detail-expense').innerText = Utils.formatCurrency(stats.totalExpense);

        // Listar transações dessa conta
        const transactionsList = document.getElementById('acc-detail-transactions');
        transactionsList.innerHTML = '';
        
        const accountTransactions = Store.transactions
            .filter(t => t.account === acc.name)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (accountTransactions.length === 0) {
            transactionsList.innerHTML = '<div class="empty-state" style="padding: 1rem;"><p style="font-size: 0.85rem;">Nenhuma transação encontrada para esta conta.</p></div>';
        } else {
            accountTransactions.forEach(t => {
                const item = document.createElement('div');
                item.classList.add('transaction-item');
                item.style.padding = '0.75rem';
                item.style.fontSize = '0.85rem';
                
                const isIncome = t.type === 'income';
                item.innerHTML = `
                    <div class="transaction-info">
                        <span class="transaction-name">${t.description}</span>
                        <span class="transaction-category">${Utils.formatDate(t.date)} • ${t.category}</span>
                    </div>
                    <div class="transaction-amount ${t.type}" style="font-weight: 600;">
                        ${isIncome ? '+' : '-'} ${Utils.formatCurrency(t.amount)}
                    </div>
                `;
                transactionsList.appendChild(item);
            });
        }

        document.getElementById('account-details-modal').classList.add('active');
        UI.initIcons();
    },

    closeAccountDetailsModal() {
        this.currentViewingAccountId = null;
        document.getElementById('account-details-modal').classList.remove('active');
    },

    openEditAccountFromDetail() {
        const id = this.currentViewingAccountId;
        this.closeAccountDetailsModal();
        this.openEditAccountModal(id);
    },

    confirmDeleteAccountFromDetail() {
        const id = this.currentViewingAccountId;
        const acc = Store.accounts.find(a => String(a.id) === String(id));
        UI.confirm(`Excluir a conta "${acc.name}" permanentemente?`, () => {
            this.deleteAccount(id);
            this.closeAccountDetailsModal();
        });
    },

    quickAdjustBalance(type) {
        const id = this.currentViewingAccountId;
        const acc = Store.accounts.find(a => String(a.id) === String(id));
        if (!acc) return;

        const action = type === 'add' ? 'adicionar' : 'remover';
        const val = window.prompt(`Quanto deseja ${action} ao saldo de "${acc.name}"? (Apenas números)`);
        
        if (val === null || val === '') return;
        
        const amount = parseFloat(val.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            UI.showToast('Valor inválido!', 'danger');
            return;
        }

        if (type === 'add') {
            acc.initialBalance += amount;
        } else {
            acc.initialBalance -= amount;
        }

        Store.save();
        this.openAccountDetailsModal(id); // Atualiza o modal de detalhes
        UI.refreshAll();
        UI.showToast(`Saldo ajustado com sucesso!`);
    },

    // ---- BACKUP & RESTORE ----
    exportData() {
        const data = {
            transactions: Store.transactions,
            cards: Store.cards,
            accounts: Store.accounts,
            categories: Store.categories,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `waller_finance_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        UI.showToast('Backup gerado com sucesso!');
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validação básica
                if (!data.transactions || !data.accounts) {
                    throw new Error('Arquivo de backup inválido');
                }

                UI.confirm('Isso substituirá todos os dados atuais. Deseja continuar?', () => {
                    Store.transactions = data.transactions;
                    Store.cards = data.cards || [];
                    Store.accounts = data.accounts || [];
                    Store.categories = data.categories || Store.categories;
                    
                    Store.save();
                    UI.refreshAll();
                    UI.showToast('Dados importados com sucesso!');
                });
            } catch (err) {
                console.error(err);
                UI.showToast('Erro ao importar arquivo!', 'danger');
            }
        };
        reader.readAsText(file);
        // Limpa o input para permitir importar o mesmo arquivo novamente se necessário
        event.target.value = '';
    },

    // ---- CATEGORIES ----
    openCategoryModal() {
        document.getElementById('category-modal').classList.add('active');
    },

    closeCategoryModal() {
        document.getElementById('category-modal').classList.remove('active');
        document.getElementById('category-form').reset();
    },

    addCategory(formData) {
        Store.categories.push({
            id: Utils.generateId(),
            name: formData.name,
            type: formData.type,
            color: formData.color,
            icon: 'tag'
        });
        Store.save();
        UI.refreshAll();
        UI.showToast('Categoria adicionada com sucesso!');
    },

    deleteCategory(id) {
        const idStr = String(id);
        if (Store.categories.length <= 1) {
            UI.showToast('Você precisa de no mínimo 1 categoria.', 'danger');
            return;
        }
        Store.categories = Store.categories.filter(c => String(c.id) !== idStr);
        Store.save();
        UI.refreshAll();
        UI.showToast('Categoria removida!', 'danger');
    },

    // ---- COUPLE MANAGEMENT ----
    updateCoupleUI() {
        const display = document.getElementById('couple-code-display');
        if (display && window.Auth && Auth.profile) {
            display.value = Auth.profile.group_id;
        }
    },

    copyCoupleCode() {
        const code = document.getElementById('couple-code-display').value;
        if (code && code !== 'Carregando...') {
            navigator.clipboard.writeText(code);
            UI.showToast('Código copiado para o parceiro!');
        }
    },

    async joinCouple() {
        const newGroupId = document.getElementById('join-couple-input').value.trim();
        if (!newGroupId) return UI.showToast('Digite um código válido.', 'danger');
        
        if (!confirm('Ao se unir, seus dados serão mesclados com o parceiro. Deseja continuar?')) return;

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ group_id: newGroupId })
                .eq('id', Auth.user.id);

            if (error) throw error;
            UI.showToast('União realizada! Recarregando...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
            UI.showToast('Erro ao unir: ' + err.message, 'danger');
        }
    }
};

window.Settings = Settings;
