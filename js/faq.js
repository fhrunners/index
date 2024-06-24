document.addEventListener("DOMContentLoaded", function() {
    // Load the CSV file and create the FAQ section
    fetch('faqs.csv')
        .then(response => response.text())
        .then(csvText => {
            const faqs = parseCSV(csvText);
            createFAQSection(faqs);
        })
        .catch(error => console.error('Error fetching the CSV file:', error));

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split('|');
        const faqs = lines.slice(1).map(line => {
            const data = line.split('|');
            return {
                question: data[0],
                answer: data[1]
            };
        });
        return faqs;
    }

    function createFAQSection(faqs) {
        const faqAccordion = document.getElementById('faqAccordion');
        faqAccordion.innerHTML = '';

        faqs.forEach((faq, index) => {
            const card = document.createElement('div');
            card.className = 'card';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'card-header';
            cardHeader.id = `heading${index}`;

            const h2 = document.createElement('h2');
            h2.className = 'mb-0';

            const button = document.createElement('button');
            button.className = 'btn btn-link';
            button.type = 'button';
            button.dataset.toggle = 'collapse';
            button.dataset.target = `#collapse${index}`;
            button.ariaExpanded = index === 0 ? 'true' : 'false';
            button.ariaControls = `collapse${index}`;
            button.textContent = faq.question;

            const collapse = document.createElement('div');
            collapse.id = `collapse${index}`;
            collapse.className = `collapse ${index === 0 ? 'show' : ''}`;
            collapse.ariaLabelledby = `heading${index}`;
            collapse.dataset.parent = '#faqAccordion';

            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';
            cardBody.textContent = faq.answer;

            h2.appendChild(button);
            cardHeader.appendChild(h2);
            collapse.appendChild(cardBody);
            card.appendChild(cardHeader);
            card.appendChild(collapse);
            faqAccordion.appendChild(card);
        });
    }
});
