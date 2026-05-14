/**
 * js/shopping.js
 * Gerencia múltiplas listas de compras colaborativas.
 */

const Shopping = {
    activeListId: null,

    init() {
        const itemForm = document.getElementById('shopping-item-form');
        const listNameForm = document.getElementById('form-list-name');
        const paymentMethodSelect = document.getElementById('shopping-payment-method');
        const checkoutBtn = document.getElementById('btn-checkout-shopping');
        const deleteListBtn = document.getElementById('btn-delete-list');

        if (itemForm) {
            itemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.addItem();
            });
        }

        if (listNameForm) {
            listNameForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveListName();
            });
        }

        if (paymentMethodSelect) {
            paymentMethodSelect.addEventListener('change', () => this.updateCheckoutSelects());
        }

        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.checkout());
        }

        if (deleteListBtn) {
            deleteListBtn.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja excluir esta lista permanentemente?')) {
                    this.deleteList(this.activeListId);
                }
            });
        }

        this.renderGrid();
    },

    // --- GRID DE LISTAS ---

    renderGrid() {
        const grid = document.getElementById('shopping-lists-grid');
        if (!grid) return;

        if (Store.shoppingLists.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 4rem; background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--glass-border);">
                    <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;">🛒</div>
                    <h3 style="color: var(--text-secondary);">Nenhuma lista criada</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">Clique em "Nova Lista" para começar.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = Store.shoppingLists.map(list => {
            const checkedCount = list.items.filter(i => i.checked).length;
            const totalItems = list.items.length;
            const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;
            const totalEst = list.items.reduce((sum, i) => sum + (i.price || 0), 0);

            return `
                <div class="card" style="cursor: pointer; transition: transform 0.2s;" onclick="Shopping.openList('${list.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <h3 style="font-size: 1.2rem;">${list.name}</h3>
                        <div style="background: rgba(124, 77, 255, 0.1); color: var(--accent-primary); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                            ${checkedCount}/${totalItems} itens
                        </div>
                    </div>
                    
                    <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 1.5rem; overflow: hidden;">
                        <div style="height: 100%; width: ${progress}%; background: var(--accent-primary); transition: width 0.3s;"></div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; color: var(--text-secondary); font-size: 0.85rem;">
                        <span>Soma Est.: <strong>${Utils.formatCurrency(totalEst)}</strong></span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="calendar" style="width: 14px;"></i>
                            ${new Date(list.updatedAt || list.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    },

    // --- MODAL DE NOME ---

    openCreateModal() {
        document.getElementById('list-name-modal-title').innerText = 'Nova Lista';
        document.getElementById('list-name-input').value = '';
        document.getElementById('modal-list-name').classList.add('active');
        document.getElementById('list-name-input').focus();
    },

    saveListName() {
        const name = document.getElementById('list-name-input').value;
        if (!name) return;

        const newList = {
            id: Utils.generateId(),
            name: name,
            items: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Store.shoppingLists.push(newList);
        Store.save();
        
        document.getElementById('modal-list-name').classList.remove('active');
        this.renderGrid();
        this.openList(newList.id);
    },

    // --- MODAL DE DETALHES ---

    openList(id) {
        const list = Store.shoppingLists.find(l => l.id === id);
        if (!list) return;

        this.activeListId = id;
        document.getElementById('shopping-list-modal-title').innerText = list.name;
        document.getElementById('shopping-final-total').value = '';
        
        this.renderItems();
        this.updateCheckoutSelects();
        
        document.getElementById('modal-shopping-list').classList.add('active');
    },

    closeListModal() {
        this.activeListId = null;
        document.getElementById('modal-shopping-list').classList.remove('active');
        this.renderGrid();
    },

    renderItems() {
        const list = Store.shoppingLists.find(l => l.id === this.activeListId);
        const container = document.getElementById('shopping-list-items');
        if (!list || !container) return;

        if (list.items.length === 0) {
            container.innerHTML = `<p style="text-align: center; padding: 2rem; color: var(--text-secondary); opacity: 0.6;">Sua lista está vazia.</p>`;
            document.getElementById('shopping-total').innerText = Utils.formatCurrency(0);
            return;
        }

        container.innerHTML = list.items.map(item => `
            <div class="transaction-item" style="padding: 0.75rem; background: ${item.checked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${item.checked ? 'transparent' : 'var(--glass-border)'}; border-radius: 12px; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 1rem; opacity: ${item.checked ? 0.6 : 1};">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="Shopping.toggleItem('${item.id}')" style="width: 20px; height: 20px; cursor: pointer;">
                <div style="flex: 1;">
                    <span style="${item.checked ? 'text-decoration: line-through;' : ''}">${item.name}</span>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${Utils.formatCurrency(item.price || 0)}</div>
                </div>
                <button class="btn-icon" onclick="Shopping.deleteItem('${item.id}')" style="color: var(--danger); opacity: 0.5;">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `).join('');

        const total = list.items.filter(i => i.checked).reduce((sum, i) => sum + (i.price || 0), 0);
        document.getElementById('shopping-total').innerText = Utils.formatCurrency(total);
        
        if (window.lucide) lucide.createIcons();
    },

    addItem() {
        const nameInput = document.getElementById('shop-item-name');
        const priceInput = document.getElementById('shop-item-price');
        
        const name = nameInput.value;
        const price = parseFloat(priceInput.value) || 0;

        if (!name) return;

        const list = Store.shoppingLists.find(l => l.id === this.activeListId);
        if (list) {
            list.items.push({
                id: Utils.generateId(),
                name,
                price,
                checked: false
            });
            list.updatedAt = new Date().toISOString();
            Store.save();
            
            nameInput.value = '';
            priceInput.value = '';
            nameInput.focus();
            this.renderItems();
        }
    },

    toggleItem(itemId) {
        const list = Store.shoppingLists.find(l => l.id === this.activeListId);
        if (list) {
            const item = list.items.find(i => i.id === itemId);
            if (item) {
                item.checked = !item.checked;
                list.updatedAt = new Date().toISOString();
                Store.save();
                this.renderItems();
            }
        }
    },

    deleteItem(itemId) {
        const list = Store.shoppingLists.find(l => l.id === this.activeListId);
        if (list) {
            list.items = list.items.filter(i => i.id !== itemId);
            list.updatedAt = new Date().toISOString();
            Store.save();
            this.renderItems();
        }
    },

    deleteList(id) {
        Store.shoppingLists = Store.shoppingLists.filter(l => l.id !== id);
        Store.save();
        this.closeListModal();
    },

    // --- CHECKOUT ---

    updateCheckoutSelects() {
        const method = document.getElementById('shopping-payment-method').value;
        const accountGroup = document.getElementById('shopping-account-group');
        const cardGroup = document.getElementById('shopping-card-group');
        
        if (method === 'account') {
            accountGroup.classList.remove('hidden');
            cardGroup.classList.add('hidden');
            
            const accSelect = document.getElementById('shopping-account');
            accSelect.innerHTML = Store.accounts.map(acc => `<option value="${acc.name}">${acc.name}</option>`).join('');
        } else {
            accountGroup.classList.add('hidden');
            cardGroup.classList.remove('hidden');
            
            const cardSelect = document.getElementById('shopping-card');
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
        const list = Store.shoppingLists.find(l => l.id === this.activeListId);
        if (!list) return;

        const checkedItems = list.items.filter(i => i.checked);
        if (checkedItems.length === 0) {
            UI.showToast('Selecione pelo menos um item da lista.', 'danger');
            return;
        }

        const calculatedTotal = checkedItems.reduce((sum, item) => sum + (item.price || 0), 0);
        const manualTotalInput = document.getElementById('shopping-final-total');
        const manualTotal = parseFloat(manualTotalInput ? manualTotalInput.value : 0) || 0;
        
        const finalTotal = manualTotal > 0 ? manualTotal : calculatedTotal;

        if (finalTotal <= 0) {
            UI.showToast('Preencha o valor final ou o preço dos itens.', 'danger');
            return;
        }

        const paymentMethod = document.getElementById('shopping-payment-method').value;
        const accountName = document.getElementById('shopping-account').value;
        const cardId = document.getElementById('shopping-card').value;
        
        const categoryId = '7'; // Compras

        const transaction = {
            description: `Compra: ${list.name}`,
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

        Store.addTransaction(transaction);
        
        // Remove os itens comprados da lista
        list.items = list.items.filter(i => !i.checked);
        list.updatedAt = new Date().toISOString();
        Store.save();

        UI.showToast('Gasto lançado com sucesso!');
        this.renderItems();
        if (list.items.length === 0) {
            this.deleteList(list.id);
        }
    }
};

window.Shopping = Shopping;
window.addEventListener('DOMContentLoaded', () => Shopping.init());
