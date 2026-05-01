document.addEventListener("DOMContentLoaded", function() {
    const sitePrefix = getSitePrefix();
    const routeJsonUrl = sitePrefix + "routes.json";
    const poiJsonUrl = sitePrefix + "route-pois.json";
    const mapElement = document.getElementById("route-map");
    const routeSectionsElement = document.getElementById("map-routes");
    const routeStatusElement = document.getElementById("route-status");
    const showAllButton = document.getElementById("show-all-routes");
    const hideAllButton = document.getElementById("hide-all-routes");
    const togglePoisButton = document.getElementById("toggle-route-pois");
    const hasLeaflet = typeof L !== "undefined";
    const activeRouteIds = new Set();
    const routeLayers = new Map();
    const routeElements = new Map();
    const routeColors = ["#0b5f0b", "#d97706", "#2563eb", "#b91c1c", "#7c3aed", "#047857", "#be123c"];
    const sectionOrder = [
        "Regular FHR Weekly Runs",
        "FHR Saturday Long Runs",
        "Shorter Runs",
        "Longer Runs",
        "Hills and Workouts"
    ];
    let map = null;
    let poiLayer = null;
    let routeRenderer = null;
    let pointsOfInterestVisible = true;
    let routes = [];
    let pointsOfInterest = [];

    if (!mapElement || !routeSectionsElement) {
        return;
    }

    initializeMap();
    loadRoutes();
    loadPointsOfInterest();

    if (showAllButton) {
        showAllButton.addEventListener("click", function() {
            Promise.all(routes.map(function(route) {
                return setRouteActive(route, true, false);
            })).then(function() {
                fitActiveRoutes();
                renderFallbackRoutes();
                updateRouteStatusFromActiveRoutes();
            });
        });
    }

    if (hideAllButton) {
        hideAllButton.addEventListener("click", function() {
            routes.forEach(function(route) {
                setRouteActive(route, false);
            });
            updateRouteStatus("No routes selected");
        });
    }

    if (togglePoisButton) {
        togglePoisButton.addEventListener("click", function() {
            togglePointsOfInterest();
        });
    }

    function getSitePrefix() {
        return window.location.pathname.indexOf("/routes/") !== -1 ? "../" : "";
    }

    function initializeMap() {
        if (!hasLeaflet) {
            mapElement.classList.add("route-map-fallback");
            mapElement.innerHTML = '<svg class="route-fallback-svg" role="img" aria-label="Selected route preview"></svg>';
            updatePointsOfInterestToggle(pointsOfInterestVisible);
            updateRouteStatus("Select a route below to preview it on the map");
            return;
        }

        map = L.map(mapElement, {
            scrollWheelZoom: true,
            zoomControl: true,
            center: [42.3098, -71.1146],
            zoom: 13
        });

        const cartoVoyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20
        });

        const cartoPositron = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20
        });

        const esriWorldImagery = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: "Tiles &copy; Esri",
            maxZoom: 19
        });

        const baseLayers = [
            {
                id: "streets",
                layer: cartoVoyager,
                name: "Streets"
            },
            {
                id: "light",
                layer: cartoPositron,
                name: "Light"
            },
            {
                id: "satellite",
                layer: esriWorldImagery,
                name: "Satellite"
            }
        ];

        cartoVoyager.addTo(map);
        createBaseLayerControl(baseLayers, "streets").addTo(map);

        initializeRouteRenderer();
        refreshMapSize();
        window.addEventListener("load", refreshMapSize);
        window.addEventListener("resize", refreshMapSize);

        poiLayer = L.layerGroup().addTo(map);
        updatePointsOfInterestToggle(pointsOfInterestVisible);
    }

    function createBaseLayerControl(baseLayers, activeLayerId) {
        const BaseLayerControl = L.Control.extend({
            options: {
                position: "topright"
            },

            onAdd: function(layerMap) {
                let currentLayerId = activeLayerId;
                const container = L.DomUtil.create("div", "route-basemap-control");
                const toggleButton = L.DomUtil.create("button", "route-basemap-toggle", container);
                const panelId = "route-basemap-options";
                const panel = L.DomUtil.create("div", "route-basemap-panel", container);
                const optionButtons = [];

                toggleButton.type = "button";
                toggleButton.setAttribute("aria-controls", panelId);
                toggleButton.setAttribute("aria-expanded", "false");
                toggleButton.setAttribute("aria-label", "Choose map style");
                toggleButton.innerHTML = [
                    '<span class="route-basemap-toggle-icon" aria-hidden="true"></span>',
                    '<span class="route-basemap-toggle-text">Map</span>',
                    '<span class="route-basemap-toggle-caret" aria-hidden="true"></span>'
                ].join("");

                panel.hidden = true;
                panel.id = panelId;
                panel.setAttribute("aria-label", "Map style");
                panel.setAttribute("role", "radiogroup");

                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                function setExpanded(isExpanded) {
                    container.classList.toggle("is-open", isExpanded);
                    panel.hidden = !isExpanded;
                    toggleButton.setAttribute("aria-expanded", String(isExpanded));
                }

                function updateOptions() {
                    optionButtons.forEach(function(optionButton) {
                        const isSelected = optionButton.dataset.layerId === currentLayerId;
                        optionButton.classList.toggle("is-selected", isSelected);
                        optionButton.setAttribute("aria-checked", String(isSelected));
                    });
                }

                function selectLayer(baseLayer) {
                    if (baseLayer.id !== currentLayerId) {
                        baseLayers.forEach(function(candidateLayer) {
                            if (candidateLayer.id !== baseLayer.id && layerMap.hasLayer(candidateLayer.layer)) {
                                layerMap.removeLayer(candidateLayer.layer);
                            }
                        });

                        if (!layerMap.hasLayer(baseLayer.layer)) {
                            baseLayer.layer.addTo(layerMap);
                        }

                        currentLayerId = baseLayer.id;
                        updateOptions();
                    }

                    setExpanded(false);
                    toggleButton.focus();
                }

                toggleButton.addEventListener("click", function() {
                    setExpanded(toggleButton.getAttribute("aria-expanded") !== "true");
                });

                baseLayers.forEach(function(baseLayer) {
                    const optionButton = L.DomUtil.create("button", "route-basemap-option", panel);
                    const label = L.DomUtil.create("span", "route-basemap-option-text", optionButton);
                    const name = L.DomUtil.create("span", "route-basemap-option-name", label);

                    optionButton.type = "button";
                    optionButton.dataset.layerId = baseLayer.id;
                    optionButton.setAttribute("role", "radio");
                    name.textContent = baseLayer.name;
                    optionButton.addEventListener("click", function() {
                        selectLayer(baseLayer);
                    });

                    optionButtons.push(optionButton);
                });

                panel.addEventListener("keydown", function(event) {
                    if (event.key === "Escape") {
                        setExpanded(false);
                        toggleButton.focus();
                    }
                });

                updateOptions();
                return container;
            }
        });

        return new BaseLayerControl();
    }

    function initializeRouteRenderer() {
        map.createPane("routePane");

        const routePane = map.getPane("routePane");
        if (routePane) {
            routePane.style.zIndex = 450;
        }

        const rendererOptions = {
            padding: 0.5,
            pane: "routePane"
        };

        if (L.canvas) {
            rendererOptions.tolerance = 8;
            routeRenderer = L.canvas(rendererOptions);
        } else {
            routeRenderer = L.svg(rendererOptions);
        }
    }

    function refreshMapSize() {
        if (!hasLeaflet || !map) {
            return;
        }

        window.requestAnimationFrame(function() {
            map.invalidateSize();
        });

        window.setTimeout(function() {
            map.invalidateSize();
        }, 250);
    }

    function loadRoutes() {
        fetch(routeJsonUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Could not load " + routeJsonUrl);
                }
                return response.json();
            })
            .then(function(routeData) {
                routes = routeData.map(normalizeRoute);
                renderRouteSections(routes);
                updateRouteStatus(`${routes.length} routes loaded`);
            })
            .catch(function(error) {
                console.error("Error loading routes:", error);
                updateRouteStatus("Routes could not be loaded. Check routes.json and the GPX files.");
            });
    }

    function loadPointsOfInterest() {
        fetch(poiJsonUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Could not load " + poiJsonUrl);
                }
                return response.json();
            })
            .then(function(poiData) {
                pointsOfInterest = poiData.map(normalizePoint).filter(function(poi) {
                    return Number.isFinite(poi.lat) && Number.isFinite(poi.lng);
                });
                renderPointsOfInterest();
            })
            .catch(function(error) {
                console.error("Error loading points of interest:", error);
            });
    }

    function normalizeRoute(route, index) {
        return {
            id: route.id,
            section: route.section || "Longer Runs",
            name: route.name,
            distance: route.distance || "",
            description: route.description || "",
            gpxUrl: resolveAssetPath(route.gpx),
            stravaUrl: route.stravaUrl || "",
            startPointUrl: route.startPointUrl || "",
            color: route.color || routeColors[index % routeColors.length]
        };
    }

    function normalizePoint(poi) {
        return {
            id: poi.id,
            name: poi.name,
            description: poi.description || "",
            lat: parseFloat(poi.lat),
            lng: parseFloat(poi.lng),
            color: poi.color || "#092409",
            fillColor: poi.fillColor || "#ffd700"
        };
    }

    function resolveAssetPath(path) {
        if (!path || path.indexOf("http://") === 0 || path.indexOf("https://") === 0 || path.indexOf("/") === 0) {
            return path;
        }

        return sitePrefix + path.replace(/^\.\//, "");
    }

    function renderRouteSections(routeData) {
        routeSectionsElement.innerHTML = "";
        routeElements.clear();

        const groupedRoutes = routeData.reduce(function(groups, route) {
            if (!groups[route.section]) {
                groups[route.section] = [];
            }
            groups[route.section].push(route);
            return groups;
        }, {});

        sectionOrder.forEach(function(sectionName) {
            const section = document.createElement("section");
            section.className = "route-section";

            const heading = document.createElement("button");
            heading.type = "button";
            heading.className = "route-section-heading";
            heading.setAttribute("aria-expanded", "true");
            heading.textContent = sectionName;

            const list = document.createElement("div");
            list.className = "route-section-list";

            (groupedRoutes[sectionName] || []).forEach(function(route) {
                list.appendChild(createRouteEntry(route));
            });

            heading.addEventListener("click", function() {
                const isExpanded = heading.getAttribute("aria-expanded") === "true";
                heading.setAttribute("aria-expanded", isExpanded ? "false" : "true");
                list.hidden = isExpanded;
            });

            section.appendChild(heading);
            section.appendChild(list);
            routeSectionsElement.appendChild(section);
        });
    }

    function createRouteEntry(route) {
        const item = document.createElement("div");
        item.className = "route-entry";
        item.dataset.routeId = route.id;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "routename";
        button.setAttribute("aria-pressed", "false");

        const title = document.createElement("span");
        title.className = "route-title";
        title.textContent = routeTitle(route);

        const toggleLabel = document.createElement("span");
        toggleLabel.className = "route-toggle-label";

        button.appendChild(title);
        button.appendChild(toggleLabel);
        updateRouteButtonState(button, toggleLabel, route, false);

        const description = document.createElement("span");
        description.className = "route-description";
        description.id = "desc-" + route.id;
        description.hidden = true;

        const descriptionText = document.createElement("span");
        descriptionText.textContent = route.description;
        description.appendChild(descriptionText);

        const links = createRouteLinks(route);
        if (links.childNodes.length > 0) {
            description.appendChild(links);
        }

        button.addEventListener("click", function() {
            setRouteActive(route, !activeRouteIds.has(route.id));
        });

        item.appendChild(button);
        item.appendChild(description);
        routeElements.set(route.id, { item: item, description: description, button: button, toggleLabel: toggleLabel });
        return item;
    }

    function updateRouteButtonState(button, toggleLabel, route, isActive) {
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
        button.setAttribute("aria-label", `${isActive ? "Hide" : "Show"} ${routeTitle(route)} on the map`);
        toggleLabel.textContent = isActive ? "Shown" : "Show";
    }

    function routeTitle(route) {
        return route.distance ? `${route.name} (${route.distance})` : route.name;
    }

    function createRouteLinks(route) {
        const links = document.createElement("span");
        links.className = "route-links";

        if (route.stravaUrl) {
            links.appendChild(createLink("Strava Route", route.stravaUrl, false));
        }

        if (route.gpxUrl) {
            links.appendChild(createLink("gpx", route.gpxUrl, true));
        }

        if (route.startPointUrl) {
            links.appendChild(createLink("Start point", route.startPointUrl, false));
        }

        return links;
    }

    function createLink(label, url, isDownload) {
        const link = document.createElement("a");
        link.href = url;
        link.textContent = label;

        if (isDownload) {
            link.setAttribute("download", "");
        } else {
            link.target = "_blank";
            link.rel = "noopener";
        }

        return link;
    }

    function renderPointsOfInterest() {
        if (!hasLeaflet || !poiLayer) {
            return;
        }

        poiLayer.clearLayers();

        pointsOfInterest.forEach(function(poi) {
            const marker = L.marker([poi.lat, poi.lng], {
                icon: L.divIcon({
                    className: "route-poi-marker",
                    html: `<span class="route-poi-marker-dot" style="--poi-color: ${escapeAttribute(poi.color)}; --poi-fill: ${escapeAttribute(poi.fillColor)};"></span>`,
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                    popupAnchor: [0, -10]
                })
            })
                .bindPopup(createPointPopup(poi), {
                    className: "route-poi-popup",
                    maxWidth: 280
                });

            marker.addTo(poiLayer);
        });

        if (activeRouteIds.size === 0) {
            fitPointsOfInterest();
        }
    }

    function createPointPopup(poi) {
        return `
            <div class="route-poi-popup-content">
                <strong>${escapeHtml(poi.name)}</strong>
                <p>${escapeHtml(poi.description || "")}</p>
            </div>
        `;
    }

    function escapeAttribute(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function fitPointsOfInterest() {
        if (!hasLeaflet || !map || pointsOfInterest.length === 0) {
            return;
        }

        const bounds = L.latLngBounds(pointsOfInterest.map(function(poi) {
            return [poi.lat, poi.lng];
        }));

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [32, 32],
                maxZoom: 13
            });
        }
    }

    function setRouteActive(route, shouldActivate, shouldFit) {
        const elements = routeElements.get(route.id);
        const shouldFitRoute = shouldFit !== false;

        if (!shouldActivate) {
            activeRouteIds.delete(route.id);

            if (hasLeaflet && routeLayers.has(route.id)) {
                map.removeLayer(routeLayers.get(route.id));
            }

            if (elements) {
                elements.item.classList.remove("selected");
                elements.description.hidden = true;
                updateRouteButtonState(elements.button, elements.toggleLabel, route, false);
            }

            renderFallbackRoutes();
            updateRouteStatusFromActiveRoutes();
            return Promise.resolve();
        }

        return loadRouteLayer(route)
            .then(function(layer) {
                activeRouteIds.add(route.id);

                if (hasLeaflet && layer && !map.hasLayer(layer)) {
                    layer.addTo(map);
                    layer.bringToFront();
                }

                if (hasLeaflet && layer && shouldFitRoute) {
                    map.fitBounds(layer.getBounds(), {
                        padding: [28, 28],
                        maxZoom: 15
                    });
                }

                if (elements) {
                    elements.item.classList.add("selected");
                    elements.description.hidden = false;
                    updateRouteButtonState(elements.button, elements.toggleLabel, route, true);
                }

                renderFallbackRoutes();
                updateRouteStatusFromActiveRoutes();
            })
            .catch(function(error) {
                console.error("Error loading route:", error);
                updateRouteStatus(`Could not load ${route.name}. Check the GPX path in routes.csv.`);
            });
    }

    function loadRouteLayer(route) {
        if (routeLayers.has(route.id)) {
            return Promise.resolve(routeLayers.get(route.id));
        }

        if (!hasLeaflet && route.coordinates) {
            return Promise.resolve(null);
        }

        if (!route.gpxUrl) {
            return Promise.reject(new Error("Missing GPX URL for " + route.id));
        }

        return fetch(route.gpxUrl)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error("Could not load " + route.gpxUrl);
                }
                return response.text();
            })
            .then(function(gpxText) {
                const coordinates = parseGpxCoordinates(gpxText);
                route.coordinates = coordinates;

                if (!hasLeaflet) {
                    return null;
                }

                const layer = L.polyline(coordinates, {
                    color: route.color,
                    weight: 5,
                    opacity: 0.9,
                    renderer: routeRenderer
                }).bindTooltip(route.name, {
                    sticky: true
                });

                routeLayers.set(route.id, layer);
                return layer;
            });
    }

    function fitActiveRoutes() {
        if (!hasLeaflet) {
            return;
        }

        const bounds = L.latLngBounds([]);

        activeRouteIds.forEach(function(routeId) {
            const layer = routeLayers.get(routeId);
            if (layer) {
                bounds.extend(layer.getBounds());
            }
        });

        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [28, 28],
                maxZoom: 14
            });
        }
    }

    function parseGpxCoordinates(gpxText) {
        const gpxDocument = new DOMParser().parseFromString(gpxText, "application/xml");
        const parserError = gpxDocument.querySelector("parsererror");

        if (parserError) {
            throw new Error("Invalid GPX file");
        }

        const points = Array.from(gpxDocument.querySelectorAll("trkpt, rtept"))
            .map(function(point) {
                return [
                    parseFloat(point.getAttribute("lat")),
                    parseFloat(point.getAttribute("lon"))
                ];
            })
            .filter(function(point) {
                return Number.isFinite(point[0]) && Number.isFinite(point[1]);
            });

        if (points.length < 2) {
            throw new Error("GPX file needs at least two points");
        }

        return points;
    }

    function renderFallbackRoutes() {
        if (hasLeaflet) {
            return;
        }

        const svg = mapElement.querySelector(".route-fallback-svg");
        if (!svg) {
            return;
        }

        const activeRoutes = routes.filter(function(route) {
            return activeRouteIds.has(route.id) && route.coordinates;
        });

        svg.innerHTML = "";

        if (activeRoutes.length === 0) {
            svg.setAttribute("viewBox", "0 0 100 100");
            return;
        }

        const points = activeRoutes.flatMap(function(route) {
            return route.coordinates;
        });
        const bounds = coordinateBounds(points);
        const width = 1000;
        const height = 560;
        const padding = 42;
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

        activeRoutes.forEach(function(route) {
            const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            polyline.setAttribute("fill", "none");
            polyline.setAttribute("stroke", route.color);
            polyline.setAttribute("stroke-width", "9");
            polyline.setAttribute("stroke-linecap", "round");
            polyline.setAttribute("stroke-linejoin", "round");
            polyline.setAttribute("points", route.coordinates.map(function(point) {
                return projectPoint(point, bounds, width, height, padding).join(",");
            }).join(" "));
            svg.appendChild(polyline);
        });
    }

    function coordinateBounds(points) {
        return points.reduce(function(bounds, point) {
            return {
                minLat: Math.min(bounds.minLat, point[0]),
                maxLat: Math.max(bounds.maxLat, point[0]),
                minLng: Math.min(bounds.minLng, point[1]),
                maxLng: Math.max(bounds.maxLng, point[1])
            };
        }, {
            minLat: Infinity,
            maxLat: -Infinity,
            minLng: Infinity,
            maxLng: -Infinity
        });
    }

    function projectPoint(point, bounds, width, height, padding) {
        const latRange = bounds.maxLat - bounds.minLat || 1;
        const lngRange = bounds.maxLng - bounds.minLng || 1;
        const x = padding + ((point[1] - bounds.minLng) / lngRange) * (width - padding * 2);
        const y = padding + ((bounds.maxLat - point[0]) / latRange) * (height - padding * 2);
        return [Math.round(x), Math.round(y)];
    }

    function togglePointsOfInterest() {
        if (!hasLeaflet || !poiLayer) {
            pointsOfInterestVisible = !pointsOfInterestVisible;
            mapElement.classList.toggle("hide-route-pois", !pointsOfInterestVisible);
            updatePointsOfInterestToggle(pointsOfInterestVisible);
            return;
        }

        if (map.hasLayer(poiLayer)) {
            map.removeLayer(poiLayer);
            pointsOfInterestVisible = false;
        } else {
            poiLayer.addTo(map);
            pointsOfInterestVisible = true;
        }

        updatePointsOfInterestToggle(pointsOfInterestVisible);
    }

    function updatePointsOfInterestToggle(isVisible) {
        if (togglePoisButton) {
            togglePoisButton.setAttribute("aria-pressed", isVisible ? "true" : "false");
        }
    }

    function updateRouteStatusFromActiveRoutes() {
        const activeCount = activeRouteIds.size;

        if (activeCount === 0) {
            updateRouteStatus("No routes selected");
        } else if (activeCount === 1) {
            const activeRoute = routes.find(function(route) {
                return activeRouteIds.has(route.id);
            });
            updateRouteStatus(activeRoute ? activeRoute.name : "1 route selected");
        } else {
            updateRouteStatus(`${activeCount} routes selected`);
        }
    }

    function updateRouteStatus(message) {
        if (routeStatusElement) {
            routeStatusElement.textContent = message;
        }
    }

    function escapeHtml(value) {
        const element = document.createElement("span");
        element.textContent = value;
        return element.innerHTML;
    }
});
