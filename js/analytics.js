/**
 * js/analytics.js
 * Gerencia os gráficos avançados da guia de Análises.
 */

const Analytics = {
    categoryChart: null,
    monthlyChart: null,
    trendChart: null,

    init() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js não carregado');
            return;
        }
        
        // Pequeno delay para garantir que o DOM está visível (necessário para o Chart.js medir o tamanho)
        this.renderCategoryChart();
        this.renderMonthlyChart();
        this.renderTrendChart();
    },

    renderCategoryChart() {
        const ctxEl = document.getElementById('analytics-category-chart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        const categories = {};
        Store.transactions.filter(t => {
            if (t.type !== 'expense' || t.status !== 'paid') return false;
            const date = new Date((t.paymentDate || t.date) + 'T12:00:00Z');
            return date.getMonth() === App.currentMonth && date.getFullYear() === App.currentYear;
        }).forEach(t => {
            categories[t.category] = (categories[t.category] || 0) + t.amount;
        });

        const labels = Object.keys(categories);
        const data = Object.values(categories);

        if (this.categoryChart) this.categoryChart.destroy();
        if (labels.length === 0) return;

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#7c4dff', '#00e5ff', '#10b981', '#ef4444', '#f59e0b', '#ec4899', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                }
            }
        });
    },

    renderMonthlyChart() {
        const ctxEl = document.getElementById('analytics-monthly-chart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        // Pegar os últimos 6 meses
        const months = [];
        const incomeData = [];
        const expenseData = [];
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        for (let i = 5; i >= 0; i--) {
            let m = App.currentMonth - i;
            let y = App.currentYear;
            if (m < 0) { m += 12; y--; }
            
            months.push(`${monthNames[m]}/${y.toString().slice(2)}`);

            const monthlyTransactions = Store.transactions.filter(t => {
                if (t.status !== 'paid') return false;
                const date = new Date((t.paymentDate || t.date) + 'T12:00:00Z');
                return date.getMonth() === m && date.getFullYear() === y;
            });

            const income = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expense = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

            incomeData.push(income);
            expenseData.push(expense);
        }

        if (this.monthlyChart) this.monthlyChart.destroy();

        this.monthlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'Entradas', data: incomeData, backgroundColor: '#10b981', borderRadius: 5 },
                    { label: 'Saídas', data: expenseData, backgroundColor: '#ef4444', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: {
                    legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
                }
            }
        });
    },

    renderTrendChart() {
        const ctxEl = document.getElementById('analytics-trend-chart');
        if (!ctxEl) return;
        const ctx = ctxEl.getContext('2d');

        // Evolução do saldo acumulado nos últimos 6 meses
        const months = [];
        const balanceTrend = [];
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        
        let cumulativeBalance = 0;
        // Calcular saldo inicial (antes dos 6 meses)
        const sixMonthsAgoDate = new Date(App.currentYear, App.currentMonth - 5, 1);
        
        Store.transactions.filter(t => {
            if (t.status !== 'paid') return false;
            const date = new Date((t.paymentDate || t.date) + 'T12:00:00Z');
            return date < sixMonthsAgoDate;
        }).forEach(t => {
            cumulativeBalance += (t.type === 'income' ? t.amount : -t.amount);
        });

        for (let i = 5; i >= 0; i--) {
            let m = App.currentMonth - i;
            let y = App.currentYear;
            if (m < 0) { m += 12; y--; }
            
            months.push(`${monthNames[m]}/${y.toString().slice(2)}`);

            const monthlyBalance = Store.transactions.filter(t => {
                if (t.status !== 'paid') return false;
                const date = new Date((t.paymentDate || t.date) + 'T12:00:00Z');
                return date.getMonth() === m && date.getFullYear() === y;
            }).reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

            cumulativeBalance += monthlyBalance;
            balanceTrend.push(cumulativeBalance);
        }

        if (this.trendChart) this.trendChart.destroy();

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Saldo Acumulado',
                    data: balanceTrend,
                    borderColor: '#7c4dff',
                    backgroundColor: 'rgba(124, 77, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#7c4dff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
};
