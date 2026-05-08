// State Management
let transactions = JSON.parse(localStorage.getItem('waller_transactions')) || [
    { id: 1, description: 'Salário Mensal', amount: 8500.00, type: 'income', category: 'Salário', date: new Date().toISOString().split('T')[0] },
    { id: 2, description: 'Aluguel Apto', amount: 2200.00, type: 'expense', category: 'Moradia', date: new Date().toISOString().split('T')[0] },
    { id: 3, description: 'Supermercado Premium', amount: 850.50, type: 'expense', category: 'Alimentação', date: new Date().toISOString().split('T')[0] },
    { id: 4, description: 'Freelance Design', amount: 1200.00, type: 'income', category: 'Outros', date: new Date().toISOString().split('T')[0] }
];

let financeChart = null;

// DOM Elements
const balanceEl = document.getElementById('total-balance');
const incomeEl = document.getElementById('total-income');
const expenseEl = document.getElementById('total-expense');
const listEl = document.getElementById('transactions-list');
const form = document.getElementById('transaction-form');
const modalOverlay = document.getElementById('modal-overlay');
const openModalBtn = document.getElementById('open-modal');
const closeModalBtn = document.getElementById('close-modal');
const toastContainer = document.getElementById('toast-container');

// Initialize Icons
function initIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Format Currency
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Toast Notification System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    
    toast.innerHTML = `
        <i data-lucide="${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    initIcons();
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Update Chart
function updateChart() {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    // Group by category for expense only
    const categories = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);

    if (financeChart) {
        financeChart.destroy();
    }

    if (labels.length === 0) return;

    financeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#7c4dff', '#00e5ff', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#8b5cf6'
                ],
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
}

// Update Dashboard
function updateDashboard() {
    const amounts = transactions.map(t => t.type === 'income' ? t.amount : -t.amount);
    
    const total = amounts.reduce((acc, item) => acc + item, 0);
    const income = amounts.filter(item => item > 0).reduce((acc, item) => acc + item, 0);
    const expense = Math.abs(amounts.filter(item => item < 0).reduce((acc, item) => acc + item, 0));

    balanceEl.innerText = formatCurrency(total);
    incomeEl.innerText = formatCurrency(income);
    expenseEl.innerText = formatCurrency(expense);
    
    updateChart();
}

// Delete Transaction
function deleteTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveToLocalStorage();
    updateDashboard();
    renderTransactions();
    showToast('Transação removida!', 'danger');
}

// Render Transactions
function renderTransactions() {
    listEl.innerHTML = '';

    if (transactions.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>Nenhuma transação registrada.</p></div>';
        return;
    }

    const sortedTransactions = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTransactions.forEach(t => {
        const item = document.createElement('div');
        item.classList.add('transaction-item');

        const isIncome = t.type === 'income';
        const icon = isIncome ? 'trending-up' : 'trending-down';
        
        item.innerHTML = `
            <div class="icon-box ${t.type}">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="transaction-info">
                <span class="transaction-name">${t.description}</span>
                <span class="transaction-category">${t.category} • ${new Date(t.date).toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="transaction-amount ${t.type}">
                ${isIncome ? '+' : '-'} ${formatCurrency(t.amount)}
            </div>
            <button class="btn-delete" onclick="deleteTransaction(${t.id})">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        listEl.appendChild(item);
    });

    initIcons();
}

// Add Transaction
function addTransaction(e) {
    e.preventDefault();

    const newTransaction = {
        id: Math.floor(Math.random() * 1000000),
        description: document.getElementById('description').value,
        amount: parseFloat(document.getElementById('amount').value),
        type: document.getElementById('type').value,
        category: document.getElementById('category').value,
        date: document.getElementById('date').value
    };

    transactions.push(newTransaction);
    saveToLocalStorage();
    
    updateDashboard();
    renderTransactions();
    
    form.reset();
    closeModal();
    showToast('Transação adicionada com sucesso!');
}

// Persistence
function saveToLocalStorage() {
    localStorage.setItem('waller_transactions', JSON.stringify(transactions));
}

// Modal Handlers
function openModal() {
    modalOverlay.classList.add('active');
    document.getElementById('date').valueAsDate = new Date();
}

function closeModal() {
    modalOverlay.classList.remove('active');
}

// Event Listeners
openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
form.addEventListener('submit', addTransaction);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Initialization
function init() {
    renderTransactions();
    updateDashboard();
    initIcons();
}

// Global expose for onclick
window.deleteTransaction = deleteTransaction;

init();
