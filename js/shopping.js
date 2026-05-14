/**
 * js/shopping.js
 * Gerencia a Lógica da Lista de Compras
 */

const Shopping = {
    init() {
        this.setupForm();
        this.setupCheckout();
    },

    setupForm() {
        const form = document.getElementById('shopping-item-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('shop-item-name');
            const priceInput = document.getElementById('shop-item-price');

            const name = nameInput.value.trim();
            const price = parseFloat(priceInput.value) || 0;

            if (name) {
                this.addItem(name, price);
                nameInput.value = '';
                priceInput.value = '';
                nameInput.focus();
            }
        });
    },

    setupCheckout() {
        const paymentMethodSelect = document.getElementById('shopping-payment-method');
        const accountGroup = document.getElementById('shopping-account-group');
        const cardGroup = document.getElementById('shopping-card-group');

        if (paymentMethodSelect) {
            paymentMethodSelect.addEventListener('change', (e) => {
                if (e.target.value === 'card') {
                    accountGroup.classList.add('hidden');
                    cardGroup.classList.remove('hidden');
                } else {
                    accountGroup.classList.remove('hidden');
                    cardGroup.classList.add('hidden');
                }
            });
        }

        const btnCheckout = document.getElementById('btn-checkout-shopping');
        if (btnCheckout) {
            btnCheckout.addEventListener('click', () => this.checkout());
        }
    },

    addItem(name, price) {
        const item = {
            id: Utils.generateId(),
            name,
            price,
            quantity: 1,
            checked: true // Novo item já vem selecionado
        };
        Store.shoppingItems.push(item);
        Store.save();
        UI.refreshAll();
    },

    toggleItem(id) {
        const item = Store.shoppingItems.find(i => i.id === id);
        if (item) {
            item.checked = !item.checked;
            Store.save();
            UI.refreshAll();
        }
    },

    updateItemPrice(id, newPrice) {
        const item = Store.shoppingItems.find(i => i.id === id);
        if (item) {
            item.price = parseFloat(newPrice) || 0;
            Store.save();
            this.renderTotal(); // Atualiza só o total para não perder o foco
        }
    },

    deleteItem(id) {
        Store.shoppingItems = Store.shoppingItems.filter(i => i.id !== id);
        Store.save();
        UI.refreshAll();
    },

    renderList() {
        const container = document.getElementById('shopping-list-items');
        if (!container) return;

        container.innerHTML = '';

        if (Store.shoppingItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="shopping-bag" style="width: 48px; height: 48px; margin-bottom: 1rem; color: var(--glass-border);"></i>
                    <p>Sua lista de compras está vazia.</p>
                </div>
            `;
            return;
        }

        Store.shoppingItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'transaction-item';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '1rem';
            div.style.padding = '0.75rem';
            div.style.opacity = item.checked ? '1' : '0.6';
            
            div.innerHTML = `
                <input type="checkbox" ${item.checked ? 'checked' : ''} 
                    onclick="Shopping.toggleItem('${item.id}')" 
                    style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--accent-primary);">
                
                <div style="flex: 1;">
                    <div style="font-weight: 600; text-decoration: ${item.checked ? 'none' : 'line-through'};">${item.name}</div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--text-secondary); font-size: 0.85rem;">R$</span>
                    <input type="number" step="0.01" value="${item.price.toFixed(2)}" 
                        onchange="Shopping.updateItemPrice('${item.id}', this.value)"
                        style="width: 80px; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 6px; padding: 0.4rem; color: white; text-align: right;">
                </div>

                <button class="btn-icon" onclick="Shopping.deleteItem('${item.id}')" style="color: var(--danger); opacity: 0.7;">
                    <i data-lucide="trash-2" style="width: 18px;"></i>
                </button>
            `;
            container.appendChild(div);
        });

        this.renderTotal();
        this.updateCheckoutSelects();
    },

    renderTotal() {
        const totalEl = document.getElementById('shopping-total');
        if (!totalEl) return;

        const total = Store.shoppingItems
            .filter(i => i.checked)
            .reduce((sum, item) => sum + item.price, 0);

        totalEl.innerText = Utils.formatCurrency(total);
    },

    updateCheckoutSelects() {
        const accountSelect = document.getElementById('shopping-account');
        const cardSelect = document.getElementById('shopping-card');

        if (accountSelect) {
            accountSelect.innerHTML = Store.accounts.map(acc => 
                `<option value="${acc.name}">${acc.name} (${Utils.formatCurrency(Store.getAccountStats(acc.name).balance)})</option>`
            ).join('');
        }

        if (cardSelect) {
            cardSelect.innerHTML = Store.cards.map(card => {
                const cardName = `${card.name} (Final ${card.last4})`;
                const used = Store.transactions
                    .filter(t => t.card === cardName && t.status !== 'paid')
                    .reduce((acc, t) => acc + t.amount, 0);
                const available = Math.max(0, card.limit - used);
                return `<option value="${cardName}">${card.name} (L. Disp: ${Utils.formatCurrency(available)})</option>`;
            }).join('');
        }
    },

    checkout() {
        const checkedItems = Store.shoppingItems.filter(i => i.checked);
        if (checkedItems.length === 0) {
            UI.showToast('Selecione pelo menos um item para comprar.', 'danger');
            return;
        }

        const calculatedTotal = checkedItems.reduce((sum, item) => sum + item.price, 0);
        const manualTotalInput = document.getElementById('shopping-final-total');
        const manualTotal = parseFloat(manualTotalInput ? manualTotalInput.value : 0) || 0;
        
        const finalTotal = manualTotal > 0 ? manualTotal : calculatedTotal;

        if (finalTotal <= 0) {
            UI.showToast('O valor total da compra deve ser maior que zero. Preencha o valor final ou os valores dos itens.', 'danger');
            return;
        }

        const paymentMethod = document.getElementById('shopping-payment-method').value;
        const accountName = document.getElementById('shopping-account').value;
        const cardId = document.getElementById('shopping-card').value;

        // Achar a categoria "Compras" ou criar uma fallback
        let categoryId = Store.categories.find(c => c.name.toLowerCase().includes('compra') || c.name.toLowerCase().includes('mercado'))?.id;
        if (!categoryId) categoryId = Store.categories[0].id; // Fallback

        const transaction = {
            description: 'Lista de Compras (Mercado)',
            amount: finalTotal,
            type: 'expense',
            category: categoryId,
            date: new Date().toISOString().split('T')[0],
            paymentDate: new Date().toISOString().split('T')[0],
            status: paymentMethod === 'account' ? 'paid' : 'pending',
            account: paymentMethod === 'account' ? accountName : 'none',
            card: paymentMethod === 'card' ? cardId : 'none',
            recurrence: 'none'
        };

        // Adiciona a transação
        Store.addTransaction(transaction);

        // Remove os itens comprados da lista
        Store.shoppingItems = Store.shoppingItems.filter(i => !i.checked);
        Store.save();

        UI.showToast('Compra finalizada com sucesso!', 'success');
        UI.refreshAll();
        
        // Redireciona para o Dashboard
        document.getElementById('nav-dashboard').click();
    }
};

window.Shopping = Shopping;
