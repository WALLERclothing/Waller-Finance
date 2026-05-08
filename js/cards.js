/**
 * js/cards.js
 * Gerenciamento de Cartões.
 */

const Cards = {
    editingCardId: null,

    add(formData) {
        const newCard = {
            id: Utils.generateId(),
            name: formData.name,
            last4: formData.last4,
            limit: formData.limit,
            closingDays: formData.closingDays,
            dueDate: formData.dueDate
        };
        
        Store.cards.push(newCard);
        Store.save();
        UI.refreshCards();
        UI.showToast('Cartão cadastrado com sucesso!');
    },

    update(id, formData) {
        const card = Store.cards.find(c => c.id === id);
        if (card) {
            const oldName = `${card.name} (Final ${card.last4})`;
            const newName = `${formData.name} (Final ${formData.last4})`;

            // Se o nome ou final mudar, atualizar referências nas transações
            if (oldName !== newName) {
                Store.transactions.forEach(t => {
                    if (t.card === oldName) t.card = newName;
                });
            }

            card.name = formData.name;
            card.last4 = formData.last4;
            card.limit = formData.limit;
            card.closingDays = formData.closingDays;
            card.dueDate = formData.dueDate;

            Store.save();
            UI.refreshAll();
            UI.showToast('Cartão atualizado!');
        }
    },

    delete(id) {
        Store.cards = Store.cards.filter(c => c.id !== id);
        Store.save();
        UI.refreshAll();
        UI.showToast('Cartão removido!', 'danger');
    },

    openEditModal(id) {
        const card = Store.cards.find(c => c.id === id);
        if (!card) return;

        this.editingCardId = id;
        document.getElementById('card-name').value = card.name;
        document.getElementById('card-last4').value = card.last4;
        document.getElementById('card-limit').value = card.limit;
        document.getElementById('card-closing-days').value = card.closingDays || 7;
        document.getElementById('card-due').value = card.dueDate || 1;

        document.getElementById('card-modal').classList.add('active');
        document.querySelector('#card-modal h2').innerText = 'Editar Cartão';
    },

    openInvoiceSummaryModal(cardName) {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        const card = Store.cards.find(c => `${c.name} (Final ${c.last4})` === cardName);
        if (!card) return;

        const invoiceItems = Store.transactions.filter(t => {
            if (t.card !== cardName || t.status !== 'pending') return false;
            const invoice = Utils.getInvoiceMonthYear(t.date, card.dueDate || 10, card.closingDays || 7);
            return invoice.month === App.currentMonth && invoice.year === App.currentYear;
        });
        
        const invoiceTotal = invoiceItems.reduce((sum, t) => sum + (t.amount || 0), 0);

        document.getElementById('summary-card-name').innerText = `Fatura ${cardName}`;
        document.getElementById('summary-month-name').innerText = `Fatura de ${monthNames[App.currentMonth]} de ${App.currentYear}`;
        document.getElementById('summary-total-amount').innerText = Utils.formatCurrency(invoiceTotal);

        const listDiv = document.getElementById('summary-transactions-list');
        listDiv.innerHTML = '';

        if (invoiceItems.length === 0) {
            listDiv.innerHTML = '<p style="font-size: 0.9rem; color: var(--text-secondary); text-align: center;">Nenhum lançamento pendente.</p>';
        } else {
            invoiceItems.forEach(t => {
                listDiv.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="color: var(--text-primary); font-size: 0.9rem;">${t.description}</span>
                            <span style="color: var(--text-secondary); font-size: 0.75rem;">${Utils.formatDate(t.date)}</span>
                        </div>
                        <span style="color: var(--text-primary); font-weight: 600;">${Utils.formatCurrency(t.amount)}</span>
                    </div>
                `;
            });
        }

        const btnPay = document.getElementById('btn-pay-from-summary');
        btnPay.disabled = invoiceTotal === 0;
        btnPay.style.opacity = invoiceTotal === 0 ? '0.5' : '1';
        btnPay.onclick = () => {
            this.closeInvoiceSummaryModal();
            this.openInvoiceModal(cardName, invoiceTotal);
        };

        document.getElementById('invoice-summary-modal').classList.add('active');
    },

    closeInvoiceSummaryModal() {
        document.getElementById('invoice-summary-modal').classList.remove('active');
    },

    openInvoiceModal(cardName, total) {
        document.getElementById('invoice-card-name').value = cardName;
        document.getElementById('invoice-amount').value = total.toFixed(2);
        
        const select = document.getElementById('invoice-account');
        select.innerHTML = '';
        Store.accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.name;
            opt.innerText = acc.name;
            select.appendChild(opt);
        });

        document.getElementById('invoice-date').valueAsDate = new Date();
        document.getElementById('invoice-modal').classList.add('active');
    },

    closeInvoiceModal() {
        document.getElementById('invoice-modal').classList.remove('active');
        document.getElementById('invoice-form').reset();
    },

    payInvoice(formData) {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const card = Store.cards.find(c => `${c.name} (Final ${c.last4})` === formData.cardName);
        if (!card) return;

        // Criar a transação de pagamento
        Transactions.add({
            description: `Fatura ${formData.cardName} - ${monthNames[App.currentMonth]}`,
            amount: parseFloat(formData.amount),
            type: 'expense',
            category: 'Outros',
            date: formData.date,
            account: formData.account,
            card: 'none',
            recurrence: 'none',
            paymentDate: formData.date
        });

        // Marcar todas as transações daquela fatura como pagas
        Store.transactions.forEach(t => {
            if (t.card !== formData.cardName || t.status !== 'pending') return;
            const invoice = Utils.getInvoiceMonthYear(t.date, card.dueDate || 10, card.closingDays || 7);
            
            if (invoice.month === App.currentMonth && invoice.year === App.currentYear) {
                t.status = 'paid';
                t.paymentDate = formData.date;
                t.invoicePaid = true;
            }
        });
        
        Store.save();
        UI.refreshAll();
        UI.showToast('Fatura paga com sucesso!');
        this.closeInvoiceModal();
    },

    undoInvoicePayment(cardName) {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const paymentDescription = `Fatura ${cardName} - ${monthNames[App.currentMonth]}`;

        // 1. Desfazer o status das transações
        Store.transactions.forEach(t => {
            const date = new Date((t.paymentDate || t.date) + 'T12:00:00Z');
            if (t.card === cardName && t.invoicePaid === true &&
                date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear) {
                t.status = 'pending';
                t.paymentDate = null;
                t.invoicePaid = false;
            }
        });

        // 2. Remover a transação de pagamento que foi para o extrato da conta
        Store.transactions = Store.transactions.filter(t => t.description !== paymentDescription);
        
        Store.save();
        UI.refreshAll();
        UI.showToast('Pagamento da fatura desfeito!');
    },

    openModal() {
        document.getElementById('card-modal').classList.add('active');
    },

    closeModal() {
        document.getElementById('card-modal').classList.remove('active');
        document.getElementById('card-form').reset();
    }
};

window.Cards = Cards;

// Event listeners para o formulário de cartão serão injetados no app.js
