/**
 * js/ui.js
 * Gerencia a manipulação do DOM e atualizações visuais.
 */

const UI = {
    financeChart: null,

    initIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    confirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const btnOk = document.getElementById('confirm-ok');
        const btnCancel = document.getElementById('confirm-cancel');

        msgEl.innerText = message;
        modal.classList.add('active');

        // Cleanup handlers
        const close = () => {
            modal.classList.remove('active');
            btnOk.replaceWith(btnOk.cloneNode(true));
            btnCancel.replaceWith(btnCancel.cloneNode(true));
        };

        btnCancel.addEventListener('click', close);
        btnOk.addEventListener('click', () => {
            close();
            onConfirm();
        });
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 'alert-circle';
        
        toast.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        this.initIcons();
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    updateDashboardSummary() {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const displayEl = document.getElementById('current-month-display');
        if(displayEl) displayEl.innerText = `${monthNames[App.currentMonth]} de ${App.currentYear}`;

        // Filtrar transações pagas APENAS do mês atual (baseado na data de pagamento, se existir, senão data original)
        // Ignora transações de cartão de crédito para o balanço da conta, pois elas serão pagas via Fatura.
        const paidTransactions = Store.transactions.filter(t => {
            if (t.status !== 'paid') return false;
            if (t.card && t.card !== 'none') return false; // Ignora gastos no cartão no fluxo da conta principal
            const effectiveDateStr = t.paymentDate || t.date;
            const date = new Date(effectiveDateStr + 'T12:00:00Z');
            return date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear;
        });
        
        const amounts = paidTransactions.map(t => t.type === 'income' ? t.amount : -t.amount);
        
        const totalBalance = Store.accounts.reduce((sum, acc) => sum + Store.getAccountStats(acc.name).balance, 0);
        const income = amounts.filter(item => item > 0).reduce((acc, item) => acc + item, 0);
        const expense = Math.abs(amounts.filter(item => item < 0).reduce((acc, item) => acc + item, 0));

        document.getElementById('total-balance').innerText = Utils.formatCurrency(totalBalance);
        document.getElementById('total-income').innerText = Utils.formatCurrency(income);
        document.getElementById('total-expense').innerText = Utils.formatCurrency(expense);
    },

    updateChart() {
        const ctxEl = document.getElementById('financeChart');
        if (!ctxEl) return;
        
        const ctx = ctxEl.getContext('2d');
        
        const categories = {};
        // Apenas despesas pagas do mês ativo no gráfico
        Store.transactions.filter(t => {
            if (t.type !== 'expense' || t.status !== 'paid') return false;
            const effectiveDateStr = t.paymentDate || t.date;
            const date = new Date(effectiveDateStr + 'T12:00:00Z');
            return date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear;
        }).forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        });

        const labels = Object.keys(categories);
        const data = Object.values(categories);

        if (this.financeChart) {
            this.financeChart.destroy();
        }

        if (labels.length === 0) return;

        this.financeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#7c4dff', '#00e5ff', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#8b5cf6'],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Outfit', size: 11 },
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                },
                cutout: '70%'
            }
        });
    },

    // Renderiza a lista de transações (Dashboard e aba Transações)
    refreshTransactionsList(searchQuery = '') {
        const dashboardList = document.getElementById('transactions-list');
        const allList = document.getElementById('all-transactions-list');
        const emptyHtml = '<div class="empty-state"><p>Nenhuma transação encontrada.</p></div>';

        if (dashboardList) dashboardList.innerHTML = '';
        if (allList) allList.innerHTML = '';

        if (Store.transactions.length === 0) {
            if (dashboardList) dashboardList.innerHTML = emptyHtml;
            if (allList) allList.innerHTML = emptyHtml;
            return;
        }

        let sortedTransactions = Store.getSortedTransactions();

        // Aplicar Busca ou Filtro Mensal
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            sortedTransactions = sortedTransactions.filter(t => 
                t.description.toLowerCase().includes(query) ||
                t.category.toLowerCase().includes(query) ||
                (t.amount && t.amount.toString().includes(query)) ||
                (t.card && t.card.toLowerCase().includes(query)) ||
                (t.account && t.account.toLowerCase().includes(query))
            );
        } else {
            // Filtrar transações para exibir na lista apenas as que têm alguma parcela/ocorrência no mês selecionado
            sortedTransactions = sortedTransactions.filter(t => {
                const effectiveDateStr = (t.status === 'paid' && t.paymentDate) ? t.paymentDate : t.date;
                const date = new Date(effectiveDateStr + 'T12:00:00Z');
                return date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear;
            });
        }

        // --- Agrupamento de Parceladas ---
        const displayList = [];
        const seenGroups = new Set();

        sortedTransactions.forEach(t => {
            if (t.groupId) {
                if (!seenGroups.has(t.groupId)) {
                    seenGroups.add(t.groupId);
                    const groupItems = Store.transactions.filter(x => x.groupId === t.groupId).sort((a, b) => new Date(a.date) - new Date(b.date));
                    
                    const parent = {
                        isGroup: true,
                        id: t.groupId,
                        description: groupItems[0].description.split(' (')[0],
                        type: groupItems[0].type,
                        category: groupItems[0].category,
                        date: groupItems[0].date,
                        totalAmount: groupItems.reduce((acc, item) => acc + item.amount, 0),
                        children: groupItems,
                        totalCount: groupItems.length,
                        paidCount: groupItems.filter(x => x.status === 'paid').length
                    };
                    displayList.push(parent);
                }
            } else {
                displayList.push({ isGroup: false, data: t });
            }
        });

        // Ordenar lista final pela data da transação ou data da compra (parcela 1)
        displayList.sort((a, b) => new Date(b.isGroup ? b.date : b.data.date) - new Date(a.isGroup ? a.date : a.data.date));

        // --- Helpers de Renderização ---
        const createItem = (t, isChild = false) => {
            const item = document.createElement('div');
            item.classList.add('transaction-item');
            
            if (t.status === 'pending') {
                item.classList.add('pending');
            }

            if (isChild) {
                item.style.marginLeft = '3rem';
                item.style.borderLeft = '2px solid var(--glass-border)';
                item.style.borderRadius = '0 16px 16px 0';
                item.style.background = 'rgba(255, 255, 255, 0.01)';
                item.style.marginTop = '-0.5rem';
            }

            const isIncome = t.type === 'income';
            
            let badge = '';
            if (t.recurrence === 'installment' && t.installmentInfo) {
                badge = `<span class="transaction-category" style="color: var(--warning)"> • Parcela ${t.installmentInfo.current}/${t.installmentInfo.total}</span>`;
            } else if (t.recurrence === 'recurring') {
                badge = `<span class="transaction-category" style="color: var(--accent-secondary)"> • Recorrente</span>`;
            }

            let amountHtml = '';
            if (t.amount === null && t.status === 'pending') {
                amountHtml = `<button class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 8px;" onclick="Transactions.informValue(${t.id})">Informar Valor</button>`;
            } else {
                amountHtml = `${isIncome ? '+' : '-'} ${Utils.formatCurrency(t.amount)}`;
            }

            let toggleBtnHtml = '';
            if (t.recurrence === 'none') {
                toggleBtnHtml = `
                    <div style="color: var(--success); display: flex; align-items: center; width: 24px; justify-content: center; margin-right: 0.5rem;" title="Transação à vista (Sempre Paga)">
                        <i data-lucide="check-circle-2"></i>
                    </div>
                `;
            } else {
                const statusIcon = t.status === 'paid' ? 'check-circle-2' : 'circle';
                const statusColor = t.status === 'paid' ? 'var(--success)' : 'var(--text-secondary)';
                toggleBtnHtml = `
                    <button class="btn-status" style="color: ${statusColor}; background: none; border: none; cursor: pointer; display: flex; align-items: center; width: 24px; justify-content: center; margin-right: 0.5rem;" title="Marcar como ${t.status === 'paid' ? 'Pendente' : 'Pago'}">
                        <i data-lucide="${statusIcon}"></i>
                    </button>
                `;
            }

            const catInfo = Store.categories.find(c => c.name === t.category);
            const catColor = catInfo ? catInfo.color : '#6B7280';
            const catIcon = catInfo ? catInfo.icon : 'tag';

            item.innerHTML = `
                ${toggleBtnHtml}
                <div class="icon-box" style="background: ${catColor}20; color: ${catColor}; ${isChild ? 'width: 36px; height: 36px;' : ''}">
                    <i data-lucide="${catIcon}" style="${isChild ? 'width: 18px;' : ''}"></i>
                </div>
                <div class="transaction-info">
                    <span class="transaction-name" style="${isChild ? 'font-size: 0.9rem;' : ''}">${t.description}</span>
                    <span class="transaction-category">${t.category} • ${Utils.formatDate(t.date)} ${t.account ? '• ' + t.account : ''} ${t.card !== 'none' && t.card ? '• ' + t.card : ''}</span>
                    ${badge}
                </div>
                <div class="transaction-amount ${t.type}" style="display: flex; align-items: center; ${isChild ? 'font-size: 0.9rem;' : ''}">
                    ${amountHtml}
                </div>
                ${!isChild ? `
                <button class="btn-edit" title="Editar">
                    <i data-lucide="edit-2"></i>
                </button>
                ` : ''}
                <button class="btn-delete" title="Excluir">
                    <i data-lucide="trash-2"></i>
                </button>
            `;

            const statusBtn = item.querySelector('.btn-status');
            if (statusBtn) {
                statusBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    Transactions.toggleStatus(t.id);
                });
            }

            const editBtn = item.querySelector('.btn-edit');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    App.openModalForEdit(t.id);
                });
            }

            const deleteBtn = item.querySelector('.btn-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.confirm('Deseja excluir esta transação permanentemente?', () => {
                        Transactions.delete(t.id);
                    });
                });
            }

            return item;
        };

        const createGroupItem = (group) => {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '0.5rem';

            const parentItem = document.createElement('div');
            parentItem.classList.add('transaction-item');
            parentItem.style.cursor = 'pointer';
            
            parentItem.onclick = (e) => {
                if (e.target.closest('.btn-delete')) return;
                const childrenDiv = parentItem.nextElementSibling;
                const chevron = parentItem.querySelector('[data-lucide="chevron-down"]');
                if (childrenDiv.classList.contains('hidden')) {
                    childrenDiv.classList.remove('hidden');
                    chevron.style.transform = 'rotate(180deg)';
                } else {
                    childrenDiv.classList.add('hidden');
                    chevron.style.transform = 'rotate(0deg)';
                }
            };

            const isAllPaid = group.paidCount === group.totalCount;
            const groupStatusColor = isAllPaid ? 'var(--success)' : 'var(--warning)';
            
            const catInfo = Store.categories.find(c => c.name === group.category);
            const catColor = catInfo ? catInfo.color : '#6B7280';
            const catIcon = catInfo ? catInfo.icon : 'layers';
            
            parentItem.innerHTML = `
                <div class="icon-box" style="background: ${catColor}20; color: ${catColor};">
                    <i data-lucide="${catIcon}"></i>
                </div>
                <div class="transaction-info">
                    <span class="transaction-name">${group.description}</span>
                    <span class="transaction-category">${group.category} • Compra em ${Utils.formatDate(group.date)}</span>
                    <span class="transaction-category" style="color: ${groupStatusColor}"> • Parcelado (${group.paidCount}/${group.totalCount} pagas)</span>
                </div>
                <div class="transaction-amount ${group.type}" style="display: flex; align-items: center; gap: 1rem;">
                    ${group.type === 'income' ? '+' : '-'} ${Utils.formatCurrency(group.totalAmount)}
                    <i data-lucide="chevron-down" style="width: 20px; transition: transform 0.3s;"></i>
                </div>
                <button class="btn-edit" title="Editar Grupo">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="btn-delete" title="Excluir Grupo">
                    <i data-lucide="trash-2"></i>
                </button>
            `;

            const groupEditBtn = parentItem.querySelector('.btn-edit');
            if (groupEditBtn) {
                groupEditBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    App.openModalForEditGroup(group.id);
                });
            }

            const groupDeleteBtn = parentItem.querySelector('.btn-delete');
            if (groupDeleteBtn) {
                groupDeleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    UI.confirm('Deseja excluir todas as parcelas dessa compra?', () => {
                        Transactions.deleteGroup(group.id);
                    });
                });
            }

            const childrenContainer = document.createElement('div');
            childrenContainer.classList.add('hidden');
            childrenContainer.style.display = 'flex';
            childrenContainer.style.flexDirection = 'column';
            childrenContainer.style.gap = '0.5rem';

            group.children.forEach(child => {
                childrenContainer.appendChild(createItem(child, true));
            });

            wrapper.appendChild(parentItem);
            wrapper.appendChild(childrenContainer);
            
            return wrapper;
        };

        // --- Renderização Final ---
        if (dashboardList) dashboardList.innerHTML = '';
        if (allList) allList.innerHTML = '';

        const renderWithHeaders = (list, targetEl, limit = null) => {
            if (!targetEl) return;
            let lastDate = null;
            let count = 0;

            list.forEach(item => {
                if (limit && count >= limit) return;
                
                const dateStr = item.isGroup ? item.date : item.data.date;
                
                if (dateStr !== lastDate) {
                    const header = document.createElement('div');
                    header.className = 'date-group-header';
                    
                    const today = new Date().toISOString().split('T')[0];
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    
                    if (dateStr === today) header.innerText = 'Hoje';
                    else if (dateStr === yesterday) header.innerText = 'Ontem';
                    else {
                        const [y, m, d] = dateStr.split('-');
                        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        header.innerText = `${d} de ${months[parseInt(m)-1]}`;
                    }
                    targetEl.appendChild(header);
                    lastDate = dateStr;
                }

                if (item.isGroup) targetEl.appendChild(createGroupItem(item));
                else targetEl.appendChild(createItem(item.data));
                count++;
            });
        };

        renderWithHeaders(displayList, dashboardList, 5);
        renderWithHeaders(displayList, allList);

        this.initIcons();
    },

    // Renderiza a lista de cartões e popula o select do formulário
    refreshCards() {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        // Atualiza a lista na guia Cartões
        const cardsList = document.getElementById('cards-list');
        if (cardsList) {
            cardsList.innerHTML = '';
            if (Store.cards.length === 0) {
                cardsList.innerHTML = '<div class="empty-state"><p>Nenhum cartão cadastrado.</p></div>';
            } else {
                Store.cards.forEach(card => {
                    const cardObj = card; // Para evitar confusão
                    const cardName = `${card.name} (Final ${card.last4})`;
                    
                    // Fatura do mês (baseada na regra de fechamento)
                    const monthlyInvoiceItems = Store.transactions.filter(t => {
                        if (t.card !== cardName || t.status !== 'pending') return false;
                        
                        // Para cartões, calculamos em qual fatura (mês/ano) a compra cai
                        const invoice = Utils.getInvoiceMonthYear(t.date, cardObj.dueDate || 10, cardObj.closingDays || 7);
                        return invoice.month === App.currentMonth && invoice.year === App.currentYear;
                    });
                    const monthlyTotal = monthlyInvoiceItems.reduce((sum, t) => sum + (t.amount || 0), 0);

                    // Total comprometido (tudo que não foi pago ainda)
                    const totalSpent = Store.transactions
                        .filter(t => t.card === cardName && t.status === 'pending')
                        .reduce((sum, t) => sum + (t.amount || 0), 0);
                    
                    const limit = card.limit || 0;
                    const available = limit - totalSpent;
                    const usedPercentage = limit > 0 ? Math.min((totalSpent / limit) * 100, 100) : 0;

                    // Verificar se a fatura do mês já foi paga
                    const isInvoicePaid = Store.transactions.some(t => {
                        const date = new Date((t.paymentDate || t.date) + 'T12:00:00Z');
                        return t.card === cardName && t.invoicePaid === true &&
                               date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear;
                    });

                    const item = document.createElement('div');
                    item.classList.add('transaction-item');
                    item.style.flexDirection = 'column';
                    item.style.alignItems = 'stretch';
                    item.style.cursor = isInvoicePaid ? 'default' : 'pointer';
                    item.style.padding = '1.5rem';
                    if (isInvoicePaid) {
                        item.style.opacity = '0.5';
                        item.style.pointerEvents = 'none'; // Desabilita cliques no card
                    }

                    item.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <div class="icon-box" style="background: var(--accent-primary); color: white;">
                                    <i data-lucide="credit-card"></i>
                                </div>
                                <div class="transaction-info">
                                    <span class="transaction-name" style="font-size: 1.1rem;">${card.name} ${isInvoicePaid ? '<span style="font-size: 0.7rem; background: var(--success); color: white; padding: 2px 8px; border-radius: 10px; margin-left: 10px; vertical-align: middle;">PAGA</span>' : ''}</span>
                                    <span class="transaction-category">Final ${card.last4}</span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; pointer-events: auto;">
                                <button class="btn-edit-card" title="Editar Cartão" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); padding: 0.5rem; border: none; border-radius: 8px; cursor: pointer;">
                                    <i data-lucide="edit-2" style="width: 18px;"></i>
                                </button>
                                ${!isInvoicePaid ? `
                                <button class="btn-delete" title="Excluir Cartão" style="background: rgba(239, 68, 68, 0.1); color: var(--danger); padding: 0.5rem; border: none; border-radius: 8px; cursor: pointer;">
                                    <i data-lucide="trash-2" style="width: 18px;"></i>
                                </button>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Barra de Limite -->
                        <div style="margin-bottom: 1.5rem;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                                <span style="color: var(--text-secondary);">Limite Utilizado</span>
                                <span style="color: var(--text-primary); font-weight: 600;">${usedPercentage.toFixed(1)}%</span>
                            </div>
                            <div style="height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem;">
                                <div style="height: 100%; width: ${usedPercentage}%; background: ${usedPercentage > 80 ? 'var(--danger)' : 'var(--accent-primary)'}; border-radius: 4px; transition: width 0.3s ease;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
                                <span style="color: var(--text-secondary);">Disponível: <strong style="color: var(--success);">${Utils.formatCurrency(available)}</strong></span>
                                <span style="color: var(--text-secondary);">Total: ${Utils.formatCurrency(limit)}</span>
                            </div>
                        </div>

                        <!-- Fatura Atual -->
                        <div style="padding: 1rem; background: ${isInvoicePaid ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0,0,0,0.2)'}; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: ${isInvoicePaid ? '1px solid rgba(16, 185, 129, 0.2)' : 'none'}; pointer-events: auto;">
                            <div>
                                <span style="font-size: 0.75rem; color: ${isInvoicePaid ? 'var(--success)' : 'var(--text-secondary)'}; text-transform: uppercase;">${isInvoicePaid ? 'Fatura Paga' : 'Fatura de ' + monthNames[App.currentMonth]}</span>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-primary);">${isInvoicePaid ? 'R$ 0,00' : Utils.formatCurrency(monthlyTotal)}</div>
                            </div>
                            <button class="${isInvoicePaid ? 'btn-undo-invoice' : 'btn-primary btn-pay-invoice'}" style="padding: 0.5rem 1rem; font-size: 0.85rem; ${isInvoicePaid ? 'background: none; border: 1px solid var(--glass-border); color: var(--text-secondary); cursor: pointer;' : ''}">
                                ${isInvoicePaid ? 'Desfazer' : 'Ver Detalhes'}
                            </button>
                        </div>
                    `;

                    if (isInvoicePaid) {
                        const undoBtn = item.querySelector('.btn-undo-invoice');
                        undoBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            UI.confirm(`Deseja desfazer o pagamento da fatura de "${cardName}"?`, () => {
                                Cards.undoInvoicePayment(cardName);
                            });
                        });
                    }
                    
                    // Click to open summary modal
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.btn-delete')) return;
                        Cards.openInvoiceSummaryModal(cardName);
                    });
                    
                    const editCardBtn = item.querySelector('.btn-edit-card');
                    if (editCardBtn) {
                        editCardBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            Cards.openEditModal(card.id);
                        });
                    }

                    const deleteBtn = item.querySelector('.btn-delete');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            UI.confirm('Tem certeza que deseja remover este cartão?', () => {
                                Cards.delete(card.id);
                            });
                        });
                    }

                    cardsList.appendChild(item);
                });
            }
        }

        // Atualiza o select no modal de transação
        const cardSelect = document.getElementById('transaction-card');
        if (cardSelect) {
            const currentVal = cardSelect.value;
            cardSelect.innerHTML = '';
            Store.cards.forEach(card => {
                const opt = document.createElement('option');
                opt.value = `${card.name} (Final ${card.last4})`;
                opt.innerText = `${card.name} (Final ${card.last4})`;
                cardSelect.appendChild(opt);
            });
            // Restaura o valor se ainda existir
            if (Array.from(cardSelect.options).find(o => o.value === currentVal)) {
                cardSelect.value = currentVal;
            }
        }

        this.initIcons();
    },

    refreshAll() {
        try {
            this.updateDashboardSummary();
            this.updateChart();
            this.refreshTransactionsList();
            this.refreshCards();
            this.populateCategorySelect();
            this.populateAccountSelect();
            this.refreshSettings();
            if (window.Analytics && typeof Analytics.init === 'function') Analytics.init();
            
            this.initIcons();
        } catch (e) {
            console.error("Erro crítico ao atualizar interface:", e);
        }
    },

    refreshSettings() {
        // Accounts
        const accountsList = document.getElementById('accounts-list');
        if (accountsList) {
            accountsList.innerHTML = '';
            if (Store.accounts.length === 0) {
                accountsList.innerHTML = '<div class="empty-state"><p>Nenhuma conta cadastrada.</p></div>';
            } else {
                Store.accounts.forEach(acc => {
                    const stats = Store.getAccountStats(acc.name);
                    const item = document.createElement('div');
                    item.classList.add('transaction-item');
                    item.style.cursor = 'pointer';
                    item.style.padding = '1rem';

                    item.innerHTML = `
                        <div class="icon-box" style="background: var(--accent-primary); color: white;">
                            <i data-lucide="wallet"></i>
                        </div>
                        <div class="transaction-info">
                            <span class="transaction-name">${acc.name}</span>
                            <span class="transaction-category">Saldo: <strong style="color: ${stats.balance >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.formatCurrency(stats.balance)}</strong></span>
                        </div>
                        <i data-lucide="chevron-right" style="color: var(--text-secondary); width: 20px;"></i>
                    `;

                    item.addEventListener('click', () => {
                        Settings.openAccountDetailsModal(acc.id);
                    });
                    
                    accountsList.appendChild(item);
                });
            }
        }

        // Categories
        const categoriesList = document.getElementById('categories-list');
        if (categoriesList) {
            categoriesList.innerHTML = '';
            Store.categories.forEach(cat => {
                const item = document.createElement('div');
                item.classList.add('transaction-item');
                item.innerHTML = `
                    <div class="icon-box" style="background: ${cat.color}20; color: ${cat.color};">
                        <i data-lucide="tag"></i>
                    </div>
                    <div class="transaction-info">
                        <span class="transaction-name">${cat.name}</span>
                    </div>
                    <button class="btn-delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                `;
                const deleteBtn = item.querySelector('.btn-delete');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        UI.confirm('Tem certeza que deseja remover esta categoria?', () => {
                            Settings.deleteCategory(cat.id);
                        });
                    });
                }
                categoriesList.appendChild(item);
            });
        }
        this.initIcons();
    },

    populateCategorySelect(filterType = 'both') {
        const select = document.getElementById('category');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        
        Store.categories
            .filter(cat => !cat.type || cat.type === 'both' || cat.type === filterType)
            .forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.innerText = cat.name;
                select.appendChild(option);
            });

        if (Array.from(select.options).find(o => o.value === currentVal)) {
            select.value = currentVal;
        }
    },

    populateAccountSelect() {
        const select = document.getElementById('transaction-account');
        if (!select) return;
        const currentVal = select.value;
        select.innerHTML = '';
        Store.accounts.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.name;
            option.innerText = acc.name;
            select.appendChild(option);
        });
        if (Array.from(select.options).find(o => o.value === currentVal)) {
            select.value = currentVal;
        }
    }
};


