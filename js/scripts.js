document.addEventListener("DOMContentLoaded", function() {
    var mainTarget = document.querySelector("main")
        || document.querySelector("#hanging-icons")
        || document.querySelector("body > .container.mb-5")
        || document.querySelector("body > section.container")
        || document.querySelector("body > div.container");

    if (mainTarget) {
        if (!mainTarget.id) {
            mainTarget.id = "main-content";
        }

        if (!mainTarget.hasAttribute("tabindex")) {
            mainTarget.setAttribute("tabindex", "-1");
        }

        if (!document.querySelector(".skip-link")) {
            var skipLink = document.createElement("a");
            skipLink.className = "skip-link";
            skipLink.href = "#" + mainTarget.id;
            skipLink.textContent = "Skip to main content";
            skipLink.addEventListener("click", function() {
                window.setTimeout(function() {
                    mainTarget.focus();
                }, 0);
            });
            document.body.insertBefore(skipLink, document.body.firstChild);
        }
    }

    var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function pauseCarouselMotion() {
        var carousels = document.querySelectorAll(".carousel");

        carousels.forEach(function(carousel) {
            carousel.setAttribute("data-interval", "false");

            if (window.jQuery && window.jQuery.fn && window.jQuery.fn.carousel) {
                window.jQuery(carousel).carousel({
                    interval: false,
                    ride: false
                }).carousel("pause");
            }
        });
    }

    function applyMotionPreference(event) {
        document.documentElement.classList.toggle("reduce-motion", event.matches);

        if (event.matches) {
            pauseCarouselMotion();
        }
    }

    applyMotionPreference(reducedMotionQuery);

    if (reducedMotionQuery.addEventListener) {
        reducedMotionQuery.addEventListener("change", applyMotionPreference);
    } else if (reducedMotionQuery.addListener) {
        reducedMotionQuery.addListener(applyMotionPreference);
    }
});
