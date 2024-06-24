document.addEventListener("DOMContentLoaded", function() {
    // Create the header element
    var header = document.createElement('header');
    header.innerHTML = `
        <nav class="navbar navbar-expand-lg navbar-dark bg-success fixed-top">
            <div class="container">
                <a class="navbar-brand" href="index.html">
                    <img src="images/logo.png" alt="Forest Hills Runners Logo" class="logo-circle">
                </a>
                <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse justify-content-end" id="navbarNav">
                    <ul class="navbar-nav">
                        <li class="nav-item"><a class="nav-link" href="index.html">Home</a></li>
                        <li class="nav-item"><a class="nav-link" href="about.html">About Us</a></li>
                        <li class="nav-item"><a class="nav-link" href="run-with-us.html">Run With Us</a></li>
                        <li class="nav-item"><a class="nav-link" href="routes.html">Running Routes</a></li>
                        <li class="nav-item"><a class="nav-link" href="faq.html">FAQ</a></li>
                        <li class="nav-item"><a class="nav-link" href="contact.html">Contact</a></li>
                    </ul>
                </div>
            </div>
        </nav>
    `;

    // Append the header to the body
    document.body.insertAdjacentElement('afterbegin', header);

    // Create the footer element
    var footer = document.createElement('footer');
    footer.className = 'bg-dark text-yellow d-flex justify-content-between align-items-center py-3 border-top';

    // Add the left side content
    var leftDiv = document.createElement('div');
    leftDiv.className = 'col-md-4 align-items-center';
    var span = document.createElement('span');
    span.className = 'text-body-secondary';
    span.innerHTML = '&copy; 2024 Forest Hills Runners';
    leftDiv.appendChild(span);

    // Add the right side content
    var rightUl = document.createElement('ul');
    rightUl.className = 'nav col-md-1 justify-content-end list-unstyled d-flex';
    var instagramLi = document.createElement('li');
    instagramLi.className = 'ms-3';
    var instagramA = document.createElement('a');
    instagramA.className = 'text-body-secondary';
    instagramA.href = 'https://www.instagram.com/fhrunners';
    var instagramImg = document.createElement('img');
    instagramImg.src = 'images/instagram_logo.svg';
    instagramImg.className = 'footer-logo mx-1';
    instagramImg.alt = 'Instagram';
    instagramImg.width = 24;
    instagramImg.height = 24;
    instagramA.appendChild(instagramImg);
    instagramLi.appendChild(instagramA);

    var facebookLi = document.createElement('li');
    facebookLi.className = 'ms-3';
    var facebookA = document.createElement('a');
    facebookA.className = 'text-body-secondary';
    facebookA.href = 'https://www.facebook.com/groups/foresthillsrunners/';
    var facebookImg = document.createElement('img');
    facebookImg.src = 'images/facebook_logo.svg';
    facebookImg.className = 'footer-logo mx-1';
    facebookImg.alt = 'Facebook';
    facebookImg.width = 24;
    facebookImg.height = 24;
    facebookA.appendChild(facebookImg);
    facebookLi.appendChild(facebookA);

    rightUl.appendChild(instagramLi);
    rightUl.appendChild(facebookLi);

    // Append left and right content to the footer
    footer.appendChild(leftDiv);
    footer.appendChild(rightUl);

    // Append the footer to the body
    document.body.appendChild(footer);
});
