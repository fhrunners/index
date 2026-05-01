document.addEventListener("DOMContentLoaded", function() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const currentSection = pathParts[pathParts.length - 1] === 'index.html'
        ? pathParts[pathParts.length - 2]
        : pathParts[pathParts.length - 1];
    const sitePrefix = currentSection === 'faq' ? '../' : '';
    let faqItems = [];
    let activeCategory = 'All';

    // Load the FAQ data and create the FAQ section.
    fetch(sitePrefix + 'faqs.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`FAQ data request failed with ${response.status}`);
            }
            return response.json();
        })
        .then(faqs => {
            createFAQSection(faqs);
        })
        .catch(error => console.error('Error fetching the FAQ data:', error));

    function createFAQSection(faqs) {
        faqItems = faqs.map((faq, index) => ({
            ...faq,
            category: normalizeCategory(faq.category),
            index
        }));

        renderFilters();
        renderFAQItems();

        const faqSearch = document.getElementById('faqSearch');
        if (faqSearch) {
            faqSearch.addEventListener('input', renderFAQItems);
        }
    }

    function normalizeCategory(category) {
        return typeof category === 'string' && category.trim()
            ? category.trim()
            : 'General';
    }

    function renderFilters() {
        const filterList = document.getElementById('faqFilters');
        if (!filterList) {
            return;
        }

        const categories = ['All'];
        faqItems.forEach(item => {
            if (!categories.includes(item.category)) {
                categories.push(item.category);
            }
        });

        filterList.innerHTML = '';

        categories.forEach(category => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'faq-filter';
            button.dataset.category = category;
            button.setAttribute('aria-pressed', category === activeCategory ? 'true' : 'false');
            button.textContent = `${category} (${countItems(category)})`;
            button.addEventListener('click', () => {
                activeCategory = category;
                updateFilterState();
                renderFAQItems();
            });
            filterList.appendChild(button);
        });
    }

    function countItems(category) {
        return category === 'All'
            ? faqItems.length
            : faqItems.filter(item => item.category === category).length;
    }

    function updateFilterState() {
        document.querySelectorAll('.faq-filter').forEach(button => {
            button.setAttribute('aria-pressed', button.dataset.category === activeCategory ? 'true' : 'false');
        });
    }

    function renderFAQItems() {
        const faqList = document.getElementById('faqList');
        const faqSearch = document.getElementById('faqSearch');
        const faqStatus = document.getElementById('faqStatus');

        if (!faqList) {
            return;
        }

        const searchTerm = faqSearch ? faqSearch.value.trim().toLowerCase() : '';
        const visibleItems = faqItems.filter(item => {
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesSearch = !searchTerm
                || item.question.toLowerCase().includes(searchTerm)
                || item.answer.toLowerCase().includes(searchTerm);

            return matchesCategory && matchesSearch;
        });

        faqList.innerHTML = '';
        faqList.classList.toggle('is-empty', visibleItems.length === 0);

        if (faqStatus) {
            faqStatus.textContent = visibleItems.length === faqItems.length
                ? `${faqItems.length} questions`
                : `${visibleItems.length} of ${faqItems.length} questions`;
        }

        if (visibleItems.length === 0) {
            const emptyState = document.createElement('p');
            emptyState.className = 'faq-empty';
            emptyState.textContent = 'No matching questions yet.';
            faqList.appendChild(emptyState);
            return;
        }

        visibleItems.forEach(item => {
            faqList.appendChild(createFAQCard(item));
        });
    }

    function createFAQCard(item) {
        const card = document.createElement('article');
        card.className = `trust-card faq-card faq-card-${slugifyCategory(item.category)}`;

        const category = document.createElement('span');
        category.className = 'trust-card-label faq-category-label';
        category.textContent = item.category;

        const question = document.createElement('h3');
        question.textContent = item.question;

        const answer = document.createElement('p');
        answer.textContent = item.answer;

        card.appendChild(category);
        card.appendChild(question);
        card.appendChild(answer);

        return card;
    }

    function slugifyCategory(category) {
        return category.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
});
