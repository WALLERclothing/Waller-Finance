/**
 * js/navigation.js
 * Controla a navegação da barra lateral e exibe a view correspondente.
 */

const Navigation = {
    init() {
        const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
        const views = document.querySelectorAll('.view');

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Pega a base do nome do id (ex: 'dashboard' de 'nav-dashboard' ou 'mobile-nav-dashboard')
                const baseId = item.id.replace('mobile-nav-', '').replace('nav-', '');
                
                // Remove ativação de tudo
                navItems.forEach(nav => nav.classList.remove('active'));
                views.forEach(view => view.classList.remove('active'));

                // Ativa os botões correspondentes nas duas barras
                document.getElementById(`nav-${baseId}`)?.classList.add('active');
                document.getElementById(`mobile-nav-${baseId}`)?.classList.add('active');

                // Ativa a View correspondente
                const targetView = document.getElementById(`view-${baseId}`);
                if (targetView) {
                    targetView.classList.add('active');
                    
                    // Se for a aba de análises, forçar renderização dos gráficos
                    if (baseId === 'analytics' && window.Analytics) {
                        setTimeout(() => Analytics.init(), 100);
                    }
                }
            });
        });
    }
};
