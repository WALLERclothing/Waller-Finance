/**
 * js/transactions.js
 * Lógica de negócios para transações (Inclusão, Parcelamentos, Recorrências).
 */

const Transactions = {
    // Adiciona transação (Trata parcelamento e recorrência)
    add(formData) {
        const baseAmount = parseFloat(formData.amount);
        const recurrenceType = formData.recurrence;
        const installmentsCount = parseInt(formData.installments) || 1;
        const startDate = formData.date;

        // Helper para definir status baseado na data
        const getStatus = (dateStr) => Utils.isFutureDate(dateStr) ? 'pending' : 'paid';

        if (recurrenceType === 'installment') {
            const installmentValue = baseAmount / installmentsCount;
            const groupId = Utils.generateId();
            
            for (let i = 0; i < installmentsCount; i++) {
                const date = Utils.addMonthsToDate(startDate, i);
                Store.addTransaction({
                    id: Utils.generateId(),
                    groupId: groupId,
                    description: `${formData.description} (Parcela ${i + 1}/${installmentsCount})`,
                    amount: installmentValue,
                    type: formData.type,
                    category: formData.category,
                    date: date,
                    account: formData.account,
                    card: formData.card,
                    recurrence: 'installment',
                    installmentInfo: { current: i + 1, total: installmentsCount },
                    status: getStatus(date)
                });
            }
            UI.showToast(`${installmentsCount} parcelas adicionadas com sucesso!`);
            
        } else if (recurrenceType === 'recurring') {
            const recurringType = formData.recurringType;
            const amountToUse = recurringType === 'variable' ? null : baseAmount;
            const groupId = Utils.generateId();
            
            // Gera para os próximos 12 meses
            for (let i = 0; i < 12; i++) {
                const date = Utils.addMonthsToDate(startDate, i);
                Store.addTransaction({
                    id: Utils.generateId(),
                    groupId: groupId,
                    description: formData.description,
                    amount: amountToUse,
                    type: formData.type,
                    category: formData.category,
                    date: date,
                    account: formData.account,
                    card: formData.card,
                    recurrence: 'recurring',
                    recurringType: recurringType,
                    status: amountToUse === null ? 'pending' : getStatus(date)
                });
            }
            UI.showToast(`Conta recorrente programada para os próximos 12 meses!`);
            
        } else {
            Store.addTransaction({
                id: Utils.generateId(),
                description: formData.description,
                amount: baseAmount,
                type: formData.type,
                category: formData.category,
                date: startDate,
                account: formData.account,
                card: formData.card,
                recurrence: 'none',
                // Sempre pago para transações à vista (exceto cartão)
                status: (formData.card && formData.card !== 'none') ? 'pending' : 'paid',
                paymentDate: (formData.card && formData.card !== 'none') ? null : startDate
            });
            UI.showToast('Transação adicionada com sucesso!');
        }

        UI.refreshAll();
    },
    // Atualiza transação existente
    update(id, formData) {
        const idStr = String(id);
        const t = Store.transactions.find(x => String(x.id) === idStr);
        if (t) {
            // Preservar a tag de parcela se existir
            if (t.recurrence === 'installment' && t.installmentInfo) {
                t.description = `${formData.description} (Parcela ${t.installmentInfo.current}/${t.installmentInfo.total})`;
            } else {
                t.description = formData.description;
            }
            
            t.amount = formData.amount ? parseFloat(formData.amount) : (t.amount || 0);
            t.type = formData.type;
            t.category = formData.category;
            t.date = formData.date;
            t.account = formData.account;
            t.card = formData.card;

            if (formData.paymentDate) {
                t.paymentDate = formData.paymentDate;
            } else if (t.status === 'paid' && !t.paymentDate) {
                t.paymentDate = t.date;
            }

            if (t.recurrence === 'none') {
                if (t.card && t.card !== 'none') {
                    t.status = 'pending';
                    t.paymentDate = null;
                } else {
                    t.status = 'paid';
                    t.paymentDate = formData.paymentDate || t.date;
                }
            }
            
            Store.save();
            UI.refreshAll();
            UI.showToast('Transação atualizada!');
        }
    },

    updateGroup(groupId, formData) {
        const gidStr = String(groupId);
        const groupItems = Store.transactions.filter(t => String(t.groupId) === gidStr);
        if (groupItems.length > 0) {
            const newAmountPerItem = formData.amount ? parseFloat(formData.amount) / groupItems.length : null;

            groupItems.forEach(t => {
                if (t.recurrence === 'installment' && t.installmentInfo) {
                    t.description = `${formData.description} (Parcela ${t.installmentInfo.current}/${t.installmentInfo.total})`;
                } else {
                    t.description = formData.description;
                }
                t.type = formData.type;
                t.category = formData.category;
                t.account = formData.account;
                t.card = formData.card;
                if (newAmountPerItem !== null) {
                    t.amount = newAmountPerItem;
                }
            });

            Store.save();
            UI.refreshAll();
            UI.showToast('Grupo atualizado com sucesso!');
        }
    },

    // Remove transação
    delete(id) {
        Store.deleteTransaction(id);
        UI.refreshAll();
        UI.showToast('Transação removida!', 'danger');
    },

    // Remove todas as transações de um grupo
    deleteGroup(groupId) {
        const gidStr = String(groupId);
        Store.transactions = Store.transactions.filter(t => String(t.groupId) !== gidStr);
        Store.save();
        UI.refreshAll();
        UI.showToast('Grupo removido!', 'danger');
    },

    // Alterna status de pago/pendente
    toggleStatus(id) {
        const idStr = String(id);
        const t = Store.transactions.find(x => String(x.id) === idStr);
        if (t) {
            if (t.recurrence === 'none') return; // Compra única de cartão segue o fluxo da fatura
            if (t.amount === null && t.status === 'pending') {
                this.informValue(idStr);
            } else {
                if (t.status === 'paid') {
                    t.status = 'pending';
                    t.paymentDate = null;
                } else {
                    t.status = 'paid';
                    t.paymentDate = new Date().toISOString().split('T')[0];
                }
                Store.save();
                UI.refreshAll();
                const msg = t.status === 'paid' ? 'Marcada como Paga!' : 'Marcada como Pendente';
                UI.showToast(msg, t.status === 'paid' ? 'success' : 'warning');
            }
        }
    },

    // Informar valor de uma conta variável
    informValue(id) {
        const idStr = String(id);
        const value = prompt("Qual o valor pago nesta conta?");
        if (value && !isNaN(parseFloat(value))) {
            const t = Store.transactions.find(x => String(x.id) === idStr);
            if (t) {
                t.amount = parseFloat(value);
                t.status = 'paid';
                t.paymentDate = new Date().toISOString().split('T')[0];
                Store.save();
                UI.refreshAll();
                UI.showToast('Valor atualizado e conta paga com sucesso!');
            }
        }
    }
};

// Global expose para o onclick do HTML
window.Transactions = Transactions;
