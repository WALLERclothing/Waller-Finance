/**
 * js/store.js
 * Gerencia o estado da aplicação e a persistência no LocalStorage.
 */

const Store = {
    transactions: [],
    cards: [],
    accounts: [],
    shoppingItems: [],
    categories: [
        { id: '1', name: 'Alimentação', color: '#ff5252', icon: 'coffee', type: 'expense' },
        { id: '2', name: 'Moradia', color: '#3B82F6', icon: 'home', type: 'expense' },
        { id: '3', name: 'Lazer', color: '#8B5CF6', icon: 'smile', type: 'expense' },
        { id: '4', name: 'Salário', color: '#10B981', icon: 'dollar-sign', type: 'income' },
        { id: '5', name: 'Transporte', color: '#F59E0B', icon: 'car', type: 'expense' },
        { id: '6', name: 'Saúde', color: '#EF4444', icon: 'heart', type: 'expense' },
        { id: '7', name: 'Compras', color: '#EC4899', icon: 'shopping-bag', type: 'expense' },
        { id: '8', name: 'Investimentos', color: '#10B981', icon: 'trending-up', type: 'income' },
        { id: '9', name: 'Presente', color: '#8B5CF6', icon: 'gift', type: 'income' },
        { id: '10', name: 'Outros', color: '#6B7280', icon: 'more-horizontal', type: 'both' }
    ],

    // Inicializa carregando dados salvos com Tratamento de Erro
    init() {
        try {
            const storedTransactions = localStorage.getItem('waller_transactions');
            this.transactions = storedTransactions ? JSON.parse(storedTransactions) : [];
            
            const storedCards = localStorage.getItem('waller_cards');
            this.cards = storedCards ? JSON.parse(storedCards) : [];

            const storedAccounts = localStorage.getItem('waller_accounts');
            this.accounts = storedAccounts ? JSON.parse(storedAccounts) : [{ id: '1', name: 'Carteira / Dinheiro Físico', initialBalance: 0 }];

            const storedCategories = localStorage.getItem('waller_categories');
            this.categories = storedCategories ? JSON.parse(storedCategories) : this.categories;

            const storedShopping = localStorage.getItem('waller_shopping');
            this.shoppingItems = storedShopping ? JSON.parse(storedShopping) : [];

            this.runMigrations();
        } catch (e) {
            console.error("Erro ao carregar dados do LocalStorage:", e);
            UI.showToast("Erro ao carregar dados. Usando banco vazio.", "danger");
        }
    },

    // Centraliza todas as migrações de dados
    runMigrations() {
        let modified = false;

        // 1. IDs como Strings e Status de Cartão
        this.transactions.forEach(t => {
            if (typeof t.id !== 'string') { t.id = String(t.id); modified = true; }
            if (t.groupId && typeof t.groupId !== 'string') { t.groupId = String(t.groupId); modified = true; }
            
            // Correção de status para cartões (Compras únicas não devem ser "paid" sozinhas)
            if (t.card && t.card !== 'none' && t.recurrence === 'none' && t.status === 'paid' && !t.invoicePaid) {
                t.status = 'pending';
                t.paymentDate = null;
                modified = true;
            }
        });

        // 2. Integridade dos Cartões
        this.cards.forEach(card => {
            if (typeof card.id !== 'string') { card.id = String(card.id); modified = true; }
            if (card.limit === undefined) { card.limit = 0; modified = true; }
            if (card.dueDate === undefined) { card.dueDate = 10; modified = true; }
            if (card.closingDays === undefined) { card.closingDays = 7; modified = true; }
        });

        // 3. Integridade das Contas
        this.accounts.forEach(acc => {
            if (typeof acc.id !== 'string') { acc.id = String(acc.id); modified = true; }
            if (acc.initialBalance === undefined) { acc.initialBalance = 0; modified = true; }
        });

        if (modified) this.save();
    },

    // Salva o estado atual
    save() {
        try {
            localStorage.setItem('waller_transactions', JSON.stringify(this.transactions));
            localStorage.setItem('waller_cards', JSON.stringify(this.cards));
            localStorage.setItem('waller_accounts', JSON.stringify(this.accounts));
            localStorage.setItem('waller_categories', JSON.stringify(this.categories));
            localStorage.setItem('waller_shopping', JSON.stringify(this.shoppingItems));
            
            this.syncAllToSupabase();
        } catch (e) {
            console.error("Erro ao salvar no LocalStorage:", e);
            UI.showToast("Erro ao salvar dados!", "danger");
        }
    },

    async syncAllToSupabase() {
        if (!window.Auth || !Auth.user || !Auth.profile) return;
        try {
            const userId = Auth.user.id;
            const groupId = Auth.profile.group_id;
            
            const prepare = (list) => list.map(item => ({ 
                ...item, 
                user_id: userId,
                group_id: groupId 
            }));
            
            await supabase.from('accounts').upsert(prepare(this.accounts));
            await supabase.from('cards').upsert(prepare(this.cards));
            await supabase.from('transactions').upsert(prepare(this.transactions));
            await supabase.from('shopping_items').upsert(prepare(this.shoppingItems));
        } catch (err) {
            console.error("Erro Supabase Sync:", err);
        }
    },

    async loadFromSupabase() {
        if (!window.Auth || !Auth.user || !Auth.profile) return;
        
        try {
            const groupId = Auth.profile.group_id;

            // Carrega Contas do Grupo
            const { data: accounts } = await supabase
                .from('accounts')
                .select('*')
                .eq('group_id', groupId);
            
            // Carrega Cartões do Grupo
            const { data: cards } = await supabase
                .from('cards')
                .select('*')
                .eq('group_id', groupId);

            // Carrega Transações do Grupo
            const { data: transactions } = await supabase
                .from('transactions')
                .select('*')
                .eq('group_id', groupId);

            // Carrega Itens de Compra do Grupo
            const { data: shoppingItems } = await supabase
                .from('shopping_items')
                .select('*')
                .eq('group_id', groupId);

            if (accounts) this.accounts = accounts;
            if (cards) this.cards = cards;
            if (transactions) this.transactions = transactions;
            if (shoppingItems) this.shoppingItems = shoppingItems;

            this.saveLocalOnly(); // Salva no LocalStorage para cache offline
            UI.refreshAll();
        } catch (e) {
            console.error("Erro ao carregar do Supabase:", e);
        }
    },

    // Salva apenas no LocalStorage sem disparar nova sincronização
    saveLocalOnly() {
        localStorage.setItem('waller_transactions', JSON.stringify(this.transactions));
        localStorage.setItem('waller_cards', JSON.stringify(this.cards));
        localStorage.setItem('waller_accounts', JSON.stringify(this.accounts));
        localStorage.setItem('waller_categories', JSON.stringify(this.categories));
        localStorage.setItem('waller_shopping', JSON.stringify(this.shoppingItems));
    },

    // Adiciona uma nova transação
    addTransaction(transaction) {
        if (!transaction.id) transaction.id = Utils.generateId();
        this.transactions.push(transaction);
        this.save();
    },

    // Remove uma transação pelo ID
    deleteTransaction(id) {
        const idStr = String(id);
        this.transactions = this.transactions.filter(t => String(t.id) !== idStr);
        this.save();
    },

    // Retorna todas as transações ordenadas por data
    getSortedTransactions() {
        return [...this.transactions].sort((a, b) => {
            const dateA = new Date(a.date + 'T12:00:00Z');
            const dateB = new Date(b.date + 'T12:00:00Z');
            return (dateB.getTime() || 0) - (dateA.getTime() || 0);
        });
    },

    getAccountStats(accountName) {
        const acc = this.accounts.find(a => a.name === accountName);
        if (!acc) return { balance: 0, totalIncome: 0, totalExpense: 0 };

        const transactions = this.transactions.filter(t => t.account === accountName && t.status === 'paid');
        
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        return {
            balance: acc.initialBalance + income - expense,
            totalIncome: income,
            totalExpense: expense
        };
    }
};

