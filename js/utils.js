/**
 * js/utils.js
 * Funções utilitárias de formatação e afins.
 */

const Utils = {
    // Formata número para moeda Real Brasileiro (BRL)
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    // Formata data ISO para DD/MM/YYYY
    formatDate(dateString) {
        // Trazendo o fuso horário correto
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    },

    // Gera um ID único simples (sempre String)
    generateId() {
        return Math.floor(Math.random() * 1000000).toString();
    },

    // Adiciona meses a uma data e retorna string YYYY-MM-DD
    addMonthsToDate(dateString, monthsToAdd) {
        if (!dateString) dateString = new Date().toISOString().split('T')[0];
        const date = new Date(dateString + 'T12:00:00Z');
        if (isNaN(date.getTime())) return dateString; // Fallback
        date.setMonth(date.getMonth() + monthsToAdd);
        return date.toISOString().split('T')[0];
    },

    // Verifica se uma data está no futuro
    isFutureDate(dateString) {
        if (!dateString) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const txDate = new Date(dateString + 'T12:00:00Z');
        if (isNaN(txDate.getTime())) return false;
        return txDate > today;
    },

    // Retorna o mês/ano de vencimento da fatura para uma compra
    getInvoiceMonthYear(purchaseDateStr, dueDate, closingDays) {
        const purchaseDate = new Date(purchaseDateStr + 'T12:00:00Z');
        if (isNaN(purchaseDate.getTime())) return { month: 0, year: 2026 };

        // Calcula o dia de fechamento
        let closingDay = dueDate - closingDays;
        
        // Se o fechamento for negativo ou zero, ele ocorreu no mês anterior
        // Mas para simplificar, a maioria dos apps usa o dia do mês atual.
        // Se a compra for DEPOIS ou no dia do fechamento, vai para a próxima fatura.
        if (purchaseDate.getDate() >= closingDay) {
            purchaseDate.setMonth(purchaseDate.getMonth() + 1);
        }
        
        return {
            month: purchaseDate.getMonth(),
            year: purchaseDate.getFullYear()
        };
    }
};

