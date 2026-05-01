(function() {
    function normalizePhotos(items, manifestUrl) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items.map(function(item) {
            var src = typeof item === "string" ? item : item.src;
            var alt = typeof item === "string" ? "" : item.alt;

            if (!src) {
                return null;
            }

            return {
                src: new URL(src, manifestUrl).href,
                alt: alt || "Forest Hills Runners photo",
                orientation: item.orientation || "unknown",
                width: item.width || null,
                height: item.height || null
            };
        }).filter(Boolean);
    }

    function createPhotoItem(photo, slotIndex) {
        var figure = document.createElement("figure");
        var classes = ["photo-gallery-item", "photo-gallery-slot-" + slotIndex];

        if (photo.orientation === "landscape") {
            classes.push("photo-gallery-item-landscape");
        } else if (photo.orientation === "portrait") {
            classes.push("photo-gallery-item-portrait");
        } else if (photo.orientation === "square") {
            classes.push("photo-gallery-item-square");
        }

        figure.className = classes.join(" ");

        var image = document.createElement("img");
        image.alt = photo.alt;
        image.loading = "eager";
        image.decoding = "async";
        image.setAttribute("fetchpriority", "low");
        image.src = photo.src;
        image.addEventListener("error", function() {
            figure.remove();
        });

        figure.appendChild(image);
        return figure;
    }

    function groupPhotos(photos) {
        return photos.reduce(function(accumulator, photo) {
            var orientation = photo.orientation || "unknown";

            if (!accumulator[orientation]) {
                accumulator[orientation] = [];
            }

            accumulator[orientation].push(photo);
            return accumulator;
        }, {});
    }

    function takeNext(groups, preferredOrientations) {
        for (var i = 0; i < preferredOrientations.length; i += 1) {
            var preferredOrientation = preferredOrientations[i];
            if (groups[preferredOrientation] && groups[preferredOrientation].length) {
                return groups[preferredOrientation].shift();
            }
        }

        var fallbackKey = Object.keys(groups).find(function(key) {
            return groups[key].length > 0;
        });

        return fallbackKey ? groups[fallbackKey].shift() : null;
    }

    function remainingCount(groups) {
        return Object.keys(groups).reduce(function(total, key) {
            return total + groups[key].length;
        }, 0);
    }

    function buildPhotoPanels(photos) {
        var slotPreferences = [
            ["landscape", "square", "unknown", "portrait"],
            ["portrait", "square", "unknown", "landscape"],
            ["landscape", "square", "unknown", "portrait"],
            ["square", "landscape", "unknown", "portrait"],
            ["portrait", "square", "unknown", "landscape"],
            ["landscape", "square", "unknown", "portrait"],
            ["landscape", "square", "unknown", "portrait"],
            ["square", "landscape", "unknown", "portrait"],
            ["landscape", "square", "unknown", "portrait"]
        ];
        var groups = groupPhotos(photos);
        var panels = [];

        while (remainingCount(groups) > 0) {
            var panel = slotPreferences.map(function(preferences) {
                return takeNext(groups, preferences);
            }).filter(Boolean);

            if (panel.length) {
                panels.push(panel);
            }
        }

        if (panels.length && panels[panels.length - 1].length < slotPreferences.length) {
            var fillGroups = groupPhotos(photos);
            var lastPanel = panels[panels.length - 1];

            while (lastPanel.length < slotPreferences.length) {
                var photo = takeNext(fillGroups, slotPreferences[lastPanel.length]);

                if (!photo) {
                    break;
                }

                lastPanel.push(photo);
            }
        }

        return panels;
    }

    function createPhotoPanel(photos) {
        var panel = document.createElement("div");
        panel.className = "photo-gallery-panel";

        photos.forEach(function(photo, index) {
            panel.appendChild(createPhotoItem(photo, index));
        });

        return panel;
    }

    function createPhotoLoop(panels, isHidden) {
        var loop = document.createElement("div");
        loop.className = "photo-gallery-loop";

        if (isHidden) {
            loop.setAttribute("aria-hidden", "true");
        }

        panels.forEach(function(panelPhotos) {
            loop.appendChild(createPhotoPanel(panelPhotos));
        });

        if (isHidden) {
            loop.querySelectorAll("img").forEach(function(image) {
                image.alt = "";
                image.loading = "eager";
            });
        }

        return loop;
    }

    function fillTrack(track, panels) {
        track.innerHTML = "";
        track.appendChild(createPhotoLoop(panels, false));
        track.appendChild(createPhotoLoop(panels, true));

        return panels.length > 0;
    }

    function waitForImages(images) {
        return Promise.all(images.map(function(image) {
            if (image.decode) {
                return image.decode().catch(function() {});
            }

            if (image.complete) {
                return Promise.resolve();
            }

            return new Promise(function(resolve) {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
            });
        }));
    }

    function setStaticMode(gallery) {
        var duplicateLoops = gallery.querySelectorAll(".photo-gallery-loop[aria-hidden='true']");

        duplicateLoops.forEach(function(loop) {
            loop.remove();
        });

        gallery.classList.remove("is-animated");
        gallery.classList.add("is-static");
    }

    function isReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function watchMotionPreference(gallery) {
        var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

        function applyMotionPreference(event) {
            if (event.matches) {
                setStaticMode(gallery);
            }
        }

        if (reducedMotionQuery.addEventListener) {
            reducedMotionQuery.addEventListener("change", applyMotionPreference);
        } else if (reducedMotionQuery.addListener) {
            reducedMotionQuery.addListener(applyMotionPreference);
        }
    }

    function renderPhotoGallery(section, gallery, photos) {
        var track = gallery.querySelector(".photo-gallery-track");

        if (!track || photos.length === 0) {
            return;
        }

        gallery.classList.remove("is-animated", "is-static");

        if (!fillTrack(track, buildPhotoPanels(photos))) {
            return;
        }

        if (photos.length > 5 && !isReducedMotion()) {
            gallery.classList.add("is-static");
            watchMotionPreference(gallery);
        } else {
            setStaticMode(gallery);
        }

        section.hidden = false;

        if (photos.length > 5 && !isReducedMotion()) {
            waitForImages(Array.from(track.querySelectorAll(".photo-gallery-loop:not([aria-hidden='true']) img"))).then(function() {
                if (!isReducedMotion()) {
                    gallery.classList.remove("is-static");
                    gallery.classList.add("is-animated");
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", function() {
        var gallery = document.querySelector("[data-photo-gallery]");

        if (!gallery) {
            return;
        }

        var section = gallery.closest(".photo-gallery-section");
        var manifestPath = gallery.getAttribute("data-manifest");

        if (!section || !manifestPath) {
            return;
        }

        var manifestUrl = new URL(manifestPath, window.location.href);

        fetch(manifestUrl.href)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Photo gallery manifest could not be loaded.");
                }

                return response.json();
            })
            .then(function(items) {
                renderPhotoGallery(section, gallery, normalizePhotos(items, manifestUrl));
            })
            .catch(function() {
                section.hidden = true;
            });
    });
})();
