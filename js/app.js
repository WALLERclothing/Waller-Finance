/**
 * js/app.js
 * Ponto de entrada principal da aplicação. Inicializa módulos e eventos.
 */

window.App = {
    editingId: null,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),

    changeMonth(offset) {
        this.currentMonth += offset;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        UI.refreshAll();
    },

    editingGroupId: null,

    openModalForEdit(id) {
        const idStr = String(id);
        this.editingId = idStr;
        this.editingGroupId = null;
        const t = Store.transactions.find(x => String(x.id) === idStr);
        if (!t) return;
        
        // Remover a tag de parcela (Ex: ' (1/5)') do nome para edição limpa
        const baseDescription = t.description.split(' (')[0];

        document.getElementById('description').value = baseDescription;
        document.getElementById('amount').value = t.amount !== null ? t.amount : '';
        document.getElementById('type').value = t.type;
        document.getElementById('category').value = t.category;
        document.getElementById('date').value = t.date;
        document.getElementById('transaction-account').value = t.account ? t.account : (Store.accounts.length > 0 ? Store.accounts[0].name : '');
        document.getElementById('transaction-card').value = t.card ? t.card : 'none';
        
        // Configura o meio de pagamento baseado nos dados
        const paymentMethodSelect = document.getElementById('payment-method');
        if (t.card && t.card !== 'none') {
            paymentMethodSelect.value = 'card';
        } else {
            paymentMethodSelect.value = 'account';
        }
        paymentMethodSelect.dispatchEvent(new Event('change'));

        // Bloquear edição de recorrência
        const recurrenceSelect = document.getElementById('recurrence');
        recurrenceSelect.value = t.recurrence;
        recurrenceSelect.disabled = true; 
        
        if (t.recurrence === 'installment' && t.installmentInfo) {
            document.getElementById('installments').value = t.installmentInfo.total;
        }

        if (t.recurrence === 'recurring' && t.amount === null) {
            document.getElementById('recurring-type').value = 'variable';
        } else if (t.recurrence === 'recurring') {
            document.getElementById('recurring-type').value = 'fixed';
        }

        const paymentDateGroup = document.getElementById('payment-date-group');
        const paymentDateInput = document.getElementById('payment-date');
        if (t.status === 'paid') {
            paymentDateGroup.classList.remove('hidden');
            paymentDateInput.value = t.paymentDate || t.date;
        } else {
            paymentDateGroup.classList.add('hidden');
            paymentDateInput.value = '';
        }

        recurrenceSelect.dispatchEvent(new Event('change'));

        document.getElementById('modal-overlay').classList.add('active');
        document.querySelector('#modal-overlay .modal-header h2').innerText = 'Editar Transação';
    },

    openModalForEditGroup(groupId) {
        const gidStr = String(groupId);
        this.editingGroupId = gidStr;
        this.editingId = null;
        const groupItems = Store.transactions.filter(x => String(x.groupId) === gidStr);
        if (groupItems.length === 0) return;
        const t = groupItems[0];
        
        const baseDescription = t.description.split(' (')[0];

        document.getElementById('description').value = baseDescription;
        document.getElementById('amount').value = groupItems.reduce((acc, i) => acc + i.amount, 0).toFixed(2);
        document.getElementById('type').value = t.type;
        document.getElementById('category').value = t.category;
        document.getElementById('date').value = t.date;
        document.getElementById('transaction-account').value = t.account ? t.account : (Store.accounts.length > 0 ? Store.accounts[0].name : '');
        document.getElementById('transaction-card').value = t.card ? t.card : 'none';
        
        // Configura o meio de pagamento baseado nos dados
        const paymentMethodSelect = document.getElementById('payment-method');
        if (t.card && t.card !== 'none') {
            paymentMethodSelect.value = 'card';
        } else {
            paymentMethodSelect.value = 'account';
        }
        paymentMethodSelect.dispatchEvent(new Event('change'));
        
        const recurrenceSelect = document.getElementById('recurrence');
        recurrenceSelect.value = t.recurrence;
        recurrenceSelect.disabled = true; 
        
        if (t.recurrence === 'installment' && t.installmentInfo) {
            document.getElementById('installments').value = t.installmentInfo.total;
        } else if (t.recurrence === 'recurring') {
            document.getElementById('recurring-type').value = (t.amount === null) ? 'variable' : 'fixed';
        }

        // Grupos não mostram data de pagamento unificada no form
        document.getElementById('payment-date-group').classList.add('hidden');
        document.getElementById('payment-date').value = '';

        recurrenceSelect.dispatchEvent(new Event('change'));

        document.getElementById('modal-overlay').classList.add('active');
        document.querySelector('#modal-overlay .modal-header h2').innerText = 'Editar Grupo';
    },

    closeModal() {
        this.editingId = null;
        this.editingGroupId = null;
        document.getElementById('modal-overlay').classList.remove('active');
        document.getElementById('transaction-form').reset();
        document.querySelector('#modal-overlay .modal-header h2').innerText = 'Nova Transação';
        
        const recurrenceSelect = document.getElementById('recurrence');
        recurrenceSelect.disabled = false;
        
        const amountInput = document.getElementById('amount');
        amountInput.required = true;
        amountInput.disabled = false;
        amountInput.placeholder = "0.00";
        
        document.getElementById('installments-group').classList.add('hidden');
        document.getElementById('recurring-type-group').classList.add('hidden');
        document.getElementById('payment-date-group').classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    
    // Elementos do Modal
    const modalOverlay = document.getElementById('modal-overlay');
    const form = document.getElementById('transaction-form');
    const closeModalBtn = document.getElementById('close-modal');
    
    // Elementos Dinâmicos do Form
    const recurrenceSelect = document.getElementById('recurrence');
    const installmentsGroup = document.getElementById('installments-group');
    const recurringTypeGroup = document.getElementById('recurring-type-group');
    const recurringTypeSelect = document.getElementById('recurring-type');
    const amountInput = document.getElementById('amount');
    const typeSelect = document.getElementById('type');
    const accountRow = document.getElementById('transaction-account').closest('.form-row');
    const cardGroup = document.getElementById('transaction-card').closest('.form-group');
    const searchInput = document.getElementById('search-input');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            UI.refreshTransactionsList(e.target.value);
        });
    }

    const paymentMethodSelect = document.getElementById('payment-method');
    const groupPaymentMethod = document.getElementById('group-payment-method');
    const groupAccount = document.getElementById('group-account');
    const groupCard = document.getElementById('group-card');

    if (paymentMethodSelect) {
        paymentMethodSelect.addEventListener('change', (e) => {
            if (e.target.value === 'card') {
                groupCard.classList.remove('hidden');
                groupAccount.classList.add('hidden');
            } else {
                groupCard.classList.add('hidden');
                groupAccount.classList.remove('hidden');
            }
        });
    }

    const updateModalUIByType = (type) => {
        const modalTitle = document.querySelector('#modal-overlay .modal-header h2');
        const submitBtn = document.querySelector('#transaction-form .btn-submit');
        const typeGroup = document.getElementById('group-type');
        const labelDate = document.getElementById('label-date');
        const labelAccount = document.getElementById('label-account');
        const installmentsOption = document.querySelector('#recurrence option[value="installment"]');

        typeSelect.value = type;
        typeGroup.classList.add('hidden'); // Sempre esconde o seletor de tipo, pois usamos os botões específicos
        
        UI.populateCategorySelect(type);

        if (type === 'income') {
            modalTitle.innerText = App.editingId ? 'Editar Receita' : 'Nova Receita';
            submitBtn.innerText = App.editingId ? 'Atualizar Receita' : 'Confirmar Receita';
            
            // Receitas geralmente não vão para o cartão
            groupPaymentMethod.classList.add('hidden');
            paymentMethodSelect.value = 'account';
            groupCard.classList.add('hidden');
            groupAccount.classList.remove('hidden');

            labelDate.innerText = 'Data do Recebimento';
            labelAccount.innerText = 'Entrou na Conta';
            if (installmentsOption) installmentsOption.disabled = true;
            if (recurrenceSelect.value === 'installment') recurrenceSelect.value = 'none';
        } else {
            modalTitle.innerText = App.editingId ? 'Editar Despesa' : 'Nova Despesa';
            submitBtn.innerText = App.editingId ? 'Atualizar Despesa' : 'Confirmar Despesa';
            
            groupPaymentMethod.classList.remove('hidden');
            paymentMethodSelect.dispatchEvent(new Event('change')); // Triggers card/account visibility based on current selection

            labelDate.innerText = 'Data (Vencimento/Compra)';
            labelAccount.innerText = 'Sair da Conta';
            if (installmentsOption) installmentsOption.disabled = false;
        }

        recurrenceSelect.dispatchEvent(new Event('change'));
    };

    typeSelect.addEventListener('change', (e) => updateModalUIByType(e.target.value));

    // Inicializa Navegação
    Navigation.init();

    // Eventos do Filtro de Mês
    document.getElementById('prev-month').addEventListener('click', () => App.changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => App.changeMonth(1));

    document.getElementById('open-modal-income').addEventListener('click', () => {
        App.editingId = null;
        modalOverlay.classList.add('active');
        document.getElementById('date').valueAsDate = new Date();
        updateModalUIByType('income');
    });

    document.getElementById('open-modal-expense').addEventListener('click', () => {
        App.editingId = null;
        modalOverlay.classList.add('active');
        document.getElementById('date').valueAsDate = new Date();
        updateModalUIByType('expense');
    });
    
    document.getElementById('mobile-open-modal').addEventListener('click', () => {
        App.editingId = null;
        modalOverlay.classList.add('active');
        document.getElementById('date').valueAsDate = new Date();
        updateModalUIByType('expense'); // Mobile FAB defaults to Expense
    });

    closeModalBtn.addEventListener('click', () => App.closeModal());
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) App.closeModal();
    });

    // Lógica para mostrar/esconder campos baseado na repetição
    recurrenceSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        installmentsGroup.classList.add('hidden');
        recurringTypeGroup.classList.add('hidden');
        amountInput.required = true;
        amountInput.disabled = false;

        if (val === 'installment') {
            installmentsGroup.classList.remove('hidden');
        } else if (val === 'recurring') {
            recurringTypeGroup.classList.remove('hidden');
            // Check recurring type current value
            if (recurringTypeSelect.value === 'variable') {
                amountInput.required = false;
                amountInput.disabled = true;
                amountInput.value = '';
                amountInput.placeholder = "Informar ao pagar";
            }
        }
    });

    // Run once on load to set initial state
    recurrenceSelect.dispatchEvent(new Event('change'));

    // Lógica para tipo de recorrência (Fixo ou Variável)
    recurringTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'variable') {
            amountInput.required = false;
            amountInput.disabled = true;
            amountInput.value = '';
            amountInput.placeholder = "Informar ao pagar";
        } else {
            amountInput.required = true;
            amountInput.disabled = false;
            amountInput.placeholder = "0.00";
        }
    });

    // Submissão do Formulário
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Coleta os dados do formulário
        const paymentMethod = document.getElementById('payment-method').value;
        const formData = {
            description: document.getElementById('description').value,
            amount: amountInput.value,
            type: document.getElementById('type').value,
            category: document.getElementById('category').value,
            date: document.getElementById('date').value,
            account: paymentMethod === 'account' ? document.getElementById('transaction-account').value : 'none',
            card: paymentMethod === 'card' ? document.getElementById('transaction-card').value : 'none',
            recurrence: recurrenceSelect.value,
            installments: document.getElementById('installments').value,
            recurringType: recurringTypeSelect.value,
            paymentDate: document.getElementById('payment-date').value || null
        };

        if (App.editingId !== null) {
            Transactions.update(App.editingId, formData);
        } else if (App.editingGroupId !== null) {
            Transactions.updateGroup(App.editingGroupId, formData);
        } else {
            Transactions.add(formData);
        }
        
        App.closeModal();
    });

    // Submissão do Formulário de Cartão
    document.getElementById('card-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('card-name').value,
            last4: document.getElementById('card-last4').value,
            limit: parseFloat(document.getElementById('card-limit').value) || 0,
            closingDays: parseInt(document.getElementById('card-closing-days').value) || 7,
            dueDate: parseInt(document.getElementById('card-due').value) || 1
        };
        
        if (Cards.editingCardId) {
            Cards.update(Cards.editingCardId, formData);
        } else {
            Cards.add(formData);
        }
        Cards.closeModal();
    });

    // Lógica para excluir mutualmente Cartão e Conta
    const txCardSelect = document.getElementById('transaction-card');
    const txAccountSelect = document.getElementById('transaction-account');

    txCardSelect.addEventListener('change', (e) => {
        if (e.target.value !== 'none') {
            txAccountSelect.value = 'none';
        }
    });

    txAccountSelect.addEventListener('change', (e) => {
        if (e.target.value !== 'none') {
            txCardSelect.value = 'none';
        }
    });

    // Submissão do Formulário de Pagamento de Fatura
    document.getElementById('invoice-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            cardName: document.getElementById('invoice-card-name').value,
            amount: document.getElementById('invoice-amount').value,
            account: document.getElementById('invoice-account').value,
            date: document.getElementById('invoice-date').value
        };
        Cards.payInvoice(formData);
    });

    // Submissão do Formulário de Categoria
    document.getElementById('category-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('category-name').value,
            type: document.getElementById('category-type').value,
            color: document.getElementById('category-color').value
        };
        Settings.addCategory(formData);
        Settings.closeCategoryModal();
    });

    // Submissão do Formulário de Conta
    document.getElementById('account-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            name: document.getElementById('account-name').value,
            initialBalance: parseFloat(document.getElementById('account-balance').value) || 0
        };
        Settings.addAccount(formData);
        Settings.closeAccountModal();
    });

    // Fechar modais clicando fora
    const cardModalOverlay = document.getElementById('card-modal');
    cardModalOverlay.addEventListener('click', (e) => {
        if (e.target === cardModalOverlay) Cards.closeModal();
    });

    const accountModalOverlay = document.getElementById('account-modal');
    accountModalOverlay.addEventListener('click', (e) => {
        if (e.target === accountModalOverlay) Settings.closeAccountModal();
    });

    const categoryModalOverlay = document.getElementById('category-modal');
    categoryModalOverlay.addEventListener('click', (e) => {
        if (e.target === categoryModalOverlay) Settings.closeCategoryModal();
    });

    const invoiceModalOverlay = document.getElementById('invoice-modal');
    invoiceModalOverlay.addEventListener('click', (e) => {
        if (e.target === invoiceModalOverlay) Cards.closeInvoiceModal();
    });

    const invoiceSummaryModalOverlay = document.getElementById('invoice-summary-modal');
    invoiceSummaryModalOverlay.addEventListener('click', (e) => {
        if (e.target === invoiceSummaryModalOverlay) Cards.closeInvoiceSummaryModal();
    });

    const accountDetailsModalOverlay = document.getElementById('account-details-modal');
    accountDetailsModalOverlay.addEventListener('click', (e) => {
        if (e.target === accountDetailsModalOverlay) Settings.closeAccountDetailsModal();
    });

    // Menu de Usuário
    const userProfileTrigger = document.getElementById('user-profile-trigger');
    const userDropdown = document.getElementById('user-dropdown');
    const btnLogout = document.getElementById('btn-logout');

    if (userProfileTrigger) {
        userProfileTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.signOut();
        });
    }

    // Atalho para Configurações no Dropdown
    const btnSettingsShortcut = document.getElementById('btn-settings-shortcut');
    if (btnSettingsShortcut) {
        btnSettingsShortcut.addEventListener('click', (e) => {
            e.preventDefault();
            Navigation.navigateTo('settings');
            userDropdown.classList.remove('active');
        });
    }

    // Fecha dropdown ao clicar fora
    window.addEventListener('click', () => {
        if (userDropdown && userDropdown.classList.contains('active')) {
            userDropdown.classList.remove('active');
        }
    });

    // Auth Listeners
    if (document.getElementById('show-register')) {
        document.getElementById('show-register').onclick = (e) => {
            e.preventDefault();
            document.getElementById('login-form-container').classList.add('hidden');
            document.getElementById('register-form-container').classList.remove('hidden');
        };
    }
    if (document.getElementById('show-login')) {
        document.getElementById('show-login').onclick = (e) => {
            e.preventDefault();
            document.getElementById('register-form-container').classList.add('hidden');
            document.getElementById('login-form-container').classList.remove('hidden');
        };
    }

    // Login Form Submit
    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        await Auth.signIn(email, pass);
    };

    // Register Form Submit
    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const pass = document.getElementById('register-password').value;
        await Auth.signUp(email, pass);
    };

    // Inicializa a UI
    Store.init();
    Auth.init(); // Inicializa Auth após Store
    UI.refreshAll();
    if (window.Shopping) Shopping.init();

    if (document.getElementById('btn-monthly-report')) {
        document.getElementById('btn-monthly-report').addEventListener('click', () => {
            Reports.openMonthlyReport();
        });
    }
});

