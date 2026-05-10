document.addEventListener("DOMContentLoaded", function() {
    var pathParts = window.location.pathname.split('/').filter(Boolean);
    var currentSection = pathParts[pathParts.length - 1] === 'index.html'
        ? pathParts[pathParts.length - 2]
        : pathParts[pathParts.length - 1];
    var nestedSections = ['about', 'new-to-fhr', 'run-with-us', 'routes', 'faq', 'contact'];
    var sitePrefix = nestedSections.indexOf(currentSection) >= 0 ? '../' : '';

    // Create the header element
    var header = document.createElement('header');
    header.innerHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-success fixed-top">
            <div class="container">
                <a class="navbar-brand" href="${sitePrefix || './'}">
                    <img src="${sitePrefix}images/logo.png" alt="Forest Hills Runners Logo" class="logo-circle">
                </a>
                <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix || './'}">Home</a></li>
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix}about/">About Us</a></li>
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix}new-to-fhr/">New to FHR?</a></li>
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix}run-with-us/">Run With Us</a></li>
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix}routes/">Running Routes</a></li>
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix}faq/">FAQ</a></li>
                        <li class="nav-item"><a class="nav-link" href="${sitePrefix}contact/">Contact</a></li>
                    </ul>
                </div>
            </div>
        </nav>
    `;

    // Append the header to the body
    document.body.insertAdjacentElement('afterbegin', header);

    // Create the footer element
    var footer = document.createElement('footer');
    footer.className = 'site-footer bg-dark text-yellow d-flex justify-content-between align-items-center py-3 border-top';

    // Add the left side content
    var leftDiv = document.createElement('div');
    leftDiv.className = 'footer-copyright align-items-center';
    var span = document.createElement('span');
    span.className = 'text-body-secondary';
    span.innerHTML = '&copy; 2026 Forest Hills Runners';
    leftDiv.appendChild(span);

    // Add the right side content
    var rightUl = document.createElement('ul');
    rightUl.className = 'footer-social nav justify-content-end list-unstyled d-flex';
    var socialLinks = [
        {
            name: 'Instagram',
            href: 'https://www.instagram.com/fhrunners',
            icon: 'images/instagram_logo.svg',
            filtered: true
        },
        {
            name: 'Facebook',
            href: 'https://www.facebook.com/groups/foresthillsrunners/',
            icon: 'images/facebook_logo.svg',
            filtered: true
        },
        {
            name: 'WhatsApp',
            href: 'https://chat.whatsapp.com/Bu26JYmrzsi58k7I7ByVGM',
            icon: 'images/whatsapp_logo.png'
        },
        {
            name: 'Strava',
            href: 'https://www.strava.com/clubs/115650',
            icon: 'images/strava_logo.webp',
            itemClass: 'footer-social-item-strava'
        },
        {
            name: 'Garmin Connect',
            href: 'https://connect.garmin.com/group/4739058',
            icon: 'images/garmin_connect_logo.png'
        }
    ];

    socialLinks.forEach(function(social) {
        var socialLi = document.createElement('li');
        socialLi.className = social.itemClass || '';

        var socialImg = document.createElement('img');
        socialImg.src = sitePrefix + social.icon;
        socialImg.className = 'footer-logo' + (social.filtered ? ' footer-logo-filtered' : '');
        socialImg.alt = '';
        socialImg.width = 24;
        socialImg.height = 24;
        socialImg.setAttribute('aria-hidden', 'true');

        if (social.href) {
            var socialA = document.createElement('a');
            socialA.className = 'text-body-secondary';
            socialA.href = social.href;
            socialA.target = '_blank';
            socialA.rel = 'noopener noreferrer';
            socialA.title = social.name;
            socialA.setAttribute('aria-label', social.name);
            socialA.appendChild(socialImg);
            socialLi.appendChild(socialA);
        } else {
            var socialPlaceholder = document.createElement('span');
            socialPlaceholder.className = 'footer-social-placeholder';
            socialPlaceholder.title = social.placeholder;
            socialPlaceholder.setAttribute('aria-label', social.placeholder);
            socialPlaceholder.appendChild(socialImg);
            socialLi.appendChild(socialPlaceholder);
        }

        rightUl.appendChild(socialLi);
    });

    // Append left and right content to the footer
    footer.appendChild(leftDiv);
    footer.appendChild(rightUl);

    // Append the footer to the body
    document.body.appendChild(footer);

    // GoatCounter analytics
    var goatCounterScript = document.createElement('script');
    goatCounterScript.setAttribute('data-goatcounter', 'https://fhrunners.goatcounter.com/count');
    goatCounterScript.async = true;
    goatCounterScript.src = '//gc.zgo.at/count.js';
    document.head.appendChild(goatCounterScript);
});
